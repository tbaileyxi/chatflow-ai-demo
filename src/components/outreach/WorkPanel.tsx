import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

/**
 * The worklist.
 *
 * The rest of this page is a dashboard, and the job is not a dashboard. Nobody
 * sits down wanting "Priority (337)" — they sit down wanting to work Boulder,
 * or Boise State, and the only real questions are: who is here, who have I
 * already written to, and what is left.
 *
 * So: pick a place, see the three groups that live there, act on whichever one
 * has a gap. No campaigns, no scores, no abstract Step 1 button firing at
 * whoever happens to match a filter — every action on this screen is scoped to
 * the place you are looking at, which is how the work is actually done.
 */

type Chapter = {
  id: string; org: string | null; chapter_name: string | null;
  city: string | null; state: string | null; email: string | null;
  emailed: boolean; sequence_step: number | null;
  unsubscribed: boolean; bounced: boolean;
  opened_at?: string | null; clicked_app_store?: boolean | null;
};

type Sponsor = {
  id: string; company: string; vertical: string | null;
  market: string | null; region: string | null; school: string | null;
  contact_name: string | null; contact_email: string | null;
  emailed: boolean; sequence_step: number | null;
  unsubscribed: boolean; bounced: boolean;
  opened_at?: string | null; clicked_app_store?: boolean | null;
};

type Place = {
  key: string;
  chapters: Chapter[];
  partners: Sponsor[];
  businesses: Sponsor[];
};

const SCHOOL_PARTNER = "school partner";

