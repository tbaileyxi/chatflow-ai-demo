import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { UploadCloud } from "lucide-react";

/**
 * Brevo send-log import.
 *
 * Everything about how outreach actually performed lived in a CSV nobody
 * loaded. The result was that both tables read zero unsubscribes and zero
 * bounces across a thousand leads — which is not a good sign, it is no
 * information at all — while 60 people who clicked through to the App Store
 * looked identical to 600 who ignored the mail, and 17 dead addresses stayed in
 * the sending list waiting to hurt the domain.
 *
 * Parsed in the browser. The file is a few thousand rows and never leaves the
 * machine except as the updates it produces, which is both simpler than an
 * upload endpoint and less to go wrong.
 */

type Row = Record<string, string>;

// Brevo writes dd-mm-yyyy hh:mm:ss, which Date parses as month-first and gets
// wrong for any day past the 12th.
function parseTs(v: string): string | null {
  const m = (v || "").match(/^(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (!m) return null;
  const [, d, mo, y, h, mi, s] = m;
  return new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}Z`).toISOString();
}

// Minimal CSV reader — quoted fields with commas inside, which subject lines
// have plenty of.
function parseCsv(text: string): Row[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else if (c !== "\r") cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const head = rows.shift() ?? [];
  return rows
    .filter((r) => r.length === head.length)
    .map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), r[i]])));
}

type Change = {
  email: string;
  opened_at?: string;
  clicked_at?: string;
  clicked_app_store?: boolean;
  bounce_kind?: string;
  bounced?: boolean;
};

export default function BrevoImport({ onDone }: { onDone?: () => void }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [summary, setSummary] = useState<string[] | null>(null);

  async function handleFile(file: File) {
    setBusy("Reading the file…");
    setSummary(null);
    try {
      const rows = parseCsv(await file.text());
      if (!rows.length || !("st_text" in rows[0]) || !("email" in rows[0])) {
        throw new Error(
          "That does not look like a Brevo log — expected columns st_text and email.",
        );
      }

      // Collapse thousands of events into one change per person.
      const byEmail = new Map<string, Change>();
      const at = (e: string) => {
        const k = e.trim().toLowerCase();
        if (!byEmail.has(k)) byEmail.set(k, { email: k });
        return byEmail.get(k)!;
      };

      for (const r of rows) {
        const email = (r.email || "").trim().toLowerCase();
        if (!email || !email.includes("@")) continue;
        const ev = (r.st_text || "").trim();
        const ts = parseTs(r.ts || "");
        const c = at(email);

        if (ev === "Opened" || ev === "First opening") {
          if (ts && (!c.opened_at || ts < c.opened_at)) c.opened_at = ts;
        } else if (ev === "Clicked") {
          if (ts && (!c.clicked_at || ts < c.clicked_at)) c.clicked_at = ts;
          if ((r.link || "").includes("apps.apple.com")) c.clicked_app_store = true;
        } else if (ev === "Hard bounce") {
          // Dead address. Never send again.
          c.bounce_kind = "hard";
          c.bounced = true;
        } else if (ev === "Soft bounce") {
          // Full mailbox or a bad day. Recorded, still sendable — suppressing
          // on one soft bounce throws away good addresses.
          if (c.bounce_kind !== "hard") c.bounce_kind = "soft";
        } else if (ev === "Unsubscribed") {
          c.bounced = c.bounced ?? false;
          (c as Change & { unsubscribed?: boolean }).unsubscribed = true;
        }
      }

      const changes = [...byEmail.values()];
      let touched = 0;
      const counts = { opened: 0, clicked: 0, store: 0, hard: 0, soft: 0 };

      for (let i = 0; i < changes.length; i++) {
        const c = changes[i];
        if (i % 25 === 0) setBusy(`Updating ${i + 1} of ${changes.length}…`);

        const patch: Record<string, unknown> = {};
        if (c.opened_at) { patch.opened_at = c.opened_at; counts.opened++; }
        if (c.clicked_at) { patch.clicked_at = c.clicked_at; counts.clicked++; }
        if (c.clicked_app_store) { patch.clicked_app_store = true; counts.store++; }
        if (c.bounce_kind) {
          patch.bounce_kind = c.bounce_kind;
          if (c.bounce_kind === "hard") counts.hard++; else counts.soft++;
        }
        if (c.bounced) patch.bounced = true;
        if ((c as { unsubscribed?: boolean }).unsubscribed) patch.unsubscribed = true;
        if (Object.keys(patch).length === 0) continue;

        // The same address can be a chapter or a sponsor, so try both.
        // Cast through any: chapter_leads and sponsor_leads post-date the
        // generated types file, so the typed client refuses table names that
        // exist perfectly well in the database.
        const db = supabase as any;
        const [a, b] = await Promise.all([
          db.from("chapter_leads").update(patch).eq("email", c.email).select("id"),
          db.from("sponsor_leads").update(patch).eq("contact_email", c.email).select("id"),
        ]);
        if ((a.data?.length ?? 0) + (b.data?.length ?? 0) > 0) touched++;
      }

      setBusy(null);
      setSummary([
        `${changes.length} people in the log, ${touched} matched a lead`,
        `${counts.store} clicked through to the App Store — your warmest list`,
        `${counts.opened} opened, ${counts.clicked} clicked something`,
        `${counts.hard} dead addresses suppressed, ${counts.soft} soft bounces noted`,
      ]);
      toast({
        title: "Log imported",
        description: `${touched} leads updated. ${counts.hard} dead addresses will not be emailed again.`,
      });
      onDone?.();
    } catch (e) {
      setBusy(null);
      toast({
        title: "Import failed",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    }
  }

  return (
    <Card className="space-y-4 p-5">
      <div>
        <h2 className="text-lg font-semibold">Import Brevo log</h2>
        <p className="text-sm text-muted-foreground">
          Export the send log from Brevo and drop it here. Records who opened,
          who clicked, and stops dead addresses being emailed again.
        </p>
      </div>

      <input
        id="brevo-file"
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = "";
        }}
      />
      <Button
        className="w-full gap-2"
        variant="secondary"
        disabled={busy !== null}
        onClick={() => document.getElementById("brevo-file")?.click()}
      >
        <UploadCloud className="h-4 w-4" />
        {busy ?? "Choose the CSV"}
      </Button>

      {summary ? (
        <ul className="space-y-1 text-sm text-muted-foreground">
          {summary.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}
