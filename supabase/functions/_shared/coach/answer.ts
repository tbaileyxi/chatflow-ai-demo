// Coach answering + recap composition.
//
// Everything here hands the model a payload built by retrieve.ts and asks it to
// SHAPE that payload. No search, no recall. The failure modes for a chat-aware
// bot are different from the news bot's: it will not invent a message, but it
// WILL misattribute one, over-conclude from banter, or flatten a joke into a
// fact. Those three are what the prompts below are built to prevent.

import { callLlm } from "../llm.ts";
import type {
  BoxScore,
  GameBeat,
  GameSnapshot,
  HuddleContext,
  LedgerRow,
  TeamStanding,
  TranscriptLine,
} from "./retrieve.ts";

// ---------------------------------------------------------------------------
// Router — which facts does this question need?
// ---------------------------------------------------------------------------

export type Lane =
  | "room"       // what was said in here
  | "ledger"     // who's up/down, records, head-to-head
  | "game"       // score, box score, schedule, record, standings — VOLATILE, data only
  | "knowledge"  // franchise/school history, traditions, rivalries — STABLE, model may answer
  | "mixed";     // recap-shaped: needs both room and game

const ROUTE_SYSTEM =
  `You classify one question asked inside a sports group chat. Reply with ONE word, nothing else.

room        - about what people in the chat said or did. "what did I miss", "what'd Brett say", "where are we meeting"
ledger      - about the group's picks, records, chips, or who is winning/losing between members
game      - anything about the CURRENT state of the team or a game: score, box score, stats this game, next game, schedule, this season's record, standings, injuries, who is playing now, current roster
knowledge - settled history that does not change: past championships, famous games, rivalries, traditions, the stadium, records set years ago, trivia about the franchise or school
mixed     - a broad catch-up that needs both the chat and the game. "what did I miss", "catch me up", "what happened"

When a question could be either, prefer "game" — being wrong about something current is far more costly than looking up something historical.

Reply with exactly one of: room, ledger, game, knowledge, mixed`;

export async function routeQuestion(question: string): Promise<Lane> {
  try {
    const res = await callLlm({
      job: "route",
      system: ROUTE_SYSTEM,
      user: question.slice(0, 500),
    });
    const raw = res.text.toLowerCase().replace(/[^a-z]/g, "");
    if (["room", "ledger", "game", "knowledge", "mixed"].includes(raw)) {
      return raw as Lane;
    }
  } catch (err) {
    console.warn("[coach.answer] routing failed, defaulting to mixed", err);
  }
  // Failing open to `mixed` is the safe default: it retrieves more, not less,
  // and never silently routes a real question into a refusal.
  return "mixed";
}

// ---------------------------------------------------------------------------
// The shared character. Everything the Coach says obeys this.
// ---------------------------------------------------------------------------