export default function WorkPanel() {
  const { toast } = useToast();
  const [chapters, setChapters] = useState<Chapter[] | null>(null);
  const [sponsors, setSponsors] = useState<Sponsor[] | null>(null);
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    const [c, s] = await Promise.all([
      supabase
        .from("chapter_leads")
        .select("id,org,chapter_name,city,state,email,emailed,sequence_step,unsubscribed,bounced,opened_at,clicked_app_store")
        .limit(5000),
      supabase
        .from("sponsor_leads")
        .select("id,company,vertical,market,region,school,contact_name,contact_email,emailed,sequence_step,unsubscribed,bounced,opened_at,clicked_app_store")
        .limit(5000),
    ]);
    setChapters((c.data ?? []) as Chapter[]);
    setSponsors((s.data ?? []) as Sponsor[]);
  };
  useEffect(() => { void load(); }, []);

  // A place is a town. Everything that happens in outreach happens in one.
  const places = useMemo(() => {
    const map = new Map<string, Place>();
    const at = (k: string) => {
      const key = k.trim();
      if (!map.has(key)) map.set(key, { key, chapters: [], partners: [], businesses: [] });
      return map.get(key)!;
    };
    for (const c of chapters ?? []) {
      if (!c.city) continue;
      at(`${c.city}${c.state ? `, ${c.state}` : ""}`).chapters.push(c);
    }
    for (const s of sponsors ?? []) {
      const k = (s.market || s.region || "").trim();
      if (!k) continue;
      const p = at(k);
      if ((s.vertical || "").toLowerCase() === SCHOOL_PARTNER) p.partners.push(s);
      else p.businesses.push(s);
    }
    return [...map.values()].sort((a, b) => size(b) - size(a));
  }, [chapters, sponsors]);

  const shown = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return places.slice(0, 40);
    return places.filter((p) => p.key.toLowerCase().includes(n)).slice(0, 40);
  }, [places, q]);

  const place = picked ? places.find((p) => p.key === picked) ?? null : null;

  // Send this place's unsent people, and only this place's.
  async function send(kind: "chapters" | "sponsors", ids: string[], step: number) {
    if (ids.length === 0) return;
    if (!confirm(`Send step ${step} to ${ids.length} in ${picked}?`)) return;
    setBusy(`Sending to ${ids.length}…`);
    try {
      const fn = kind === "chapters" ? "chapter-send" : "outreach-send";
      const { data, error } = await supabase.functions.invoke(fn, {
        body: { sequenceStep: step, mode: "live", maxEmails: ids.length, ids },
      });
      if (error) throw error;
      toast({ title: "Sent", description: `${(data as any)?.sent ?? ids.length} emails went out.` });
      await load();
    } catch (e) {
      toast({
        title: "Send failed",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  }

  if (!chapters || !sponsors) {
    return <div className="container mx-auto px-4 py-8 text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="container mx-auto grid gap-6 px-4 py-8 lg:grid-cols-[320px,1fr]">
      {/* Pick a place */}
      <div className="space-y-3">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Boulder, Boise, Columbia…"
        />
        <div className="max-h-[70vh] space-y-1 overflow-y-auto pr-1">
          {shown.map((p) => {
            const left = todo(p);
            return (
              <button
                key={p.key}
                onClick={() => setPicked(p.key)}
                className={`w-full rounded-lg border p-3 text-left transition-colors ${
                  picked === p.key ? "border-primary bg-primary/10" : "hover:border-muted-foreground/40"
                }`}
              >
                <p className="text-sm font-medium">{p.key}</p>
                <p className="text-xs text-muted-foreground">
                  {left === 0 ? "nothing left to do" : `${left} still to contact`}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Work it */}
      <div className="space-y-4">
        {!place ? (
          <Card className="p-8 text-center text-muted-foreground">
            Pick a town on the left. You'll see its fan clubs, its school
            partner, and its local businesses — and what's left to do in each.
          </Card>
        ) : (
          <>
            <h2 className="text-2xl font-semibold">{place.key}</h2>

            <Group
              title="Fan clubs"
              why="They bring their members into the app."
              rows={place.chapters.map((c) => ({
                id: c.id,
                name: c.chapter_name || c.org || "Chapter",
                sub: c.org ?? "",
                email: c.email,
                emailed: c.emailed,
                step: c.sequence_step ?? 0,
                dead: c.unsubscribed || c.bounced,
                opened: !!c.opened_at,
                store: !!c.clicked_app_store,
              }))}
              busy={busy}
              onSend={(ids, step) => send("chapters", ids, step)}
            />

            <Group
              title="School partner"
              why="Booster and NIL groups — they have the donor list."
              rows={place.partners.map((s) => rowFromSponsor(s))}
              busy={busy}
              onSend={(ids, step) => send("sponsors", ids, step)}
            />

            <Group
              title="Local businesses"
              why="They pay $100 to sponsor the team's rooms."
              rows={place.businesses.map((s) => rowFromSponsor(s))}
              busy={busy}
              onSend={(ids, step) => send("sponsors", ids, step)}
            />
          </>
        )}
      </div>
    </div>
  );
}

type Row = {
  id: string; name: string; sub: string; email: string | null;
  emailed: boolean; step: number; dead: boolean; opened: boolean; store: boolean;
};

function rowFromSponsor(s: Sponsor): Row {
  return {
    id: s.id,
    name: s.company,
    sub: s.contact_name || s.vertical || "",
    email: s.contact_email,
    emailed: s.emailed,
    step: s.sequence_step ?? 0,
    dead: s.unsubscribed || s.bounced,
    opened: !!s.opened_at,
    store: !!s.clicked_app_store,
  };
}

/**
 * One group in one town, with the only two buttons that make sense for it:
 * write to the ones never written to, and follow up the ones who got step 1.
 */
function Group({
  title, why, rows, busy, onSend,
}: {
  title: string; why: string; rows: Row[]; busy: string | null;
  onSend: (ids: string[], step: number) => void;
}) {
  const live = rows.filter((r) => !r.dead);
  const noEmail = live.filter((r) => !r.email);
  const unsent = live.filter((r) => r.email && !r.emailed);
  const dueFollowUp = live.filter((r) => r.email && r.emailed && r.step === 1);
  const hot = live.filter((r) => r.store);

  return (
    <Card className="space-y-3 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold">
            {title} <span className="text-muted-foreground">({rows.length})</span>
          </h3>
          <p className="text-sm text-muted-foreground">{why}</p>
        </div>
        {hot.length > 0 ? (
          <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-400">
            {hot.length} clicked through to the App Store
          </span>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nobody here yet.</p>
      ) : (
        <>
          <div className="space-y-1">
            {rows.slice(0, 8).map((r) => (
              <div key={r.id} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 flex-1 truncate">
                  {r.name}
                  {r.sub ? <span className="text-muted-foreground"> · {r.sub}</span> : null}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">{state(r)}</span>
              </div>
            ))}
            {rows.length > 8 ? (
              <p className="text-xs text-muted-foreground">+ {rows.length - 8} more</p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {unsent.length > 0 ? (
              <Button size="sm" disabled={!!busy} onClick={() => onSend(unsent.map((r) => r.id), 1)}>
                Write to {unsent.length} for the first time
              </Button>
            ) : null}
            {dueFollowUp.length > 0 ? (
              <Button size="sm" variant="outline" disabled={!!busy}
                onClick={() => onSend(dueFollowUp.map((r) => r.id), 2)}>
                Follow up {dueFollowUp.length}
              </Button>
            ) : null}
            {noEmail.length > 0 ? (
              <span className="self-center text-xs text-muted-foreground">
                {noEmail.length} have no email address
              </span>
            ) : null}
            {unsent.length === 0 && dueFollowUp.length === 0 && noEmail.length === 0 ? (
              <span className="self-center text-xs text-muted-foreground">
                All contacted.
              </span>
            ) : null}
          </div>
        </>
      )}
    </Card>
  );
}

function state(r: Row) {
  if (r.dead) return "don't contact";
  if (!r.email) return "no email";
  if (r.store) return "clicked the App Store";
  if (r.opened) return `opened · step ${r.step}`;
  if (r.emailed) return `sent step ${r.step}`;
  return "not written to";
}

function size(p: Place) {
  return p.chapters.length + p.partners.length + p.businesses.length;
}

function todo(p: Place) {
  const n = (rows: { emailed: boolean; unsubscribed: boolean; bounced: boolean }[]) =>
    rows.filter((r) => !r.emailed && !r.unsubscribed && !r.bounced).length;
  return n(p.chapters) + n(p.partners) + n(p.businesses);
}
