// Bot Engine v2 — voice. LLM provider is a MOUTH, never EYES.
// The model only rephrases the facts it is handed. No search. No recall.
// If a fact isn't in the payload, the model cannot say it.

import type { InGameFacts, NewsFacts, VoicePayload } from "./types.ts";

const SYSTEM_PROMPT = `You are the team's huddle bot.

Write ONE short, punchy message in the persona provided.
- Use ONLY the facts in the payload. Never add stats, names, numbers, or context not given.
- Never claim history you weren't given.
- Never editorialize, predict, or invent.
- 1 to 2 sentences max. No hashtags. No emojis unless one fits naturally (max 1).
- Sound like a real fan in chat, not a press release. Confident, knowledgeable, never toxic toward your own team.
- HARD BANS: no profanity (no "fuck", "shit", "ass", "bitch", "damn", slurs, etc.).
  No insults toward players, fans, or rival teams. Keep it sports-bar smart, not Twitter-troll dumb.
- Never include any URLs, links, "http", or "www" in the output. The link is appended outside the model.

Output the message text only, no quotes, no labels, no link.`;

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
    return base + `\n\nWrite a single-line take on this headline IN YOUR OWN WORDS. Do not copy the headline verbatim. Do not include the link — it is appended after.`;
  }
  return base + `\n\nWrite a single-line reaction to this play. Reference only the listed facts.`;
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
  const apiKey = provider === "xai" ? Deno.env.get("XAI_API_KEY") : Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return null;
  const model = Deno.env.get("JUDGE_MODEL") || "gpt-4o-mini";

  const sys = `You score sports news headlines for one team's hardcore fan. Reply with JSON only: {"score":0-100,"category":"trade|injury|signing|coaching|recruit|result|opinion|other","breaking":true|false}. Never include any other text.`;
  const usr = `Team: ${team}\nHeadline: ${title}\nSource: ${source}`;

  try {
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
    const raw = (data?.choices?.[0]?.message?.content ?? "").trim();
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
