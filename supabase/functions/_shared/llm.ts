// Unified LLM caller with per-job model assignment and cross-provider failover.
//
// WHY THIS EXISTS: the bot used to read LLM_PROVIDER once and call exactly one
// provider. When the Anthropic balance hit zero in June 2026 every path died at
// once and recovery needed a human to notice and change a secret by hand. Three
// providers were fully wired and dormant the entire time.
//
// Now every call walks a chain: primary first, then the rest. A 429, a 401, an
// empty balance, or a 5xx moves to the next provider instead of dropping the
// post. Same model tier where possible, so the voice barely shifts.

export type LlmJob =
  | "news"      // one-line news reaction. High volume, cheap.
  | "in_game"   // live play reaction. Needs to digest real stats.
  | "route"     // classify a coach question into a lane. Tiny.
  | "answer"    // answer a coach question from retrieved facts. Latency-sensitive.
  | "recap";    // the postgame / daily recap. Low volume, highest visibility.

export type Provider = "anthropic" | "openai" | "xai";

// Per-job model per provider. Every entry is env-overridable so a model swap is
// a secret change, not a deploy.
//
// Anthropic tiers (as of Aug 2026):
//   claude-haiku-4-5  $1/$5  per Mtok — summarizing + classifying
//   claude-sonnet-5   $2/$10 per Mtok (intro thru 2026-08-31, then $3/$15)
//   claude-opus-5     $5/$25 per Mtok — reserved for the recap, see below
//
// The recap gets Opus because it is the one artifact that is pushed to everyone
// and actually read: one call per room per game, versus hundreds of in-game
// lines. Highest visibility per token spent in the whole product.
const MODELS: Record<LlmJob, Record<Provider, string>> = {
  news:    { anthropic: "claude-haiku-4-5", openai: "gpt-4o-mini", xai: "grok-2-latest" },
  route:   { anthropic: "claude-haiku-4-5", openai: "gpt-4o-mini", xai: "grok-2-latest" },
  in_game: { anthropic: "claude-sonnet-5",  openai: "gpt-4o",      xai: "grok-2-latest" },
  answer:  { anthropic: "claude-sonnet-5",  openai: "gpt-4o",      xai: "grok-2-latest" },
  recap:   { anthropic: "claude-opus-5",    openai: "gpt-4o",      xai: "grok-2-latest" },
};

// First name that resolves wins. JUDGE_MODEL is listed for `route` so the
// existing production secret keeps working after the judge moved onto this
// path — dropping it would have been a silent config regression.
const ENV_OVERRIDE: Record<LlmJob, string[]> = {
  news:    ["LLM_MODEL"],
  route:   ["LLM_MODEL_ROUTE", "JUDGE_MODEL"],
  in_game: ["LLM_MODEL_INGAME"],
  answer:  ["LLM_MODEL_ANSWER"],
  recap:   ["LLM_MODEL_RECAP"],
};

// Thinking budget per job. Claude Opus 5 / Sonnet 5 run adaptive thinking BY
// DEFAULT when `thinking` is omitted, and max_tokens caps thinking + response
// text TOGETHER. A 256-token cap on a thinking model truncates the answer
// before it starts, so short-output jobs must disable thinking explicitly.
//
// The recap is the exception: it is synthesizing a whole game and a whole room,
// so it keeps thinking on and gets the headroom to use it.
const THINKS: Record<LlmJob, boolean> = {
  news: false, route: false, in_game: false, answer: false, recap: true,
};

const MAX_TOKENS: Record<LlmJob, number> = {
  news: 300, route: 120, in_game: 300, answer: 700, recap: 4000,
};

export interface LlmResult {
  text: string;
  provider: Provider;
  model: string;
  /** Providers that failed before this one succeeded. Empty on a clean call. */
  fellBackFrom: Provider[];
}

export interface LlmRequest {
  job: LlmJob;
  system: string;
  user: string;
  /** Override the per-job token cap (e.g. a longer recap for a busy room). */
  maxTokens?: number;
}

function modelFor(job: LlmJob, provider: Provider): string {
  // The env override applies to the PRIMARY provider only. A fallback provider
  // uses its own table entry — pointing an Anthropic model id at OpenAI is a
  // guaranteed 404, and that is exactly the moment we cannot afford one.
  const primary = primaryProvider();
  if (provider === primary) {
    for (const name of ENV_OVERRIDE[job]) {
      const override = Deno.env.get(name);
      if (override) return override;
    }
  }
  return MODELS[job][provider];
}

export function primaryProvider(): Provider {
  const raw = (Deno.env.get("LLM_PROVIDER") || "anthropic").toLowerCase();
  if (raw === "openai" || raw === "xai" || raw === "anthropic") return raw;
  return "anthropic";
}