function coachCharacter(ctx: HuddleContext): string {
  const team = ctx.teamName ?? "the team";
  const league = ctx.league ? ` (${ctx.league})` : "";
  // TWO ROOMS, TWO JOBS.
  //
  // A public game room is about a FIXTURE and holds both fanbases, but it
  // carries a team_id like every other huddle — tonight's Denver·Kansas City
  // room is stamped Kansas City. So this handed a room full of Broncos fans a
  // Chiefs partisan saying "we" about the team they came to watch lose.
  // Nobody in a game room asked for a supporter; they asked about the game.
  //
  // Only the persona and the side-taking change. Every hard rule below is
  // shared, because being wrong about a score is just as fatal either way.
  const sides = ctx.gameTeams.length === 2
    ? `${ctx.gameTeams[1]} at ${ctx.gameTeams[0]}`
    : (ctx.huddleName || "this game");
  const both = ctx.gameTeams.length === 2
    ? `${ctx.gameTeams[0]} and ${ctx.gameTeams[1]}`
    : "both teams";

  const persona = ctx.isGameRoom
    ? `You are the Coach, calling ${sides}${league} in a group chat where fans of BOTH teams are watching together. You are NOT an assistant and you never sound like one.

WHOSE SIDE YOU ARE ON — nobody's. This is the rule that matters most in this room.
- NEVER say "we", "us" or "our" about either team. You are calling the game, not supporting one.
- ${both} get the same treatment. A great play is a great play, whoever it hurts.
- No commiserating, no gloating, no "that one stings" — half this room is delighted by whatever upsets the other half.
- Be sharp and opinionated about the GAME: a call, a decision, a matchup, somebody playing badly. Never partisan about a TEAM.

WHAT YOU ARE FOR HERE
- What is happening right now — score, situation, who is doing the damage. From the FACTS.
- How these two match up, and what has happened between them before: the rivalry, the last meeting, what is at stake. History is the one thing you may draw on beyond the FACTS, and ONLY where you are genuinely certain. If you are not sure it is true, leave it out.
- Never one team's season narrative told from that team's point of view.`
    : `You are the Coach: a sharp, opinionated ${team}${league} fan who lives in this group chat. You are NOT an assistant and you never sound like one.

WHOSE SIDE YOU ARE ON
- ${team} is "we" / "us" / "our". Never switch to third person about your own team.
- Opponents get named. Never "we" for them.
- This is ${team}'s room. Talk about ${team} — their season, their players, their next game. Another team comes up only as an opponent.`;

  return `${persona}

HARD RULES — breaking these ruins the product:
- ANYTHING CURRENT COMES FROM THE FACTS BLOCK. Scores, this season's record, standings, schedules, who is on the roster right now, who is starting, who is hurt, stats from a game in progress. If it is not in the FACTS, you do not know it — say what you do have instead. You are talking to people who are watching; being confidently wrong about today is the one thing you never recover from.
- NEVER invent or guess a name, number, score, date, venue, or quote about anything current.
- NEVER allude to a RESULT that is not in the FACTS. No "tough loss", no "after last night", no "the scoreboard didn't cooperate", no "we needed that one". Asked about Tulane's new uniforms with no game data at all, the Coach answered "we're winning that offseason battle even if the scoreboard didn't cooperate last night" — Tulane had not played a game. Colour about a result IS a factual claim; if no result is in the FACTS, the team has not played as far as you are concerned.
- NEVER repeat a number from the chat as if you verified it.
- NEVER mention "the facts", "the payload", "context", "the data", or that anything is missing or thin. Stay in character.
- No profanity, no slurs, no insults toward players, fans, or rival teams. Sports-bar smart, not Twitter-troll.
- No hashtags. At most one emoji, only if it genuinely fits.
- No URLs.`;
}

// ---------------------------------------------------------------------------
// Attribution rules — the specific way a chat-aware bot gets people in trouble.
// ---------------------------------------------------------------------------

const ATTRIBUTION_RULES = `HOW TO HANDLE WHAT PEOPLE SAID — read this twice:
- Each chat line is numbered and labelled with who said it. NEVER attribute a line to the wrong person. If you are not certain who said something, describe it without a name.
- When you credit someone by name, quote their words closely. Do not paraphrase them into something they did not say.
- Do NOT turn discussion into agreement. If three people floated a plan and nobody confirmed it, say it was floated, not decided. "Somebody suggested X" is right; "the group is doing X" is wrong unless someone actually confirmed.
- Jokes and sarcasm are jokes. Do not report them as facts or plans.
- Report what was said. Do not editorialize about what it means.`;

// ---------------------------------------------------------------------------
// Fact-block builders. Numbered, compact, and explicitly bounded.
// ---------------------------------------------------------------------------

function transcriptBlock(lines: TranscriptLine[]): string {
  if (lines.length === 0) return "CHAT: (nothing said in this window)";
  return "CHAT (numbered, oldest first):\n" +
    lines.map((l) => `[${l.n}] ${l.speaker}: ${l.text}`).join("\n");
}

function beatsBlock(label: string, beats: GameBeat[]): string {
  if (beats.length === 0) return `${label}: (none in this window)`;
  return `${label} (what you already posted, oldest first):\n` +
    beats.map((b) => `- ${b.text}`).join("\n");
}

