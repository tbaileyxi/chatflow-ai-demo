// Coach answering + recap composition.
//
// Everything here hands the model a payload built by retrieve.ts and asks it to
// SHAPE that payload. No search, no recall. The failure modes for a chat-aware
// bot are different from the news bot's: it will not invent a message, but it
// WILL misattribute one, over-conclude from banter, or flatten a joke into a
// fact. Those three are what the prompts below are built to prevent.

import { callLlm } from "../llm.ts";
import type {
  GameBeat,
  GameSnapshot,
  HuddleContext,
  LedgerRow,
  TranscriptLine,
} from "./retrieve.ts";

// ---------------------------------------------------------------------------
// Router — which facts does this question need?
// ---------------------------------------------------------------------------

export type Lane =
  | "room"        // what was said in here
  | "ledger"      // who's up/down, records, head-to-head
  | "game"        // score, plays, schedule, standings
  | "mixed"       // recap-shaped: needs both room and game
  | "unsupported"; // roster, player bios, nationality — no grounding exists

const ROUTE_SYSTEM =
  `You classify one question asked inside a sports group chat. Reply with ONE word, nothing else.

room        - about what people in the chat said or did. "what did I miss", "what'd Brett say", "where are we meeting"
ledger      - about the group's picks, records, chips, or who is winning/losing between members
game        - about the actual game or team: score, plays, schedule, record, standings, who won
mixed       - a broad catch-up that needs both the chat and the game
unsupported - needs a roster, player biography, nationality, height/weight, contract, or a full player list

Reply with exactly one of: room, ledger, game, mixed, unsupported`;

export async function routeQuestion(question: string): Promise<Lane> {
  try {
    const res = await callLlm({
      job: "route",
      system: ROUTE_SYSTEM,
      user: question.slice(0, 500),
    });
    const raw = res.text.toLowerCase().replace(/[^a-z]/g, "");
    if (["room", "ledger", "game", "mixed", "unsupported"].includes(raw)) {
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
  return `You are the Coach: a sharp, opinionated ${team}${league} fan who lives in this group chat. You are NOT an assistant and you never sound like one.

WHOSE SIDE YOU ARE ON
- ${team} is "we" / "us" / "our". Never switch to third person about your own team.
- Opponents get named. Never "we" for them.

HARD RULES — breaking these ruins the product:
- Everything you say must come from the FACTS block. If a fact is not in there, you do not know it. No exceptions.
- NEVER invent a name, number, score, date, venue, or quote.
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

function gameBlock(g: GameSnapshot | null, record: { wins: number; losses: number } | null, standings: string | null): string {
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
  if (record) parts.push(`SEASON RECORD: ${record.wins}-${record.losses}`);
  if (standings) parts.push(`STANDINGS: ${standings}`);
  return parts.length > 0 ? parts.join("\n") : "GAME: (no game data available)";
}

// ---------------------------------------------------------------------------
// Answering a direct question.
// ---------------------------------------------------------------------------

export interface AnswerInput {
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
  standings: string | null;
}

/**
 * The refusal for questions we have no grounding for.
 *
 * Written to keep the Coach's edges VISIBLE rather than pretending. A bot that
 * says "I've got the box score and what's been said in here, not the roster" is
 * more trustworthy than one that confidently lists seven names, three of them
 * wrong, to a room full of people who would instantly know.
 */
export function unsupportedReply(ctx: HuddleContext): string {
  const team = ctx.teamName ?? "the team";
  return `That one's outside what I've got. I'm working off the live game feed, ${team}'s news, and everything said in this room — no roster sheets or player bios. Ask me what happened in here or what's going on in the game and I'm all over it.`;
}

export async function answerQuestion(input: AnswerInput): Promise<string> {
  const { ctx, lane } = input;

  if (lane === "unsupported") return unsupportedReply(ctx);

  const facts: string[] = [];
  if (lane === "room" || lane === "mixed") facts.push(transcriptBlock(input.transcript));
  if (lane === "ledger") {
    facts.push(ledgerBlock(input.ledger));
    // A ledger question in a live room usually wants the game as texture too.
    facts.push(gameBlock(input.game, input.record, input.standings));
  }
  if (lane === "game" || lane === "mixed") {
    facts.push(gameBlock(input.game, input.record, input.standings));
    facts.push(beatsBlock("GAME BEATS", input.gameBeats));
    facts.push(beatsBlock("TEAM NEWS", input.newsBeats));
  }
  if (lane === "mixed") facts.push(ledgerBlock(input.ledger));

  const system = `${coachCharacter(ctx)}

${ATTRIBUTION_RULES}

ANSWERING:
- Answer the question directly, in 1-4 sentences. No preamble, no "great question".
- If the FACTS do not contain the answer, say plainly what you do have instead. Never guess and never pad.
- Talk like you are texting the room, not writing a report. No headers, no bullet lists unless you are genuinely listing 3+ things.`;

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
  kind: "postgame" | "daily";
  transcript: TranscriptLine[];
  gameBeats: GameBeat[];
  newsBeats: GameBeat[];
  ledger: LedgerRow[];
  game: GameSnapshot | null;
  record: { wins: number; losses: number } | null;
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
- Do not list the chip standings unless something notable moved.`;

  const parts = [
    gameBlock(input.game, input.record, null),
    beatsBlock("GAME BEATS", input.gameBeats),
    beatsBlock("TEAM NEWS", input.newsBeats),
    transcriptBlock(input.transcript),
    ledgerBlock(input.ledger),
  ];

  const user = `Room: "${ctx.huddleName}" (${ctx.memberCount} members)
Recap type: ${input.kind}

FACTS — the only things you may reference:
${parts.join("\n\n")}`;

  const res = await callLlm({ job: "recap", system, user });
  return res.text;
}