/** Providers that actually have a key configured, primary first. */
function providerChain(): Provider[] {
  const keyed: Record<Provider, boolean> = {
    anthropic: !!Deno.env.get("ANTHROPIC_API_KEY"),
    openai: !!Deno.env.get("OPENAI_API_KEY"),
    xai: !!Deno.env.get("XAI_API_KEY"),
  };
  const primary = primaryProvider();
  const order: Provider[] = [primary, "anthropic", "openai", "xai"];
  const seen = new Set<Provider>();
  return order.filter((p) => {
    if (seen.has(p) || !keyed[p]) return false;
    seen.add(p);
    return true;
  });
}

/**
 * Should we give up on this provider and try the next one?
 *
 * 401/402/403 = key revoked or balance empty — the June outage. Never retryable
 * on the same provider, always worth trying the next.
 * 429 = rate limited. 5xx = provider is down. Both worth moving on.
 */
function shouldFailOver(status: number): boolean {
  return status === 401 || status === 402 || status === 403 ||
         status === 429 || status >= 500;
}

export async function callLlm(req: LlmRequest): Promise<LlmResult> {
  const chain = providerChain();
  if (chain.length === 0) throw new Error("no LLM provider key configured");

  const maxTokens = req.maxTokens ?? MAX_TOKENS[req.job];
  const fellBackFrom: Provider[] = [];
  let lastErr: Error | null = null;

  for (const provider of chain) {
    const model = modelFor(req.job, provider);
    try {
      const text = await callOne(provider, model, req, maxTokens);
      if (!text.trim()) throw new Error(`${provider} returned empty text`);
      return { text: text.trim(), provider, model, fellBackFrom };
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      console.warn(`[llm] ${provider}/${model} failed for job=${req.job}: ${lastErr.message}`);
      fellBackFrom.push(provider);
      // Fall through to the next provider in the chain.
    }
  }

  throw new Error(
    `all providers failed for job=${req.job} (tried ${fellBackFrom.join(", ")}): ${lastErr?.message}`,
  );
}

async function callOne(
  provider: Provider,
  model: string,
  req: LlmRequest,
  maxTokens: number,
): Promise<string> {
  if (provider === "anthropic") return callAnthropic(model, req, maxTokens);
  if (provider === "xai") return callOpenAiShape(
    "https://api.x.ai/v1/chat/completions",
    Deno.env.get("XAI_API_KEY")!,
    model, req, maxTokens,
  );
  return callOpenAiShape(
    "https://api.openai.com/v1/chat/completions",
    Deno.env.get("OPENAI_API_KEY")!,
    model, req, maxTokens,
  );
}

/**
 * True for Claude models that run adaptive thinking when `thinking` is omitted.
 * Everything before the 5 family is thinking-off by default.
 */
function thinkingOnByDefault(model: string): boolean {
  return /^claude-(opus-5|sonnet-5|fable-5|mythos-5)/.test(model);
}

async function callAnthropic(
  model: string,
  req: LlmRequest,
  maxTokens: number,
): Promise<string> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const body: Record<string, unknown> = {
    model,
    max_tokens: maxTokens,
    system: req.system,
    messages: [{ role: "user", content: req.user }],
  };
  // Only send `thinking` where it actually changes anything.
  //
  // On Claude 5-family models (Opus 5, Sonnet 5, Fable 5) adaptive thinking is
  // ON by default and max_tokens caps thinking + response text TOGETHER, so a
  // 300-token cap would be consumed before any visible text is produced. Those
  // need an explicit opt-out.
  //
  // On older models (haiku-4-5, sonnet-4-6) omitting the field ALREADY means no
  // thinking, so sending the parameter buys nothing and risks a 400 on a model
  // that may not accept that shape. The news judge is the highest-volume call in
  // the system — not worth gambling it on an untested parameter.
  if (!THINKS[req.job] && thinkingOnByDefault(model)) {
    body.thinking = { type: "disabled" };
  }

  const doFetch = () =>
    fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

  let res = await doFetch();
  // One in-provider retry on a plain rate limit before we burn the fallback.
  if (res.status === 429) {
    const retryAfter = Number(res.headers.get("retry-after")) || 10;
    await new Promise((r) => setTimeout(r, Math.min(retryAfter, 15) * 1000));
    res = await doFetch();
  }
  if (!res.ok) {
    const txt = await res.text();
    const err = new Error(`Anthropic ${res.status}: ${txt.slice(0, 200)}`);
    if (shouldFailOver(res.status)) throw err;
    throw err;
  }

  const data = await res.json();
  // A refusal returns HTTP 200 with empty content — treat it as a failure so
  // the chain moves on rather than posting nothing.
  if (data?.stop_reason === "refusal") {
    throw new Error("Anthropic declined the request");
  }
  return (data?.content ?? [])
    .filter((b: { type: string }) => b.type === "text")
    .map((b: { text: string }) => b.text)
    .join("");
}

async function callOpenAiShape(
  endpoint: string,
  apiKey: string,
  model: string,
  req: LlmRequest,
  maxTokens: number,
): Promise<string> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: req.system },
        { role: "user", content: req.user },
      ],
      temperature: 0.6,
      max_tokens: maxTokens,
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`${endpoint.includes("x.ai") ? "xAI" : "OpenAI"} ${res.status}: ${txt.slice(0, 200)}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? "";
}