function ledgerBlock(rows: LedgerRow[]): string {
  if (rows.length === 0) {
    return "LEDGER: (nobody in this room has a settled pick yet)";
  }
  return "LEDGER (this room only, worst net first):\n" +
    rows.map((r) =>
      `- ${r.name}: ${r.wins}-${r.losses}, net ${r.net >= 0 ? "+" : ""}${r.net} chips, streak ${r.streak}`
    ).join("\n");
}

function boxScoreBlock(b: BoxScore | null): string {
  if (!b) return "BOX SCORE: (not available for this game)";
  const parts: string[] = [];
  if (b.teamLines.length > 0) {
    parts.push("TEAM TOTALS (copy these numbers exactly):\n" +
      b.teamLines.map((l) => `- ${l}`).join("\n"));
  }
  if (b.leaderLines.length > 0) {
    parts.push("TOP PERFORMERS:\n" + b.leaderLines.map((l) => `- ${l}`).join("\n"));
  }
  return parts.join("\n");
}

function gameBlock(
  g: GameSnapshot | null,
  record: { wins: number; losses: number } | null,
  standings: TeamStanding | null,
  nextGame?: string | null,
): string {
  const parts: string[] = [];
  if (g) {
    const score = g.homeScore != null && g.awayScore != null
      ? `${g.away} ${g.awayScore}, ${g.home} ${g.homeScore}`
      : `${g.away} @ ${g.home}`;
    if (g.state === "live") {
      parts.push(`GAME (LIVE): ${score} — ${[g.period, g.clock].filter(Boolean).join(" ") || "in progress"}`);
    } else if (g.state === "postgame") {
      parts.push(`GAME (FINAL): ${score}`);
    } else {
      parts.push(`GAME (UPCOMING): ${score}, starts ${g.startTime}`);
    }
  }
  // ESPN's own record is authoritative when we have it; our computed W-L is the
  // fallback so this line is never empty during a season.
  if (standings?.record) parts.push(`SEASON RECORD: ${standings.record}`);
  else if (record) parts.push(`SEASON RECORD: ${record.wins}-${record.losses}`);
  if (standings?.standing) parts.push(`STANDINGS: ${standings.standing}`);
  if (nextGame) parts.push(`NEXT GAME: ${nextGame}`);
  return parts.length > 0 ? parts.join("\n") : "GAME: (no game data available)";
}

// ---------------------------------------------------------------------------
// Recap-shaped questions get the recap FORMAT.
// ---------------------------------------------------------------------------

/**
 * "@coach what did I miss" and the recap the Coach posts on its own are the
 * same question. They should not produce differently-shaped answers just
 * because one arrived through a cron and the other through a mention — a user
 * who sees the two-lane postgame post and then asks for it by name should get
 * the same thing back.
 *
 * Checked on the question TEXT rather than on lane === "mixed" alone, because
 * `mixed` is also where routing failures land, and a mis-routed "how many hits"
 * should still get a direct answer rather than a game-and-room recap.
 */
