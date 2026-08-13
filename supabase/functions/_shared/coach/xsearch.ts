// Live X search for the Coach, via xAI's Agent Tools API.
//
// WHY THIS SHAPE:
// The Coach knows only what is in its FACTS block — the database. Ask it "what
// happened at training camp today" and it has nothing, which before now
// produced either a deflection or an invention.
//
// The obvious fix — let a model with world knowledge answer freely — is a trap.
// Probed 2026-08-13: grok-4.3 asked the same question with NO search returned a
// confident, detailed report naming Deshaun Watson in 11-on-11 drills, with
// `num_sources_used: 0`. Entirely fabricated. That is the same failure that put
// a fake "Lions 114 - Browns 110" in a Browns room.
//
// So search results are treated as FACTS, not as licence. The text lands in the
// FACTS block and the "only say what is in FACTS" rule stays exactly as it was.
//
// API notes, all verified live rather than assumed:
//   - /v1/chat/completions `search_parameters` is DEPRECATED -> HTTP 410.
//   - chat `tools[].type` accepts only `function` or `live_search`, and
//     live_search additionally requires a `sources` field.
//   - /v1/responses with tools:[{type:"x_search"}] works, runs real tool calls,
//     and returns inline citations like
//     [[1]](https://x.com/ScottPetrak/status/2087918064654295368).
//
// Citations are kept: they are the post URLs the X API would need to fetch a
// photo later, which is the second half of the plan.

const XAI_RESPONSES = "https://api.x.ai/v1/responses";

export interface XSearchResult {
  text: string;                 // the model's synthesis, citations stripped
  citations: string[];          // x.com post URLs, in order of appearance
  ok: boolean;
  tokens: number;
}

// Pull markdown-style [[n]](url) citations out, keeping the prose readable.
function splitCitations(raw: string): { text: string; citations: string[] } {
  const citations: string[] = [];
  const text = raw.replace(/\[\[\d+\]\]\((https?:\/\/[^\s)]+)\)/g, (_m, url) => {
    if (!citations.includes(url)) citations.push(url);
    return "";
  }).replace(/[ \t]{2,}/g, " ").trim();
  return { text, citations };
}

export async function searchX(
  query: string,
  opts: { maxTokens?: number; model?: string } = {},
): Promise<XSearchResult> {
  const key = Deno.env.get("XAI_API_KEY");
  const empty: XSearchResult = { text: "", citations: [], ok: false, tokens: 0 };
  if (!key) return empty;

  try {
    const res = await fetch(XAI_RESPONSES, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: opts.model ?? Deno.env.get("XSEARCH_MODEL") ?? "grok-4.3",
        // Ask for reporting, not opinion. The Coach supplies the voice; this
        // call only needs to come back with what was actually said.
        input:
          `${query}\n\nReport only what you can find posted in the last 48 hours. ` +
          `Be specific: names, numbers, who said it. If you find nothing recent, ` +
          `say exactly "NOTHING RECENT" and stop.`,
        tools: [{ type: "x_search" }],
        max_output_tokens: opts.maxTokens ?? 700,
      }),
    });
    if (!res.ok) return empty;
    const j = await res.json();

    const raw: string = j?.output_text ??
      (Array.isArray(j?.output)
        ? j.output
            .flatMap((o: any) => (o?.content ?? []).map((c: any) => c?.text))
            .filter(Boolean).join(" ")
        : "");
    if (!raw) return empty;

    const { text, citations } = splitCitations(raw);
    // An explicit miss is a real answer — it stops the Coach filling the gap.
    if (/NOTHING RECENT/i.test(text)) {
      return { text: "", citations: [], ok: true, tokens: j?.usage?.total_tokens ?? 0 };
    }
    return { text, citations, ok: true, tokens: j?.usage?.total_tokens ?? 0 };
  } catch {
    return empty;
  }
}
