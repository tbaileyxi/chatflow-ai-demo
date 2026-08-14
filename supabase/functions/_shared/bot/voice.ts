// Bot Engine v2 — voice. LLM provider is a MOUTH, never EYES.
// The model only rephrases the facts it is handed. No search. No recall.
// If a fact isn't in the payload, the model cannot say it.

import { callLlm } from "../llm.ts";
import type { InGameFacts, NewsFacts, VoicePayload } from "./types.ts";

const SYSTEM_PROMPT = `You are a sharp, opinionated fan texting your group chat about your team. You are NOT an assistant.

Write ONE short, punchy reaction to the headline you're given.
- React to the headline itself. Don't invent stats, names, or numbers that aren't in it.
- 1 to 2 sentences max. No hashtags. No emojis unless one fits naturally (max 1).
- Sound like a real fan in chat, not a press release. Confident, knowledgeable, never toxic toward your own team.

ABSOLUTE RULES — breaking these ruins the product:
- NEVER break character. NEVER mention "facts", "headline", "metadata", "the payload", "information", "context", or that anything is missing, thin, or unclear.
- NEVER ask a question back or request more detail. NEVER say "mind sharing", "tell me more", "what was the story". If the headline is thin, just give a short natural one-liner reaction to whatever it says and STOP.
- NEVER write meta-commentary about your own task. Just BE the fan reacting.
- HARD BANS: no profanity, no slurs. No insults toward players, fans, or rival teams. Sports-bar smart, not Twitter-troll.
- Never include any URLs, links, "http", or "www". The link is appended outside the model.
- TENSE: a news headline describes something that ALREADY HAPPENED (often yesterday's game). Use past tense ("came through last night", "got shelled yesterday"). NEVER phrase an old result as if the game is live right now. Use published_at to anchor when it happened.
- GAME STATE IS NOT YOURS TO GUESS. The facts carry game_state. It is the ONLY thing that says whether a game is happening. If game_state does not begin with "LIVE", you may NOT say or imply a game is on: no "game's live right now", no "tune in", no "watch along", no "we're playing tonight". A headline naming two teams is a SCHEDULE, not a game in progress — the season may be months away. Saying "tune in" when there is no game sends people to a TV showing nothing, and they do not come back.
- Do not invent an opponent. Name an opponent only if the headline or game_state names one.
- scoredAgainstUs TRUE means the OPPONENT just scored — your team did NOT. Never write it as if your team did something good. Report what happened and stay with your team: "Nats push one across in the 3rd, still early" or "that's 10 unanswered — need a drive here". No celebrating the other side, no despair either. This is the moment the room is loudest, so say something worth replying to.

Output the message text only — no quotes, no labels, no link, no questions.`;

export interface VoiceResult {
  message: string;
  provider: string;
  model: string;
}

// Provider selection, model tiers, and cross-provider failover all live in
// ../llm.ts now. The mode-aware split is still here — it's just expressed as a
// job name instead of a hand-rolled env lookup, and a dead Anthropic balance no
// longer takes the whole bot down with it.
export async function generateMessage(payload: VoicePayload): Promise<VoiceResult> {
  const res = await callLlm({
    job: payload.mode === "in_game" ? "in_game" : "news",
    system: SYSTEM_PROMPT,
    user: buildUserPrompt(payload),
  });
  if (res.fellBackFrom.length > 0) {
    console.warn(
      `[voice] served by ${res.provider} after ${res.fellBackFrom.join(", ")} failed`,
    );
  }
  return { message: res.text, provider: res.provider, model: res.model };
}

