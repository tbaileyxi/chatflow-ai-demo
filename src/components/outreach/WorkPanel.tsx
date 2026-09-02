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
 * sits down wanting "Priority (337)" — they sit down wanting to work Boise
 * State, and the only real questions are: who is here, who have I already
 * written to, and what is left.
 *
 * So: pick a team, see the three groups attached to it, act on whichever one
 * has a gap. No campaigns, no scores, no abstract Step 1 button firing at
 * whoever happens to match a filter — every action here is scoped to the team
 * you are looking at, which is how the work is actually done.
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

  // Two loads, not one.
  //
  // Pulling every column of ten thousand rows to draw a list of team names hung
  // the page for the best part of a minute. The list only needs the team and
  // whether each row is outstanding; the detail is fetched for the one team
  // actually opened.
  const [index, setIndex] = useState<
    { team: string; kind: "chapter" | "partner" | "business"; open: boolean }[] | null
  >(null);
  // Which searches have been run, per team. Without this an empty group means
  // both "nothing found" and "never looked", which are opposite instructions.
  const [progress, setProgress] = useState<Record<string, Set<string>>>({});
  const [extraTeams, setExtraTeams] = useState<string[]>([]);

  const loadIndex = async () => {
    const [c, s] = await Promise.all([
      supabase
        .from("chapter_leads")
        .select("org,emailed,unsubscribed,bounced")
        .limit(5000),
      supabase
        .from("sponsor_leads")
        .select("school,vertical,emailed,unsubscribed,bounced")
        .limit(5000),
    ]);
    const out: { team: string; kind: "chapter" | "partner" | "business"; open: boolean }[] = [];
    for (const r of (c.data ?? []) as any[]) {
      if (!r.org) continue;
      out.push({ team: String(r.org).trim(), kind: "chapter", open: !r.emailed && !r.unsubscribed && !r.bounced });
    }
    for (const r of (s.data ?? []) as any[]) {
      if (!r.school) continue;
      out.push({
        team: String(r.school).trim(),
        kind: (r.vertical || "").toLowerCase() === SCHOOL_PARTNER ? "partner" : "business",
        open: !r.emailed && !r.unsubscribed && !r.bounced,
      });
    }
    setIndex(out);

    const [pr, et] = await Promise.all([
      (supabase as any).from("team_progress").select("team,kind"),
      (supabase as any).from("outreach_teams").select("team"),
    ]);
    const m: Record<string, Set<string>> = {};
    for (const r of (pr.data ?? []) as any[]) {
      (m[r.team] ??= new Set()).add(r.kind);
    }
    setProgress(m);
    setExtraTeams(((et.data ?? []) as any[]).map((r) => String(r.team)));
  };

  async function markDone(team: string, kind: string, found: number) {
    await (supabase as any)
      .from("team_progress")
      .upsert({ team, kind, found, searched_at: new Date().toISOString() },
              { onConflict: "team,kind" });
    setProgress((p) => ({ ...p, [team]: new Set([...(p[team] ?? []), kind]) }));
  }

  async function addTeam() {
    const name = prompt("Which team? e.g. Boise State, Cleveland Browns");
    if (!name || !name.trim()) return;
    const t = name.trim();
    const { error } = await (supabase as any).from("outreach_teams").insert({ team: t });
    if (error && !String(error.message).includes("duplicate")) {
      toast({ title: "Could not add", description: error.message, variant: "destructive" });
      return;
    }
    setExtraTeams((p) => (p.includes(t) ? p : [...p, t]));
    setPicked(t);
  }

  // Only the team you opened.
  const load = async (team?: string) => {
    const t = team ?? picked;
    if (!t) return;
    const [c, s] = await Promise.all([
      supabase
        .from("chapter_leads")
        .select("id,org,chapter_name,city,state,email,emailed,sequence_step,unsubscribed,bounced,opened_at,clicked_app_store")
        .eq("org", t)
        .limit(500),
      supabase
        .from("sponsor_leads")
        .select("id,company,vertical,market,region,school,contact_name,contact_email,emailed,sequence_step,unsubscribed,bounced,opened_at,clicked_app_store")
        .eq("school", t)
        .limit(500),
    ]);
    setChapters((c.data ?? []) as Chapter[]);
    setSponsors((s.data ?? []) as Sponsor[]);
  };

  useEffect(() => { void loadIndex(); }, []);
  useEffect(() => { if (picked) void load(picked); }, [picked]);

  // The team list, from the slim index.
  const teams = useMemo(() => {
    const m = new Map<string, { key: string; total: number; open: number }>();
    for (const r of index ?? []) {
      const t = m.get(r.team) ?? { key: r.team, total: 0, open: 0 };
      t.total++;
      if (r.open) t.open++;
      m.set(r.team, t);
    }
    for (const t of extraTeams) {
      if (!m.has(t)) m.set(t, { key: t, total: 0, open: 0 });
    }
    return [...m.values()].sort((a, b) => b.total - a.total);
  }, [index, extraTeams]);

  const shown = useMemo(() => {
    const n = q.trim().toLowerCase();
    const all = teams;
    if (!n) return all.slice(0, 60);
    return all.filter((t) => t.key.toLowerCase().includes(n)).slice(0, 60);
  }, [teams, q]);

  // The opened team, assembled from the rows fetched for it.
  const place: Place | null = picked
    ? {
        key: picked,
        chapters: chapters ?? [],
        partners: (sponsors ?? []).filter(
          (x) => (x.vertical || "").toLowerCase() === SCHOOL_PARTNER,
        ),
        businesses: (sponsors ?? []).filter(
          (x) => (x.vertical || "").toLowerCase() !== SCHOOL_PARTNER,
        ),
      }
    : null;

  // Send this team's unsent people, and only this team's.
  async function send(kind: "chapters" | "sponsors", ids: string[], step: number) {
    if (ids.length === 0) return;
    if (!confirm(`Send step ${step} to ${ids.length} for ${picked}?`)) return;
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

  // The email itself, before it goes anywhere.
  //
  // Nothing on this page has ever shown the letter, which is why "first letter"
  // means nothing and why a $2,500 price sat in it for weeks after the offer
  // became $100. The send function already builds a preview in test mode; it
  // was simply never displayed.
  const [preview, setPreview] = useState<{ subject: string; text: string; to: string; n: number } | null>(null);

  async function showLetter(kind: "chapters" | "sponsors", ids: string[], step: number) {
    if (ids.length === 0) return;
    setBusy("Fetching the letter…");
    try {
      const fn = kind === "chapters" ? "chapter-send" : "outreach-send";
      const { data, error } = await supabase.functions.invoke(fn, {
        body: { sequenceStep: step, mode: "test", maxEmails: ids.length, ids },
      });
      if (error) throw error;
      const p = (data as any)?.previews?.[0];
      if (!p) throw new Error("No preview came back — check the leads have email addresses.");
      setPreview({ subject: p.subject, text: p.text, to: p.to, n: ids.length });
    } catch (e) {
      toast({
        title: "Could not show the letter",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  }

  // Go and find local businesses for this team. Same Apollo search the old page
  // hid behind "Build A Sponsor Map", but scoped to the team you are looking at
  // instead of asking you to retype it.
  async function research() {
    if (!picked) return;

    // The search needs a TOWN, and a team name is not one. Passing "Texas A&M"
    // meant no location at all, so it searched the whole United States for
    // restaurants and inserted nothing — which is exactly what happened. Only a
    // person knows the team plays in College Station.
    const where = prompt(
      `Which town are ${picked}'s local businesses in?\n\ne.g. College Station, TX`,
    );
    if (!where || !where.trim()) return;

    const kinds = "restaurants, car dealers, insurance, banks, gyms";
    setBusy(`Looking around ${where.trim()}…`);
    try {
      const { data, error } = await supabase.functions.invoke("outreach-enrich", {
        body: {
          school: picked,
          market: where.trim(),
          region: where.trim(),
          vertical: kinds,
          maxResults: 25,
        },
      });
      // functions.invoke hides the real message on error.context.
      if (error) {
        let detail = "";
        try { detail = (await (error as any).context?.json())?.error ?? ""; } catch { /* generic */ }
        throw new Error(detail || "The search function failed.");
      }
      const n = (data as any)?.inserted ?? (data as any)?.saved ?? 0;
      toast({
        title: n > 0 ? `Found ${n}` : "Nothing came back",
        description:
          n > 0
            ? `${n} businesses near ${where.trim()} added to ${picked}.`
            : "Apollo returned no companies. Check APOLLO_API_KEY, or try a bigger nearby town.",
      });
      await markDone(picked, "business", n);
      await Promise.all([loadIndex(), load(picked)]);
    } catch (e) {
      toast({
        title: "Search failed",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  }

  // Four Auburn restaurants are filed as school partners because an old search
  // typed the vertical wrong. A person can see that instantly; this is the one
  // click that fixes it.
  async function recategorise(ids: string[]) {
    if (ids.length === 0) return;
    if (!confirm(`Move ${ids.length} out of school partners? They become ordinary local businesses.`)) return;
    await supabase.from("sponsor_leads").update({ vertical: "other local business" }).in("id", ids);
    await Promise.all([loadIndex(), load(picked!)]);
  }

  if (!index) {
    return <div className="container mx-auto px-4 py-8 text-muted-foreground">Loading teams…</div>;
  }

  return (
    <div className="container mx-auto grid gap-6 px-4 py-8 lg:grid-cols-[320px,1fr]">
      {/* Pick a place */}
      <div className="space-y-3">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Boise State, Cleveland Browns, Ohio State…"
        />
        <div className="max-h-[70vh] space-y-1 overflow-y-auto pr-1">
          {shown.map((p) => {
            const left = p.open;
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

      {preview ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setPreview(null)}
        >
          <Card
            className="max-h-[85vh] w-full max-w-2xl overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              This goes to {preview.n} {preview.n === 1 ? "person" : "people"} · first is {preview.to}
            </p>
            <p className="mt-3 text-base font-semibold">Subject: {preview.subject}</p>
            <pre className="mt-4 whitespace-pre-wrap font-sans text-sm leading-relaxed">
              {preview.text}
            </pre>
            <Button className="mt-6" variant="outline" onClick={() => setPreview(null)}>
              Close
            </Button>
          </Card>
        </div>
      ) : null}

      {/* Work it */}
      <div className="space-y-4">
        {!place ? (
          <Card className="p-8 text-center text-muted-foreground">
            Pick a team on the left. You'll see its fan clubs, its booster or
            NIL group, and the local businesses around it — and what's left to
            do in each.
          </Card>
        ) : (
          <>
            <h2 className="text-2xl font-semibold">{place.key}</h2>

            <Group
              title="Fan clubs"
              done={progress[place.key]?.has("chapters")}
              onDone={() => markDone(place.key, "chapters", 0)}
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
              onPreview={(ids, step) => showLetter("chapters", ids, step)}
            />

            <Group
              title="School partner"
              done={progress[place.key]?.has("partner")}
              onDone={() => markDone(place.key, "partner", 0)}
              why="Booster and NIL groups — they have the donor list."
              rows={place.partners.map((s) => rowFromSponsor(s))}
              busy={busy}
              onSend={(ids, step) => send("sponsors", ids, step)}
              onRecategorise={recategorise}
              onPreview={(ids, step) => showLetter("sponsors", ids, step)}
            />

            <Group
              title="Local businesses"
              done={progress[place.key]?.has("business")}
              onDone={() => markDone(place.key, "business", 0)}
              why="They pay $100 to sponsor the team's rooms."
              rows={place.businesses.map((s) => rowFromSponsor(s))}
              busy={busy}
              onSend={(ids, step) => send("sponsors", ids, step)}
              onResearch={research}
              onPreview={(ids, step) => showLetter("sponsors", ids, step)}
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
 * One group for one team: every contact, selectable, with what has happened to
 * each.
 *
 * The first version showed eight rows and a bulk button, which meant the answer
 * to "have I written to this person" was "somewhere in + 344 more". Selecting
 * is the whole job — you look down the list, tick the ones you mean, and send.
 *
 * The category fix is here for the same reason: four Auburn restaurants are
 * filed as school partners because an old search typed the vertical wrong, and
 * no amount of layout makes that read correctly. A human can see it in one
 * glance, so give them one click.
 */
function Group({
  title, why, rows, busy, onSend, onPreview, onResearch, onRecategorise, done, onDone,
}: {
  done?: boolean;
  onDone?: () => void;
  title: string;
  why: string;
  rows: Row[];
  busy: string | null;
  onSend: (ids: string[], step: number) => void;
  onPreview: (ids: string[], step: number) => void;
  onResearch?: () => void;
  onRecategorise?: (ids: string[]) => void;
}) {
  const [sel, setSel] = useState<string[]>([]);
  const [showAll, setShowAll] = useState(false);
  // Rows with no address cannot be emailed and cannot be ticked, so by default
  // they are just noise between the ones you can act on — and for a team like
  // the Packers that is most of the list.
  const [showNoEmail, setShowNoEmail] = useState(false);

  const live = rows.filter((r) => !r.dead);
  const noEmail = live.filter((r) => !r.email);
  const sendable = live.filter((r) => r.email);
  const actionable = showNoEmail ? rows : rows.filter((r) => r.email);
  const visible = showAll ? actionable : actionable.slice(0, 12);

  // Selecting somebody with no address, or somebody who asked to be left alone,
  // is a click that can only end in an error.
  const selectable = sendable.map((r) => r.id);
  const allOn = selectable.length > 0 && selectable.every((id) => sel.includes(id));

  // What sending would do to this selection: first letter for anyone never
  // written to, follow-up for anyone on step 1.
  const chosen = rows.filter((r) => sel.includes(r.id));
  const firsts = chosen.filter((r) => !r.emailed).map((r) => r.id);
  const followUps = chosen.filter((r) => r.emailed && r.step === 1).map((r) => r.id);

  return (
    <Card className="space-y-3 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold">
            {title} <span className="text-muted-foreground">({rows.length})</span>
          </h3>
          <p className="text-sm text-muted-foreground">{why}</p>
        </div>
        <div className="flex items-center gap-2">
          {onDone ? (
            <button
              onClick={onDone}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                done
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Mark this search as done for this team"
            >
              {done ? "✓ searched" : "mark searched"}
            </button>
          ) : null}
          {live.filter((r) => r.store).length > 0 ? (
            <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-400">
              {live.filter((r) => r.store).length} clicked through to the App Store
            </span>
          ) : null}
          {onResearch ? (
            <Button size="sm" variant="outline" disabled={!!busy} onClick={onResearch}>
              {rows.length === 0 ? "Find some" : "Find more"}
            </Button>
          ) : null}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nobody here yet{onResearch ? " — nothing has been researched for this team." : "."}
        </p>
      ) : (
        <>
          <label className="flex items-center gap-2 border-b pb-2 text-sm">
            <input
              type="checkbox"
              checked={allOn}
              onChange={(e) => setSel(e.target.checked ? selectable : [])}
              disabled={selectable.length === 0}
            />
            <span className="text-muted-foreground">
              {sel.length > 0 ? `${sel.length} selected` : `Select all ${selectable.length} with an address`}
            </span>
          </label>

          <div className="max-h-[380px] space-y-1 overflow-y-auto">
            {visible.map((r) => (
              <label
                key={r.id}
                className={`flex items-center gap-3 rounded px-1 py-1.5 text-sm ${
                  r.email && !r.dead ? "hover:bg-muted/40" : "opacity-60"
                }`}
              >
                <input
                  type="checkbox"
                  disabled={!r.email || r.dead}
                  checked={sel.includes(r.id)}
                  onChange={(e) =>
                    setSel((p) => (e.target.checked ? [...p, r.id] : p.filter((x) => x !== r.id)))
                  }
                />
                <span className="min-w-0 flex-1 truncate">
                  {r.name}
                  {r.sub ? <span className="text-muted-foreground"> · {r.sub}</span> : null}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">{state(r)}</span>

              </label>
            ))}
          </div>

          <div className="flex flex-wrap gap-4">
            {actionable.length > 12 ? (
              <button
                onClick={() => setShowAll((v) => !v)}
                className="text-sm text-muted-foreground underline underline-offset-2"
              >
                {showAll ? "Show fewer" : `Show all ${actionable.length}`}
              </button>
            ) : null}
            {noEmail.length > 0 ? (
              <button
                onClick={() => setShowNoEmail((v) => !v)}
                className="text-sm text-muted-foreground underline underline-offset-2"
              >
                {showNoEmail ? "Hide" : "Show"} {noEmail.length} with no address
              </button>
            ) : null}
          </div>

          <div className="space-y-2 border-t pt-3">
            {sel.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Tick someone to email them.
              </p>
            ) : (
              <>
                {/* Read it, then send it. In that order, and never send without
                    the option to read — that is how the wrong price went out
                    for weeks. */}
                {firsts.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm">{firsts.length} never written to:</span>
                    <Button size="sm" variant="outline" disabled={!!busy}
                      onClick={() => onPreview(firsts, 1)}>
                      Read the letter
                    </Button>
                    <Button size="sm" disabled={!!busy} onClick={() => onSend(firsts, 1)}>
                      Send it
                    </Button>
                  </div>
                ) : null}
                {followUps.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm">{followUps.length} due a follow-up:</span>
                    <Button size="sm" variant="outline" disabled={!!busy}
                      onClick={() => onPreview(followUps, 2)}>
                      Read the follow-up
                    </Button>
                    <Button size="sm" disabled={!!busy} onClick={() => onSend(followUps, 2)}>
                      Send it
                    </Button>
                  </div>
                ) : null}
                {onRecategorise ? (
                  <button
                    onClick={() => onRecategorise(sel)}
                    className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                  >
                    These {sel.length} aren't booster groups — move to businesses
                  </button>
                ) : null}
              </>
            )}
            {noEmail.length > 0 ? (
              <p className="text-xs text-muted-foreground">
                {noEmail.length} have no address and can't be emailed.
              </p>
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
