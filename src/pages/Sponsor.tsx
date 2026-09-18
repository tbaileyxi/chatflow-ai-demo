import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useCanonical } from '@/hooks/useCanonical';
import { FOUNDING_END, FOUNDING_PRICE, LIST_PRICE, isFoundingOpen } from '@/lib/founding';

/**
 * ONE SPONSOR PAGE, personalised by ?team=slug.
 *
 * Sells one thing: a partner per team per season. Until the founding deadline
 * (src/lib/founding.ts) that is $500 with $2,500 struck through; after it the
 * page flips on its own to $2,500 flat and says the window has closed. The
 * partner's name sits under every reaction clip fans post and on the pregame
 * card at kickoff — and nowhere else. No logos (the marks are not ours), no
 * audience numbers (we do not have them), never "official" (we are not).
 */

const AUDIENCE = ['Alumni', 'Fraternities', 'Influencers', 'Tailgate groups', 'Fan club chapters'];

const money = (n: number) => `$${n.toLocaleString('en-US')}`;

type Team = { id: string; city: string; name: string; league: string | null };

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
const slugOf = (t: Team) => slugify(`${t.city} ${t.name}`);

/** Leagues in the order a fan would look for them. */
const LEAGUE_ORDER = ['NFL', 'NCAAF', 'NCAA', 'NBA', 'NCAAB', 'MLB', 'NHL'];
const LEAGUE_LABEL: Record<string, string> = {
  NFL: 'NFL',
  NCAAF: 'NCAAF',
  NCAA: 'NCAA',
  NBA: 'NBA',
  NCAAB: 'NCAAB',
  MLB: 'MLB',
  NHL: 'NHL',
};

/**
 * What a failed checkout says to a person.
 *
 * The live page once printed {"error":"..."} straight onto the screen: the
 * raw response body, braces and all. Whatever comes back, the reader gets a
 * sentence — the server's own message when it wrote one for a person, and a
 * plain fallback when it did not.
 */
async function humanError(err: unknown): Promise<string> {
  const fallback = "Checkout didn't open. Try again, or email ty@sidehuddlesports.com.";
  try {
    const ctx = (err as { context?: Response })?.context;
    if (ctx && typeof ctx.json === 'function') {
      const body = await ctx.json().catch(() => null);
      const msg = body && typeof body.error === 'string' ? body.error : null;
      if (msg && !msg.trim().startsWith('{')) return msg;
    }
  } catch { /* fall through to the plain sentence */ }
  return fallback;
}

const PACKAGE = [
  'Category exclusivity — one partner per team, per season.',
  'Founding-partner status and the launch-story naming.',
  'Your name on the pregame card at kickoff.',
  'A "powered by" line under the reaction clips fans post.',
  'Co-branded shirts in the team\u2019s colors.',
];

/**
 * True until the founding deadline, then false — flipping while the page is
 * open, so nobody sits on a $500 page after the window has shut. Re-armed at
 * most a day at a time (a timer cannot be set weeks out).
 */
function useFoundingOpen(): boolean {
  const [open, setOpen] = useState(() => isFoundingOpen());
  useEffect(() => {
    if (!open) return;
    let t: ReturnType<typeof setTimeout>;
    const arm = () => {
      const ms = FOUNDING_END - Date.now();
      if (ms <= 0) return setOpen(false);
      t = setTimeout(arm, Math.min(ms + 50, 86_400_000));
    };
    arm();
    return () => clearTimeout(t);
  }, [open]);
  return open;
}