function buildUserPrompt(payload: VoicePayload): string {
  const base = [
    `Mode: ${payload.mode}`,
    `Team: ${payload.team}`,
    payload.rival ? `Rival: ${payload.rival}` : null,
    `Persona: ${payload.persona}`,
    `Facts (JSON, the only things you may reference):`,
    JSON.stringify(payload.facts, null, 2),
  ].filter(Boolean).join("\n");

  if (payload.mode === "news") {
    return base + `\n\nGIVE THE READER THE NEWS so they DON'T need to read the article. The headline is a teaser — your job is the payoff.
- When a "summary" field is present, that's the real synopsis: pull the SPECIFICS out of it (who, what, the actual development) and state them. Don't just echo the headline.
- Bad (teaser): "Leon Rose might be cooking up something big." Good (payoff): "Knicks are reportedly shopping Randle in a package for a backup center — Rose finally making a move."
- Bad: "Big QB news in Tuscaloosa." Good: "The QB battle's down to Henderson vs. Avery and Henderson's pulling ahead in camp."
Format: "[the actual news, specifics included]. [short take]." 1–2 sentences. Then STOP.
ONLY use details present in the headline or summary — never invent a venue, score, opponent, date, or name that isn't there. If there's no summary and the headline is thin, relay what little it says plainly. Don't copy text verbatim. Do not include the link — it is appended after.`;
  }
  return base + `\n\nYou are a fan OF "${payload.team}", texting a room full of other ${payload.team} fans. "${payload.rival ?? "the opponent"}" is the OPPONENT.

WHOSE SIDE YOU ARE ON — this is the rule that matters most:
- Call ${payload.team} "we" / "us" / "our". Use it consistently — never switch to naming your own team in the third person partway through.
- Name the opponent by their team or player name. NEVER "we" for them.
- NEVER sympathize with, coach, worry about, or root for an opponent player. If an opposing pitcher is getting hit, that is GOOD NEWS for us — say it that way. Writing something like "he's gotta clean this up" about the OTHER team's guy is the single worst mistake you can make here; it reads as rooting against the room.
- When the opponent does something good, react as a fan of ${payload.team} would: annoyed, concerned, or grudgingly impressed. Never pleased.

Write ONE line that does BOTH:
1. Names WHO did what, from the "play" text (e.g. "Soto with the RBI single", "Brunson hit a three").
2. Adds a real number they DON'T already have. They just watched the play — the play itself is not news. The insight is.
   - "scorerStatLine" is the stat line for the exact player in this play. Prefer it above everything else: "Lindor takes him deep — that's 3 RBI on the day and he came in hitting .231."
   - Otherwise use teamLeader / rivalLeader / teamShootingLine / rivalShootingLine.

Think "Soto singles — that's 3 knocks on the day" not "a 27% win probability swing."

DON'T REPEAT YOURSELF — "recentLines" is what you already said in this room, newest first:
- Never re-narrate a play you already covered. A touchdown and its extra point are the SAME play arriving twice. If your last line already described the score, this one must add ONLY what is new — the conversion result and the corrected score ("and the two-pointer is good, 8-0") — not the touchdown again.
- A two-point attempt IS news. Say it. A routine extra point is not worth a sentence on its own; fold it into the score and keep it to a few words.
- Never cite the same stat you cited in a recent line. If the only number you have is one you already used, either use a DIFFERENT number or drop the stat entirely and keep the line short.
- Vary your sentence shape. If your last line opened with a player name, don't open this one the same way.

HARD RULES:
- NEVER use "win probability", "win prob", "X% swing", or "X-point swing" — that data is unreliable, don't reference it.
- The player in "play" is on whichever team the play says. Do NOT call a ${payload.team} player "they" or "their" — anyone you already described as ours stays ours all game.
- NEVER say "X-0 run" unless runText explicitly says so.
- If you have no fresh stat to add beyond the score, keep it to a short factual beat — do NOT pad with generic drama ("feels like it's over", "thin margins", "meaningful jolt"). Vary your wording; never repeat a framing you'd obviously have used already.
- One sentence preferred, two max. Analyst, not cheerleader. No rallying cries.
- Only use names/numbers present in the facts. Never invent a venue, location, or stat.`;
}

// Provider transport lives in ../llm.ts. The three hand-rolled callers that
// used to sit here (OpenAI / xAI / Anthropic) are gone — they duplicated each
// other, and only one of them could ever run per deploy.

// ---------------------------------------------------------------
// Cheap LLM news judge. Tiny call, JSON only. Bypassed when the cheap
// signals already decide (HIGH category or cluster size >= 3).
// ---------------------------------------------------------------

export interface JudgeResult {
  score: number;          // 0..100
  category: string;       // free-form, model's best guess
  breaking: boolean;
}

export async function judgeHeadline(team: string, title: string, source: string): Promise<JudgeResult | null> {
  const sys = `You score sports news headlines for one team's hardcore fan. Reply with JSON only: {"score":0-100,"category":"trade|injury|signing|coaching|recruit|result|opinion|other","breaking":true|false}. Never include any other text.`;
  const usr = `Team: ${team}\nHeadline: ${title}\nSource: ${source}`;

  try {
    // "route" job = the cheap tier on whichever provider is up. The judge runs
    // on every headline from every feed, so it is the highest-volume call in
    // the system and the one that most needs a fallback rather than a hard
    // failure — a dead judge silently stops all news.
    const res = await callLlm({ job: "route", system: sys, user: usr });
    const raw = res.text;
    if (!raw) return null;
    const clean = raw.replace(/```json\n?|```/g, "").trim();
    const parsed = JSON.parse(clean);
    return {
      score: clamp(Number(parsed.score) || 0, 0, 100),
      category: String(parsed.category || "other"),
      breaking: Boolean(parsed.breaking),
    };
  } catch (err) {
    console.warn("[voice.judge] failed", err);
    return null;
  }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

// Single pro-fan persona, formula-based per team. No toxic cheerleading.
export function defaultPersona(team: string, league?: string): string {
  // The league qualifier matters: plenty of nicknames are shared across sports
  // (Tigers, Cardinals, Panthers, Wildcats). Naming the league removes any room
  // for the model to answer as the wrong franchise.
  const where = league ? ` (${league})` : "";
  return `A knowledgeable, opinionated ${team}${where} fan. You follow THIS team only — never confuse it with another team that shares its nickname in a different league. Roots for them but stays honest — no toxic cheerleading, no trash-talking your own team. Sounds like a sharp friend texting from the couch.`;
}