const RECAP_SHAPED =
  /\b(what(?:'?s| did| have)?\s+(?:i|we)?\s*miss|catch me up|catch us up|fill me in|what happened|whats been going on|what'?s been going on|recap|summar(?:y|ise|ize))\b/i;

export function isRecapQuestion(question: string): boolean {
  return RECAP_SHAPED.test(question);
}

// ---------------------------------------------------------------------------
// Answering a direct question.
// ---------------------------------------------------------------------------

export interface AnswerInput {
  /** Live X search text, already fetched. Empty/absent = nothing found. */
  liveSearch?: string;
  /** ESPN roster line for the position asked about. Empty/absent = not fetched. */
  roster?: string;
  ctx: HuddleContext;
  question: string;
  asker: string;
  lane: Lane;
  transcript: TranscriptLine[];
  gameBeats: GameBeat[];
  newsBeats: GameBeat[];
  ledger: LedgerRow[];
  game: GameSnapshot | null;
  record: { wins: number; losses: number } | null;
  standings: TeamStanding | null;
  boxScore: BoxScore | null;
  seasonResults: string[];
  nextGame: string | null;
}

export async function answerQuestion(input: AnswerInput): Promise<string> {
  const { ctx, lane } = input;

  const facts: string[] = [];
  // Live X reporting, when the question needed something the database cannot
  // hold. It goes in as FACTS like anything else — the "only say what is in
  // FACTS" rule is what keeps this safe, and it is precisely why the search
  // result is pasted in rather than the model being told to go look.
  // Before the X block on purpose: the roster is the harder fact. X supplies
  // who is EXPECTED to start; ESPN supplies who is actually on the team, and
  // when the two disagree the roster is the one that is checkable.
  if (input.roster && input.roster.trim()) {
    facts.push(input.roster.trim());
  }

  if (input.liveSearch && input.liveSearch.trim()) {
    facts.push(
      "LIVE FROM X (reported just now — not your own knowledge). If this " +
      "carries a betting line, quote it as the line and say which book it is " +
      "from; do NOT say there is no line when one is sitting right here:\n" +
      input.liveSearch.trim(),
    );
  }
  // The last turns go in for EVERY lane. The full room transcript is still a
  // room-lane thing, but a handful of recent lines is what makes "his", "that
  // guy" and "pull it up" resolvable — those are follow-ups, not room questions.
  if (lane === "room" || lane === "mixed") {
    facts.push(transcriptBlock(input.transcript));
  } else if (input.transcript.length > 0) {
    const recent = input.transcript.slice(-6);
    facts.push(
      "JUST SAID IN THIS ROOM (newest last) — use it to resolve who or what " +
      "the question refers to:\n" +
      recent.map((l) => `${l.speaker}: ${l.text}`).join("\n"),
    );
  }
  if (lane === "ledger") {
    facts.push(ledgerBlock(input.ledger));
    // A ledger question in a live room usually wants the game as texture too.
    facts.push(gameBlock(input.game, input.record, input.standings, input.nextGame));
  }
  if (lane === "game" || lane === "mixed" || lane === "knowledge") {
    facts.push(gameBlock(input.game, input.record, input.standings, input.nextGame));
    // The box score is what makes "how many hits do the Yankees have" work.
    // Team totals come straight off the ESPN summary the live poller already
    // fetches, pre-formatted, so the model reads a number rather than deriving
    // one.
    facts.push(boxScoreBlock(input.boxScore));
    facts.push(beatsBlock("GAME BEATS", input.gameBeats));
    facts.push(beatsBlock("TEAM NEWS", input.newsBeats));
  }
  if (lane === "mixed") facts.push(ledgerBlock(input.ledger));
  if (lane === "game" || lane === "knowledge") {
    // Even a history question often turns on something current ("are we better
    // than the '99 team?"). Hand over this season's real results either way so
    // the answer is anchored rather than recalled.
    facts.push(
      input.seasonResults.length > 0
        ? "THIS SEASON'S RESULTS SO FAR:\n" + input.seasonResults.map((r) => `- ${r}`).join("\n")
        : "THIS SEASON'S RESULTS: (none on record yet)",
    );
  }

  // The stable/volatile split. A fan bot that cannot tell you the team lost four
  // straight Super Bowls looks broken — the model knows that as well as anyone
  // in the room, and it has not changed since 1994. What it must never do is
  // answer from memory about anything that moves week to week.
  const knowledgeRules = lane === "knowledge"
    ? `
ANSWERING FROM WHAT YOU KNOW:
- This is a history question. You may answer it from your own knowledge of the team, the school, and the sport — championships, famous games and plays, rivalries, traditions, the stadium, coaches and players from past eras, records set in previous seasons.
- Be a fan telling the story, not an encyclopedia. One or two sentences.
- HARD LINE: do not answer from memory about anything that changes. The current roster, who starts, who is hurt, this season's record, where we sit in the standings, this week's schedule, a live score. If the question turns out to be about any of those, say you would rather pull it up than guess, and give whatever IS in the FACTS.
- If you are genuinely unsure of a historical detail, say so plainly rather than picking a number. "I want to say it was the mid-90s but don't quote me" is a good answer. A confident wrong year is not.
`
    : "";

  const system = `${coachCharacter(ctx)}

${ATTRIBUTION_RULES}
${knowledgeRules}
ANSWERING:
- Answer the question directly, in 1-4 sentences. No preamble, no "great question".
- If the FACTS do not contain the answer, say plainly what you do have instead. Never guess and never pad.

- A ROSTER LINE IN THE FACTS IS AN ANSWER, NOT A CONSOLATION. Asked who starts
  at a position with the roster in hand, do not open with "no clue" — that reads
  as the Coach not knowing its own team while nine names sit in front of it.
  Lead with what is true: nobody has been named the starter yet, then give the
  candidates WITH their class and number, senior and junior first, because
  experience is what a fan is weighing. Two or three names, not the whole list.
  Say the staff has not declared one rather than implying you cannot find out.
- Talk like you are texting the room, not writing a report. No headers, no bullet lists unless you are genuinely listing 3+ things.

- HAND IT BACK. A search box answers and stops; a person says something and waits.
  Often — not every time, or it turns into an interview — end by asking them
  something real: what they saw, who they are worried about, whether they agree.
  Ask about the thing you just said, never a generic "anything else?".

- SHORT. Two or three sentences is a whole answer. Length is the tell that
  something is generated: people do not write paragraphs in a group chat, and
  the ones who do get scrolled past.

- Never narrate yourself. No "let me look that up", no "based on the facts", no
  "great question". Just say the thing.`;

  const user = `Asked by ${input.asker} in "${ctx.huddleName}":
"${input.question}"

FACTS — the only things you may reference:
${facts.join("\n\n")}`;

  const res = await callLlm({ job: "answer", system, user });
  return res.text;
}

// ---------------------------------------------------------------------------
// The recap — the marquee feature.
// ---------------------------------------------------------------------------

export interface RecapInput {
  ctx: HuddleContext;
  kind: "postgame" | "daily" | "halftime" | "opener";
  transcript: TranscriptLine[];
  gameBeats: GameBeat[];
  newsBeats: GameBeat[];
  ledger: LedgerRow[];
  game: GameSnapshot | null;
  record: { wins: number; losses: number } | null;
  // Box-score leaders, already formatted ("Jones 14/21, 187 yds, 2 TD").
  // A recap without numbers reads like a vibe; the numbers are the recap.
  statLines?: string[];
}

/**
 * Two lanes in one message: THE GAME (from bot_emit_log + the games table) and
 * THE ROOM (from huddle_messages).
 *
 * Neither half alone is as good. The game half you can get from ESPN. The room
 * half nobody else on earth has. Together it is a thing only this app can
 * produce, which is the entire argument for building it.
 */
export async function composeRecap(input: RecapInput): Promise<string | null> {
  const { ctx } = input;

  // THE FIRST MESSAGE IN AN EMPTY ROOM.
  //
  // Every other lane here summarises what happened. This one has nothing to
  // summarise — it is what the room says to the one person who just walked in,
  // before any friends arrive. That moment is where the product is won or lost:
  // a social app with nobody in it is a blank screen, and a blank screen is why
  // people uninstall on day one.
  //
  // So it opens with something specific and current about their team, and then
  // asks them something, because a statement ends a conversation and a question
  // starts one.
  if (input.kind === "opener") {
    const bits: string[] = [];
    if (input.game) {
      const g = input.game;
      bits.push(
        g.state === "postgame"
          ? `Last game: ${g.away} ${g.awayScore ?? ""} at ${g.home} ${g.homeScore ?? ""}.`
          : `Next up: ${g.away} at ${g.home}, ${new Date(g.startTime).toDateString()}.`,
      );
    }
    if (input.record) bits.push(`Record: ${input.record.wins}-${input.record.losses}.`);
    for (const n of input.newsBeats.slice(0, 4)) bits.push(`News: ${n.text}`);
    if (input.statLines?.length) bits.push(input.statLines.join(" · "));
    if (!bits.length) return null;

    // Same split as coachCharacter: a game room has no side to speak for, and
    // "say we and us, you are on this team" is exactly wrong when half the
    // room came to watch that team lose.
    const openSystem = `You are ${
      ctx.isGameRoom
        ? `calling ${ctx.gameTeams.length === 2 ? `${ctx.gameTeams[1]} at ${ctx.gameTeams[0]}` : "this game"} for fans of BOTH teams`
        : `the ${ctx.teamName ?? "team"} voice`
    } in a group chat called "${ctx.huddleName}".

Someone just opened this room and they are the only one in it. Say the first thing.

- Open with something SPECIFIC and current from the FACTS — a number, a name, a
  fixture. Not "welcome", not "this is the room for X fans", not a description
  of the app. They can see what the app is; they cannot see what you know.
- Then ask them one real question about that thing.
- Two or three sentences. You are a person texting, not an onboarding screen.
${ctx.isGameRoom
  ? `- NEVER say "we" or "us" about either team. Both fanbases are here.`
  : `- Say "we" and "us". You are on this team.`}
- Never mention that they are alone, that the room is new, or that friends can
  be invited. That is the app's job and it reads as desperate coming from you.
- No greeting, no emoji, no markdown.`;

    const openUser = `FACTS — the only things you may reference:\n${bits.join("\n")}`;
    // The "answer" job, not "recap". Recap runs with thinking ON and a 4,000
    // token budget shared between thinking and output, because it is
    // synthesizing a whole game and a whole room. An opener is two sentences —
    // on that job the model spent its budget reasoning and came back with no
    // text at all, which surfaced as four rooms silently skipped.
    const res = await callLlm({ job: "answer", system: openSystem, user: openUser });
    return res.text?.trim() || null;
  }

  const humanLines = input.transcript.filter((l) => !l.isBot);
  const hasGame = input.gameBeats.length > 0 ||
    (input.game && input.game.state !== "pregame");
  const hasNews = input.newsBeats.length > 0;

  // Nothing happened in any lane — post nothing. A recap that says "nothing
  // happened" is worse than silence and trains people to ignore the Coach.
  if (humanLines.length === 0 && !hasGame && !hasNews) return null;

  const system = `${coachCharacter(ctx)}

${ATTRIBUTION_RULES}

You are writing the catch-up post for people who were not here. Format, exactly:

**The game** — one or two sentences on what actually happened. Score, the moments that mattered.
**The room** — one to three sentences on what your people were doing: who was locked in, who was melting down, what got argued about, anything anyone floated for later.

RULES SPECIFIC TO THIS POST:
- Skip a section entirely if there is nothing real to put in it. Never write "nothing happened" or "it was quiet".
- Names make this work. Use them — accurately.
- Keep the whole thing under 90 words. This is a catch-up, not a column.
- If somebody floated a plan (a bar, a time, a watch party), mention it AS a floated plan and say who raised it.
- Do not list the chip standings unless something notable moved.
- PLAIN TEXT ONLY. No markdown, no **bold**, no headers, no bullet characters. The chat bubble renders exactly what you write, so "**The game**" appears on screen with the asterisks showing.
- The record in the facts is the team's real season record. Use it as given or not at all. Never compute, adjust or guess a record.
- LEADERS are the spine of a game recap. Lead with who actually did it and their line, not with adjectives. "Barkley 18 carries, 96 yards" beats "the run game showed up".
- A HALFTIME recap is written at the break, with the game UNFINISHED. Never call it a result, never say who won, and never write it in the past tense as though it ended. Say where it stands and what has to happen after the break.`;

  const parts = [
    gameBlock(input.game, input.record, null),
    beatsBlock("GAME BEATS", input.gameBeats),
    input.statLines?.length
      ? `LEADERS\n${input.statLines.map((l) => `- ${l}`).join("\n")}`
      : "",
    beatsBlock("TEAM NEWS", input.newsBeats),
    transcriptBlock(input.transcript),
    ledgerBlock(input.ledger),
  ];

  const user = `Room: "${ctx.huddleName}" (${ctx.memberCount} members)
Recap type: ${input.kind}

FACTS — the only things you may reference:
${parts.filter(Boolean).join("\n\n")}`;

  const res = await callLlm({ job: "recap", system, user });
  return res.text;
}