export default function Sponsor() {
  useCanonical('/sponsor');
  const open = useFoundingOpen();
  const PRICE = open ? FOUNDING_PRICE : LIST_PRICE;

  const [params] = useSearchParams();
  const slug = (params.get('team') || '').trim().toLowerCase();
  const paid = params.get('paid') === '1';

  const [teams, setTeams] = useState<Team[]>([]);
  const [taken, setTaken] = useState<Set<string>>(new Set());
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);

  const [brand, setBrand] = useState('');
  const [who, setWho] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // NEVER STUCK ON "LOADING". The list used to show "Loading teams…" whenever
  // it was empty — including when the request had failed — so a failed fetch
  // looked like a slow one forever, with no total and no way to pay. Loading,
  // failed and ready are now three different states, and failure says so and
  // offers a retry.
  const [teamsState, setTeamsState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setTeamsState('loading');
    void (async () => {
      try {
        const timeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 10000),
        );
        const [teamsRes, fpRes] = await Promise.race([
          Promise.all([
            supabase.from('teams').select('id, city, name, league').eq('status', 'active').order('name'),
            (supabase as any)
              .from('founding_partners')
              .select('team_slug')
              .eq('season', new Date().getFullYear()),
          ]),
          timeout,
        ]);
        if (cancelled) return;
        if (teamsRes.error || !teamsRes.data || teamsRes.data.length === 0) {
          setTeamsState('failed');
          return;
        }
        setTeams(teamsRes.data as Team[]);
        // A failed partners read must not block the sale; it just means
        // nothing shows as taken, and the checkout still refuses a taken team.
        setTaken(new Set(((fpRes.data ?? []) as { team_slug: string }[]).map((r) => r.team_slug)));
        setTeamsState('ready');
      } catch {
        if (!cancelled) setTeamsState('failed');
      }
    })();
    return () => { cancelled = true; };
  }, [attempt]);

  // Claims land while the page is open. Re-read them so the counter and the
  // Taken tags stay true without a reload.
  useEffect(() => {
    const t = setInterval(async () => {
      const { data, error } = await (supabase as any)
        .from('founding_partners')
        .select('team_slug')
        .eq('season', new Date().getFullYear());
      if (!error && data) setTaken(new Set((data as { team_slug: string }[]).map((r) => r.team_slug)));
    }, 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    setPicked((prev) => {
      const next = new Set(
        [...prev].filter((id) => {
          const t = teams.find((x) => x.id === id);
          return !t || !taken.has(slugOf(t));
        }),
      );
      return next.size === prev.size ? prev : next;
    });
  }, [taken, teams]);

  const nflTeams = teams.filter((t) => (t.league || '').toUpperCase() === 'NFL');
  const nflClaimed = nflTeams.filter((t) => taken.has(slugOf(t))).length;

  const ticker = useTicker(teams);

  const linkTeam = useMemo(
    () => (slug ? teams.find((t) => slugOf(t) === slug) ?? null : null),
    [slug, teams],
  );

  // The team in the link arrives checked, unless it is already taken.
  useEffect(() => {
    if (linkTeam && !taken.has(slugOf(linkTeam))) {
      setPicked((prev) => (prev.size ? prev : new Set([linkTeam.id])));
    }
  }, [linkTeam, taken]);

  const team = linkTeam?.name ?? null;
  const pickedTeams = teams.filter((t) => picked.has(t.id));
  const n = pickedTeams.length;
  const total = n * PRICE;

  const byLeague = useMemo(() => {
    const m = new Map<string, Team[]>();
    for (const t of teams) {
      const k = (t.league || 'Other').toUpperCase();
      (m.get(k) ?? m.set(k, []).get(k)!).push(t);
    }
    return [...m.entries()].sort(
      (a, b) =>
        (LEAGUE_ORDER.indexOf(a[0]) + 1 || 99) - (LEAGUE_ORDER.indexOf(b[0]) + 1 || 99),
    );
  }, [teams]);

  // Before "Add another team" is opened, the selector shows what is chosen
  // (the link's team) so there is always a visible, working selector — the last
  // version hid the whole list whenever a team was preselected. With nothing
  // chosen there is nothing to hide, so the full list shows.
  const listed = showAll || n === 0
    ? byLeague
    : byLeague
        .map(([league, list]) => [league, list.filter((t) => picked.has(t.id))] as [string, Team[]])
        .filter(([, list]) => list.length > 0);

  const toggle = (t: Team) => {
    if (taken.has(slugOf(t))) return;
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(t.id)) next.delete(t.id);
      else next.add(t.id);
      return next;
    });
  };

  const scrollToClaim = () =>
    document.getElementById('claim')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const pay = async () => {
    setErr(null);
    if (n === 0) return setErr('Pick a team to claim.');
    if (!brand.trim()) return setErr('Add your business name.');
    if (!who.trim()) return setErr('Add your name.');
    if (!email.includes('@')) return setErr('Add an email we can reach you at.');

    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-sponsor-square-checkout', {
        body: {
          businessName: brand.trim(),
          contactName: who.trim(),
          email: email.trim(),
          teams: pickedTeams.map((t) => ({
            teamKey: `${t.id}:founding`,
            teamName: `${t.city} ${t.name}`,
            league: t.league,
          })),
        },
      });
      if (error) {
        setErr(await humanError(error));
        return;
      }
      const url = (data as { url?: unknown } | null)?.url;
      if (typeof url !== 'string' || !url.startsWith('http')) {
        setErr("Checkout didn't open. Try again, or email ty@sidehuddlesports.com.");
        return;
      }
      window.location.href = url;
    } catch (e) {
      setErr(await humanError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      {paid ? (
        <div className="mx-auto max-w-5xl px-5 pt-8">
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm">
            Payment received. I'll be in touch about the launch story and the shirts.
          </div>
        </div>
      ) : null}

      {/* [1] HERO — reads cold: somebody from a cold email, who has never
          heard of Side Huddle, gets the offer from these two lines alone. */}
      <section
        className="relative overflow-hidden"
        style={{
          background:
            'radial-gradient(60% 55% at 50% 0%, rgba(255,214,10,0.10) 0%, rgba(10,10,10,0) 70%), #0A0A0A',
        }}
      >
        <div className="mx-auto max-w-5xl px-5 pb-6 pt-7 sm:pb-10 sm:pt-16">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#FFD60A]">
            Founding partner
          </p>
          <h1 className="mt-3 max-w-3xl sm:mt-4 text-[2.6rem] font-black leading-[1.02] tracking-tight sm:text-6xl">
            One Team. Your Brand. All Season.
          </h1>
          <p className="mt-4 max-w-2xl text-[17px] leading-relaxed sm:mt-6 sm:text-lg" style={{ color: '#F5F5F5' }}>
            Side Huddle Sports powers the fans with AI-powered chat rooms. Every emotional reaction,
            powered by you.
          </p>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-white/85 sm:mt-3 sm:text-base">
            Side Huddle is the app where fans watch every game together — on camera, in live chat rooms.
          </p>

          <div className="mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-1 sm:mt-7">
            {open ? (
              <>
                <s className="text-2xl font-bold text-white/45 decoration-white/70">{money(LIST_PRICE)}</s>
                <span className="text-5xl font-black leading-none text-[#FFD60A]">{money(FOUNDING_PRICE)}</span>
                <span className="text-base font-semibold text-white">Founding rate — one per team.</span>
              </>
            ) : (
              <>
                <span className="text-5xl font-black leading-none text-[#FFD60A]">{money(LIST_PRICE)}</span>
                <span className="text-base font-semibold text-white">Flat for the season — one per team.</span>
              </>
            )}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3 sm:mt-6">
            <button
              onClick={scrollToClaim}
              className="rounded-lg px-6 py-3.5 text-base font-black text-[#0A0A0A]"
              style={{ backgroundColor: '#FFD60A' }}
            >
              Claim your team
            </button>
            {open ? (
              <Countdown />
            ) : (
              <p className="text-sm font-semibold text-[#FFD60A]">The founding window has closed.</p>
            )}
          </div>
        </div>
      </section>

      {/* [1b] TICKER — real rooms and their team's next game. Nothing here is
          written by hand; with no data it does not render. */}
      <Ticker items={ticker} />

      <main className="mx-auto max-w-5xl px-5">
        {/* [1c] AUDIENCE */}
        <section className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:gap-5 sm:py-7">
          <h2 className="shrink-0 text-base font-black text-white">Your brand in front of:</h2>
          <ul className="flex flex-wrap gap-1.5 sm:gap-2">
            {AUDIENCE.map((a) => (
              <li
                key={a}
                className="flex items-center gap-1.5 rounded-full border border-[#FFD60A]/40 bg-black px-2.5 py-1 text-[13px] font-semibold text-white sm:gap-2 sm:px-3.5 sm:py-1.5 sm:text-sm"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-[#FFD60A]" />
                {a}
              </li>
            ))}
          </ul>
        </section>

        {/* [2] PRODUCT PREVIEW — two full-size phones on a real room (Bills
            mafia, from the app). No section label: the phones and their
            captions carry it. The gold boxes mark where the buyer's name goes. */}
        <section className="grid justify-items-center gap-14 pb-14 pt-6 md:grid-cols-2 md:items-start">
          <figure className="m-0 w-full max-w-[380px]">
            <PhoneFrame>
              <img
                src="/sponsor/room-card-joes-cars.png"
                alt="A Side Huddle room with the pregame card, powered by Joe's Cars"
                className="block h-full w-full"
              />
              {/* The card lands at the bottom of the chat, above the composer.
                  Box = the cleared chat area of the screenshot, in percent. */}
              <div
                className="absolute inset-x-[4%] flex flex-col justify-end pb-[3%]"
                style={{ top: '39.33%', bottom: '14.4%' }}
              >
                <PregameCardPreview partner="Joe's Cars" callout />
              </div>
            </PhoneFrame>
            <figcaption className="mt-5 text-center text-white/80">
              Your name on the pregame card at kickoff.
            </figcaption>
          </figure>

          <figure className="m-0 w-full max-w-[380px]">
            <PhoneFrame>
              {/* A real room screenshot; the reaction clip in it is the
                  Tulane dual-cam, with the app's powered-by line under it. */}
              <img
                src="/sponsor/room-clip-joes-cars.png"
                alt="A reaction clip in a Side Huddle room, with powered by Joe's Cars under it"
                className="block h-full w-full"
              />
              {/* Around the powered-by line: measured from the image. */}
              <div
                className="pointer-events-none absolute rounded-md border-2 border-[#FFD60A]"
                style={{ left: '22.6%', top: '81.3%', width: '37.4%', height: '2.35%', boxShadow: '0 0 16px rgba(255,214,10,0.5)' }}
              />
              <YourNameTag style={{ left: '61.6%', top: '82.47%', transform: 'translateY(-50%)' }} />
            </PhoneFrame>
            <figcaption className="mt-5 text-center text-white/80">
              Your name under every reaction clip.
            </figcaption>
          </figure>
        </section>

        {/* [2b] APP STRIP */}
        <p className="pb-14 text-center text-sm text-white/70">
          The digital tailgate. Snap meets ESPN — your crew, the game, one room.
        </p>

        {/* [3] WHAT YOU GET */}
        <section className="border-t border-white/10 py-14">
          <h2 className="text-xl font-black">What you get</h2>
          <ul className="mt-5 grid gap-x-10 gap-y-3 sm:grid-cols-2">
            {PACKAGE.map((line) => (
              <li key={line} className="flex gap-3 text-white/80">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#FFD700]" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* [4] TERMS */}
        <section className="border-t border-white/10 py-14">
          <h2 className="text-xl font-black">Terms</h2>
          <ul className="mt-5 space-y-2 text-white/75">
            <li>{money(PRICE)} per team, flat for the season, no prorating.</li>
            <li>This season only.</li>
            <li>Each sport-season is its own unit.</li>
          </ul>
        </section>

        {/* [5] CLAIM */}
        <section id="claim" className="border-t border-white/10 py-14">
          <div className="max-w-2xl rounded-2xl border border-white/12 bg-white/[0.02] p-6">
            {teamsState === 'ready' && nflTeams.length ? (
              <p className="mb-3 text-sm font-bold text-[#FFD60A]">
                {nflClaimed} of {nflTeams.length} NFL teams claimed
              </p>
            ) : null}
            <h2 className="text-xl font-black">Claim it</h2>

            <div className="mt-5 space-y-5 rounded-lg border border-white/10 p-4">
              {listed.map(([league, list]) => (
                <fieldset key={league}>
                  <legend className="mb-2 text-xs font-bold uppercase tracking-wide text-white/45">
                    {LEAGUE_LABEL[league] ?? league}
                  </legend>
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {list.map((t) => {
                      const isTaken = taken.has(slugOf(t));
                      const id = `team-${t.id}`;
                      return (
                        <label
                          key={t.id}
                          htmlFor={id}
                          className={`flex items-center gap-2 text-sm ${
                            isTaken ? 'cursor-not-allowed text-white/30' : 'cursor-pointer text-white/85'
                          }`}
                        >
                          <input
                            id={id}
                            type="checkbox"
                            checked={picked.has(t.id)}
                            disabled={isTaken}
                            onChange={() => toggle(t)}
                            className="h-4 w-4 accent-[#FFD60A]"
                          />
                          <span>
                            {t.city} {t.name}
                          </span>
                          {isTaken ? (
                            <span className="rounded border border-[#FFD60A]/50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#FFD60A]">
                              Taken
                            </span>
                          ) : null}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              ))}
              {teamsState === 'loading' ? (
                <p className="text-sm text-white/50">Loading teams…</p>
              ) : null}
              {teamsState === 'failed' ? (
                <p className="text-sm text-white/70">
                  The team list didn't load.{' '}
                  <button
                    type="button"
                    onClick={() => setAttempt((a) => a + 1)}
                    className="underline underline-offset-4"
                  >
                    Try again
                  </button>{' '}
                  or email ty@sidehuddlesports.com.
                </p>
              ) : null}
            </div>

            {n > 0 ? (
              <button
                type="button"
                onClick={() => setShowAll((v) => !v)}
                className="mt-3 text-sm text-white/55 hover:text-white/80"
              >
                {showAll ? '− Show only my teams' : '＋ Add another team'}
              </button>
            ) : null}

            <div className="mt-6 grid gap-4">
              <Field id="sp-brand" label="Business name" value={brand} onChange={setBrand} />
              <Field id="sp-who" label="Your name" value={who} onChange={setWho} />
              <Field id="sp-email" label="Email" type="email" value={email} onChange={setEmail} />
            </div>

            <p className="mt-6 text-sm text-white/85">
              Total: {money(PRICE)} × {n} {n === 1 ? 'team' : 'teams'} ={' '}
              <span className="font-black text-[#FFD60A]">{money(total)}</span>
            </p>

            {err ? <p className="mt-3 text-sm text-red-400">{err}</p> : null}

            <button
              onClick={pay}
              disabled={busy}
              className="mt-4 w-full rounded-lg px-5 py-3.5 font-black text-[#0A0A0A] disabled:opacity-60"
              style={{ backgroundColor: '#FFD60A' }}
            >
              {busy ? 'Opening checkout…' : `Pay ${money(total)} with Square`}
            </button>

            <p className="mt-4 text-sm text-white/50">
              Rather talk first? ty@sidehuddlesports.com
            </p>
          </div>
        </section>

        {/* [6] DISCLAIMER */}
        <p className="pb-12 text-xs text-white/35">
          Side Huddle is an independent app, not affiliated with the team or league.
        </p>
      </main>
    </div>
  );
}

function Field({
  id, label, value, onChange, type = 'text',
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-white/80">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-white focus:border-[#FFD60A] focus:outline-none"
      />
    </div>
  );
}

/** Time left on the founding rate. Renders nothing once the deadline passes. */
function Countdown() {
  const end = FOUNDING_END;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = Math.floor((end - now) / 1000);
  if (!(left > 0)) return null;
  const pad = (v: number) => String(v).padStart(2, '0');
  const d = Math.floor(left / 86400);
  const h = Math.floor((left % 86400) / 3600);
  const m = Math.floor((left % 3600) / 60);
  return (
    <p className="flex flex-wrap items-baseline gap-x-2 text-sm text-white">
      <span className="font-semibold">Founding rate ends in:</span>
      <span className="font-mono text-lg font-bold tabular-nums text-[#FFD60A]">
        {d}d {pad(h)}h {pad(m)}m {pad(left % 60)}s
      </span>
    </p>
  );
}

/**
 * Ticker lines from the app's own data: each public room, with its team's next
 * game ("Browns in CHS • Cleveland at Tampa Bay · Sun 1:00 PM"). Private rooms
 * and DMs are never read into it. When there are few rooms, the week's real
 * matchups fill in. Nothing is made up; no data, no lines.
 */
function useTicker(teams: Team[]): string[] {
  const [items, setItems] = useState<string[]>([]);
  useEffect(() => {
    if (!teams.length) return;
    let cancelled = false;
    void (async () => {
      const now = new Date();
      const weekOut = new Date(now.getTime() + 7 * 86400e3);
      const [roomsRes, gamesRes] = await Promise.all([
        (supabase as any)
          .from('huddles')
          .select('name, team_id, expires_at')
          .eq('is_private', false)
          .eq('is_dm', false)
          .eq('is_game_room', false)
          .not('team_id', 'is', null)
          .order('last_message_at', { ascending: false, nullsFirst: false })
          .limit(150),
        supabase
          .from('games')
          .select('home_team_id, away_team_id, start_time, status')
          .gte('start_time', now.toISOString())
          .lte('start_time', weekOut.toISOString())
          .neq('status', 'final')
          .order('start_time')
          .limit(500),
      ]);
      if (cancelled || gamesRes.error || !gamesRes.data) return;

      const byId = new Map(teams.map((t) => [t.id, t]));
      const when = (iso: string) =>
        new Date(iso).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' });
      type G = { home_team_id: string; away_team_id: string; start_time: string };
      const label = (g: G) => {
        const home = byId.get(g.home_team_id);
        const away = byId.get(g.away_team_id);
        return home && away ? `${away.city} at ${home.city} · ${when(g.start_time)}` : null;
      };
      const next = new Map<string, G>();
      for (const g of gamesRes.data as G[]) {
        for (const id of [g.home_team_id, g.away_team_id]) if (!next.has(id)) next.set(id, g);
      }

      const out: string[] = [];
      const seen = new Set<string>();
      const used = new Set<G>();
      for (const r of (roomsRes.data ?? []) as { name: string; team_id: string; expires_at: string | null }[]) {
        const name = (r.name || '').trim();
        if (!name || /\btest\b|closed/i.test(name)) continue;
        if (r.expires_at && Date.parse(r.expires_at) < now.getTime()) continue;
        if (seen.has(name.toLowerCase())) continue;
        const g = next.get(r.team_id);
        const m = g && label(g);
        if (!m) continue;
        seen.add(name.toLowerCase());
        used.add(g!);
        out.push(`${name} • ${m}`);
        if (out.length >= 24) break;
      }
      for (const g of gamesRes.data as G[]) {
        if (out.length >= 12) break;
        const m = !used.has(g) && label(g);
        if (m) out.push(m);
      }
      setItems(out);
    })();
    return () => { cancelled = true; };
  }, [teams]);
  return items;
}

function Ticker({ items }: { items: string[] }) {
  if (!items.length) return null;
  const secs = Math.max(30, items.length * 7);
  return (
    <div className="overflow-hidden border-y border-[#FFD60A]/30 bg-black">
      <style>{`
        @keyframes sh-ticker { from { transform: translateX(0) } to { transform: translateX(-50%) } }
        .sh-ticker { animation: sh-ticker var(--sh-ticker-d) linear infinite }
        .sh-ticker:hover { animation-play-state: paused }
        @media (prefers-reduced-motion: reduce) { .sh-ticker { animation: none } }
      `}</style>
      <div
        className="sh-ticker flex w-max items-center py-2.5"
        style={{ ['--sh-ticker-d' as string]: `${secs}s` } as React.CSSProperties}
      >
        {[...items, ...items].map((t, i) => (
          <span
            key={i}
            aria-hidden={i >= items.length || undefined}
            className="flex items-center whitespace-nowrap text-[13px] font-semibold tracking-wide text-[#FFD60A]"
          >
            <span className="px-5">{t}</span>
            <span className="text-[8px] text-[#FFD60A]/50">◆</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * A full-size iPhone: bezel, rounded screen, dynamic island. The screen is the
 * screenshot's own shape (1080×2334), so nothing in it is cropped.
 */
function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative rounded-[3.4rem] bg-[#1C1C1F] p-[11px] shadow-[0_40px_90px_rgba(0,0,0,0.65)] ring-1 ring-white/15">
      <div className="relative overflow-hidden rounded-[2.75rem] bg-black" style={{ aspectRatio: '1080 / 2334' }}>
        {children}
        <div className="pointer-events-none absolute left-1/2 top-[1.1%] h-[3.3%] w-[31%] -translate-x-1/2 rounded-full bg-black" />
      </div>
    </div>
  );
}

/** The gold tag that says what the boxed line is for. */
function YourNameTag({ style, className = '' }: { style?: React.CSSProperties; className?: string }) {
  return (
    <span
      className={`pointer-events-none absolute whitespace-nowrap rounded bg-[#FFD60A] px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#0A0A0A] shadow-[0_4px_14px_rgba(0,0,0,0.5)] ${className}`}
      style={style}
    >
      Your name here
    </span>
  );
}

/**
 * The pregame card, drawn the way the app draws it (PregameCard.tsx): gold
 * rule, week chip, the matchup on its own plate in team colors, the hype line,
 * and the one sponsor line. A real game. The sponsor line shows whatever
 * business name the reader has typed, so they see their own name in it.
 */
function PregameCardPreview({ partner, callout = false }: { partner: string; callout?: boolean }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/12 bg-[#16161A] shadow-[0_18px_40px_rgba(0,0,0,0.55)]">
      <div className="h-[3px] bg-[#FFD700]" />
      <div className="flex items-center gap-2 px-4 pb-1 pt-3">
        <span className="rounded-full bg-[#26262C] px-2.5 py-0.5 font-mono text-[11px] tracking-wider text-white/60">
          WEEK 2
        </span>
        <span className="font-mono text-xs text-white/60">8:15 PM ET</span>
        <span className="ml-auto text-white/35" aria-hidden="true">✕</span>
      </div>
      <div className="mx-3 mb-3 mt-2 flex items-center gap-3 rounded-xl bg-black/35 p-3">
        <Side abbr="DET" name="Detroit Lions" color="#0076B6" />
        <span className="font-mono text-xs text-white/40">at</span>
        <Side abbr="BUF" name="Buffalo Bills" color="#00338D" />
      </div>
      <p className="px-4 pb-3.5 text-sm text-white/85">Bills at home in front of their own room.</p>
      <div className="border-t border-white/[0.08] px-2 py-1.5">
        <div
          className={`relative flex items-center rounded-md border-2 px-2 py-1 ${callout ? 'border-[#FFD60A]' : 'border-transparent'}`}
          style={callout ? { boxShadow: '0 0 16px rgba(255,214,10,0.5)' } : undefined}
        >
          <span className="font-mono text-[11px] tracking-wide text-white/60">powered by {partner}</span>
          {callout ? <YourNameTag className="right-1.5 top-1/2 -translate-y-1/2" /> : null}
        </div>
      </div>
    </div>
  );
}

function Side({ abbr, name, color }: { abbr: string; name: string; color: string }) {
  return (
    // Block over name, not beside it: in a phone-width frame the names were
    // truncating to "Det…", and a matchup nobody can read is not a matchup.
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5 text-center">
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 font-mono text-xs font-semibold text-white"
        style={{ backgroundColor: color }}
      >
        {abbr}
      </div>
      <span className="text-[12px] font-semibold leading-tight">{name}</span>
    </div>
  );
}
