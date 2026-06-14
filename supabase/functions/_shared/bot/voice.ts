// Bot Engine v2 — voice. LLM provider is a MOUTH, never EYES.
// The model only rephrases the facts it is handed. No search. No recall.
// If a fact isn't in the payload, the model cannot say it.

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

Output the message text only — no quotes, no labels, no link, no questions.`;

export interface VoiceResult {
  message: string;
  provider: string;
  model: string;
}

export async function generateMessage(payload: VoicePayload): Promise<VoiceResult> {
  const provider = (Deno.env.get("LLM_PROVIDER") || "openai").toLowerCase();
  const userBlock = buildUserPrompt(payload);

  if (provider === "xai") {
    return callXai(userBlock);
  }
  if (provider === "anthropic") {
    // Mode-aware model split: cheap/fast for news one-liners, a smarter
    // model for in-game digestion (scores, runs, momentum — the "smart bot").
    const model = payload.mode === "in_game"
      ? Deno.env.get("LLM_MODEL_INGAME") || "claude-sonnet-4-6"
      : Deno.env.get("LLM_MODEL") || "claude-haiku-4-5";
    return callAnthropic(userBlock, model);
  }
  return callOpenAi(userBlock);
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
    return base + `\n\nWrite a single-line take on this headline IN YOUR OWN WORDS. Do not copy the headline verbatim.
DO NOT invent or assume ANY detail not literally in the headline — no venue, no stadium ("the Garden", "at home", "at MSG"), no city, no opponent, no score, no date, no player role. If the headline doesn't say it, you don't know it. React only to what the headline literally states. Do not include the link — it is appended after.`;
  }
  return base + `\n\nYou are a stats nerd, not a play-by-play announcer. The play already happened seconds ago — DO NOT narrate it as news ("X hits a three", "Y drains the free throw"). That reads stale and repetitive.

INSTEAD: lead with the most INTERESTING DATA the moment reveals. Good angles, pick ONE:
- a shooting/efficiency trend (teamShootingLine / rivalShootingLine), e.g. "Knicks heating up — 4-of-5 from three in the 3rd"
- a player's updated stat line (teamLeader / rivalLeader), e.g. "Harper's quietly got 21 and 5 dimes"
- the run / win-probability swing / margin context

Hard rules:
- Open with the stat or trend, NOT the player + verb of the play.
- Do NOT just restate a running point total you'd obviously have said already (no "Brunson up to 30" three times). If the only fact is a total you've likely mentioned, find a different angle (efficiency, rival, margin) or be brief.
- One sentence preferred, two max. Analyst, not cheerleader. No "we need a miracle", "let's go", rallying cries.
- Never invent a venue, location, or any number not in the facts.`;
}

// ---- OpenAI ------------------------------------------------------

async function callOpenAi(userPrompt: string): Promise<VoiceResult> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");
  const model = Deno.env.get("LLM_MODEL") || "gpt-4o-mini";
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user",   content: userPrompt },
      ],
      temperature: 0.6,
      max_tokens: 120,
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`OpenAI ${res.status}: ${txt.slice(0, 300)}`);
  }
  const data = await res.json();
  const message = (data?.choices?.[0]?.message?.content ?? "").trim();
  return { message, provider: "openai", model };
}

// ---- xAI (Grok) --------------------------------------------------

async function callXai(userPrompt: string): Promise<VoiceResult> {
  const apiKey = Deno.env.get("XAI_API_KEY");
  if (!apiKey) throw new Error("XAI_API_KEY not set");
  const model = Deno.env.get("LLM_MODEL") || "grok-2-latest";
  // NOTE: explicitly NO search_parameters — mouth, not eyes.
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user",   content: userPrompt },
      ],
      temperature: 0.6,
      max_tokens: 120,
      stream: false,
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`xAI ${res.status}: ${txt.slice(0, 300)}`);
  }
  const data = await res.json();
  const message = (data?.choices?.[0]?.message?.content ?? "").trim();
  return { message, provider: "xai", model };
}

// ---- Anthropic (Claude) ------------------------------------------

async function callAnthropic(userPrompt: string, model?: string): Promise<VoiceResult> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
  model = model || Deno.env.get("LLM_MODEL") || "claude-haiku-4-5";

  const doFetch = () =>
    fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 256,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

  let res = await doFetch();
  if (res.status === 429) {
    // Org RPM limit — back off once and retry rather than dropping the post.
    const retryAfter = Number(res.headers.get("retry-after")) || 20;
    await new Promise((r) => setTimeout(r, Math.min(retryAfter, 30) * 1000));
    res = await doFetch();
  }
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Anthropic ${res.status}: ${txt.slice(0, 300)}`);
  }
  const data = await res.json();
  const message = (data?.content ?? [])
    .filter((b: { type: string }) => b.type === "text")
    .map((b: { text: string }) => b.text)
    .join("")
    .trim();
  return { message, provider: "anthropic", model };
}

async function judgeViaAnthropic(sys: string, usr: string): Promise<string | null> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return null;
  const model = Deno.env.get("JUDGE_MODEL") || "claude-haiku-4-5";
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 60,
      system: sys,
      messages: [{ role: "user", content: usr }],
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return (data?.content ?? [])
    .filter((b: { type: string }) => b.type === "text")
    .map((b: { text: string }) => b.text)
    .join("")
    .trim();
}

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
  const provider = (Deno.env.get("LLM_PROVIDER") || "openai").toLowerCase();

  const sys = `You score sports news headlines for one team's hardcore fan. Reply with JSON only: {"score":0-100,"category":"trade|injury|signing|coaching|recruit|result|opinion|other","breaking":true|false}. Never include any other text.`;
  const usr = `Team: ${team}\nHeadline: ${title}\nSource: ${source}`;

  try {
    let raw: string | null;
    if (provider === "anthropic") {
      raw = await judgeViaAnthropic(sys, usr);
    } else {
      const apiKey = provider === "xai" ? Deno.env.get("XAI_API_KEY") : Deno.env.get("OPENAI_API_KEY");
      if (!apiKey) return null;
      const model = Deno.env.get("JUDGE_MODEL") || "gpt-4o-mini";
      const endpoint = provider === "xai"
        ? "https://api.x.ai/v1/chat/completions"
        : "https://api.openai.com/v1/chat/completions";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [{ role: "system", content: sys }, { role: "user", content: usr }],
          temperature: 0,
          max_tokens: 60,
        }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      raw = (data?.choices?.[0]?.message?.content ?? "").trim();
    }
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
export function defaultPersona(team: string): string {
  return `A knowledgeable, opinionated ${team} fan. Roots for them but stays honest — no toxic cheerleading, no trash-talking your own team. Sounds like a sharp friend texting from the couch.`;
}
