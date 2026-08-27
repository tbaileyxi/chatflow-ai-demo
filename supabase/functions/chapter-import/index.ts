// chapter-import — push scraped chapters straight into chapter_leads.
//
// Replaces the CSV sneakernet. The scraper knew the data and the database
// wanted the data, and the human in between existed only because push.py runs
// on a laptop with no Supabase credentials. Now it POSTs here instead.
//
// The important property is that this is SAFE TO RE-RUN. A CSV import through
// the Table Editor replaces whole rows, so re-importing after a re-scrape
// silently resets `status`, `emailed`, `sequence_step`, `bounced` and
// `unsubscribed` — i.e. it forgets who you already contacted and who asked you
// to stop. Emailing an unsubscribed lead again is the exact thing that gets a
// domain blocked.
//
// This upserts on `dedupe_key` and only ever writes SCRAPED columns. The
// sequence columns are absent from the payload, so Postgres leaves them alone
// on conflict. Re-scrape as often as you like.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders, json, requireAdmin } from "../_shared/outreach.ts";

// Exactly the columns push.py emits. Anything else in a submitted row is
// dropped rather than trusted — a scraper bug must not be able to write to a
// column it has no business touching.
const SCRAPED_COLUMNS = [
  "source", "source_url", "org", "org_type", "chapter_name",
  "city", "state", "zip", "country", "venue", "address",
  "member_count", "year_established",
  "leader_name", "leader_role", "first_name",
  "email", "phone", "facebook", "instagram", "twitter", "website",
  "contact_channel", "score", "dedupe_key",
] as const;

const NEVER_WRITE = [
  "status", "emailed", "sequence_step", "bounced", "unsubscribed",
  "last_touch", "last_error",
];

const CHUNK = 500;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let supabase;
  try {
    supabase = await requireAdmin(req);
  } catch (resp) {
    if (resp instanceof Response) return resp;
    return json({ error: resp instanceof Error ? resp.message : "Auth failed" }, 401);
  }

  try {
    const { rows = [], dryRun = false } = await req.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      return json({ error: "rows must be a non-empty array" }, 400);
    }

    const clean: Record<string, unknown>[] = [];
    const skipped: string[] = [];
    for (const raw of rows) {
      if (!raw || typeof raw !== "object") continue;
      // dedupe_key is the conflict target — without it a row would insert a
      // duplicate on every run instead of updating.
      if (!raw.dedupe_key) {
        skipped.push(String(raw.chapter_name ?? "(unnamed)"));
        continue;
      }
      const row: Record<string, unknown> = {};
      for (const col of SCRAPED_COLUMNS) {
        if (raw[col] !== undefined && raw[col] !== "") row[col] = raw[col];
      }
      clean.push(row);
    }

    if (dryRun) {
      return json({
        dryRun: true,
        wouldUpsert: clean.length,
        skippedNoDedupeKey: skipped.length,
        skipped: skipped.slice(0, 20),
        protectedColumns: NEVER_WRITE,
      });
    }

    let upserted = 0;
    const errors: string[] = [];
    for (let i = 0; i < clean.length; i += CHUNK) {
      const batch = clean.slice(i, i + CHUNK);
      const { error } = await supabase
        .from("chapter_leads")
        .upsert(batch, { onConflict: "dedupe_key", ignoreDuplicates: false });
      if (error) errors.push(`rows ${i}-${i + batch.length}: ${error.message}`);
      else upserted += batch.length;
    }

    return json({
      upserted,
      skippedNoDedupeKey: skipped.length,
      errors,
      note: "Sequence columns (status, emailed, sequence_step, bounced, unsubscribed) were not written.",
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
