import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

/**
 * Coverage — "for Boise State, did I do the fan clubs? did I do the businesses?"
 *
 * Every other view answers "what is in my list". This one answers "where have I
 * been", and the unit is a TEAM, because that is how the product and the work
 * are organised. A town is only where a chapter happens to meet.
 *
 * One row per team, two columns for the two things you can do. Each cell says
 * how far along that half is, so a blank one is a team nobody has touched.
 */

type Row = {
  place: string;
  chapters: { total: number; emailed: number; step2: number; noEmail: number };
  business: { total: number; emailed: number; step2: number; noEmail: number };
};

const EMPTY = { total: 0, emailed: 0, step2: 0, noEmail: 0 };

export default function CoveragePanel() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      const [ch, sp] = await Promise.all([
        supabase
          .from("chapter_leads")
          .select("org,city,state,email,emailed,sequence_step,unsubscribed,bounced")
          .limit(5000),
        supabase
          .from("sponsor_leads")
          .select("school,market,region,vertical,contact_email,emailed,sequence_step,unsubscribed,bounced")
          .limit(5000),
      ]);

      const map = new Map<string, Row>();
      const get = (place: string) => {
        const key = place.trim();
        if (!map.has(key)) {
          map.set(key, {
            place: key,
            chapters: { ...EMPTY },
            business: { ...EMPTY },
          });
        }
        return map.get(key)!;
      };

      for (const c of (ch.data ?? []) as any[]) {
        if (!c.org) continue;
        const b = get(String(c.org)).chapters;
        b.total++;
        if (!c.email) b.noEmail++;
        if (c.emailed) b.emailed++;
        if ((c.sequence_step ?? 0) >= 2) b.step2++;
      }

      for (const s of (sp.data ?? []) as any[]) {
        // By team, the way the product is organised — a town is only where a
        // chapter happens to meet.
        const place = (s.school || "").trim();
        if (!place) continue;
        const b = get(place).business;
        b.total++;
        if (!s.contact_email) b.noEmail++;
        if (s.emailed) b.emailed++;
        if ((s.sequence_step ?? 0) >= 2) b.step2++;
      }

      setRows(
        [...map.values()].sort(
          (a, b) =>
            b.chapters.total + b.business.total - (a.chapters.total + a.business.total),
        ),
      );
    })();
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows ?? [];
    return (rows ?? []).filter((r) => r.place.toLowerCase().includes(needle));
  }, [rows, q]);

  const totals = useMemo(() => {
    const r = rows ?? [];
    return {
      places: r.length,
      bothDone: r.filter((x) => x.chapters.emailed > 0 && x.business.emailed > 0).length,
      neither: r.filter((x) => x.chapters.emailed === 0 && x.business.emailed === 0).length,
    };
  }, [rows]);

  return (
    <div className="container mx-auto space-y-4 px-4 py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Where have I been</h2>
          <p className="text-sm text-muted-foreground">
            One row per team. Have you emailed its fan clubs, and have you emailed
            the businesses around it?
          </p>
        </div>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Find a team — Boise State, Browns…"
          className="sm:w-72"
        />
      </div>

      {rows ? (
        <div className="flex flex-wrap gap-3 text-sm">
          <Badge variant="outline">{totals.places} teams</Badge>
          <Badge variant="outline">{totals.bothDone} done both sides</Badge>
          <Badge variant="outline">{totals.neither} untouched</Badge>
        </div>
      ) : null}

      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3">Team</th>
              <th className="px-4 py-3">Fan clubs</th>
              <th className="px-4 py-3">Businesses</th>
            </tr>
          </thead>
          <tbody>
            {!rows ? (
              <tr>
                <td className="px-4 py-6 text-muted-foreground" colSpan={3}>
                  Loading…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-muted-foreground" colSpan={3}>
                  No team matches that.
                </td>
              </tr>
            ) : (
              filtered.slice(0, 300).map((r) => (
                <tr key={r.place} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium">{r.place}</td>
                  <td className="px-4 py-3">
                    <Cell {...r.chapters} />
                  </td>
                  <td className="px-4 py-3">
                    <Cell {...r.business} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
      {rows && filtered.length > 300 ? (
        <p className="text-xs text-muted-foreground">
          Showing the 300 biggest. Search for a team to find the rest.
        </p>
      ) : null}
    </div>
  );
}

/**
 * One cell. Says the state of that half in a phrase, not a number salad —
 * "12 · none emailed" tells you what to do next, "12/0/0/9" does not.
 */
function Cell({
  total,
  emailed,
  step2,
  noEmail,
}: {
  total: number;
  emailed: number;
  step2: number;
  noEmail: number;
}) {
  if (total === 0) return <span className="text-muted-foreground">—</span>;

  const state =
    emailed === 0
      ? { text: "none emailed", tone: "text-amber-500" }
      : step2 > 0
        ? { text: `${emailed} emailed · ${step2} on follow-up`, tone: "text-emerald-500" }
        : { text: `${emailed} emailed`, tone: "text-emerald-500" };

  return (
    <span className="flex flex-wrap items-baseline gap-x-2">
      <span className="font-medium">{total}</span>
      <span className={`text-xs ${state.tone}`}>{state.text}</span>
      {noEmail > 0 ? (
        <span className="text-xs text-muted-foreground">
          {noEmail} need an address
        </span>
      ) : null}
    </span>
  );
}
