import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useCanonical } from '@/hooks/useCanonical';

/**
 * ONE SPONSOR PAGE, personalised by ?team=slug.
 *
 * Sells one thing: a founding partner per team per season, $2,500 flat. The
 * partner's name sits under every reaction clip fans post and on the pregame
 * card at kickoff — and nowhere else. No logos (the marks are not ours), no
 * audience numbers (we do not have them), never "official" (we are not).
 */

const APP_STORE_URL = 'https://apps.apple.com/us/app/id6777524558';
const PRICE = 2500;
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
  'Founding partner status, and the launch story that goes with it.',
  'Your name on the pregame card at kickoff.',
  'A "powered by" line under the reaction clips fans post.',
  'Co-branded shirts in the team’s colors.',
  `${money(PRICE)} rate locked for three seasons, with first refusal after.`,
];

export default function Sponsor() {
  useCanonical('/sponsor');

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

  useEffect(() => {
    void (async () => {
      const [{ data: t }, { data: fp }] = await Promise.all([
        supabase.from('teams').select('id, city, name, league').eq('status', 'active').order('name'),
        (supabase as any)
          .from('founding_partners')
          .select('team_slug')
          .eq('season', new Date().getFullYear()),
      ]);
      setTeams((t ?? []) as Team[]);
      setTaken(new Set(((fp ?? []) as { team_slug: string }[]).map((r) => r.team_slug)));
    })();
  }, []);

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

      {/* [1] HERO */}
      <section
        className="relative overflow-hidden"
        style={{
          background:
            'radial-gradient(60% 55% at 50% 0%, rgba(255,214,10,0.10) 0%, rgba(10,10,10,0) 70%), #0A0A0A',
        }}
      >
        <div className="mx-auto max-w-5xl px-5 pb-16 pt-20 sm:pt-28">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/45">
            Founding partner
          </p>
          <h1 className="mt-4 max-w-3xl text-[2.6rem] font-black leading-[1.02] tracking-tight sm:text-6xl">
            One team. One dealer. All season.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/75">
            {team
              ? `Your name under every ${team} reaction clip and on every ${team} pregame card. ${money(PRICE)} for the season.`
              : `Your name under your team's reaction clips and on your team's pregame card. ${money(PRICE)} for the season.`}
          </p>
          <button
            onClick={scrollToClaim}
            className="mt-8 rounded-lg px-6 py-3.5 text-base font-black text-[#0A0A0A]"
            style={{ backgroundColor: '#FFD60A' }}
          >
            {team ? `Claim ${team} — ${money(PRICE)}` : `Claim a team — ${money(PRICE)}`}
          </button>
          <p className="mt-4 text-sm text-white/50">
            Founding window closes around Week 8 — after that, waitlist.
          </p>
        </div>
      </section>

      <main className="mx-auto max-w-5xl px-5">
        {/* [2] SURFACES */}
        <section className="grid justify-items-center gap-12 py-14 md:grid-cols-2 md:items-start">
          <figure className="m-0 w-full max-w-[380px]">
            <PhoneFrame tag="PRODUCT PREVIEW">
              <img
                src="/sponsor/clip-in-room.png"
                alt="A fan's reaction clip in a room, with a powered-by line under it"
                className="block h-full w-full object-cover"
              />
              {/* The screenshot's own caption said "powered by Joe's Cars" — a
                  test name that reads as a slot already sold. The band is
                  covered with the reader's typed business name instead, the
                  same thing the card beside it does. Positioned in percent of
                  the image, so it tracks the band at every width. */}
              <div
                className="absolute inset-x-0 flex items-center justify-center bg-[#0D0D0D]"
                style={{ top: '81.6%', height: '7.02%' }}
              >
                <span className="text-[10px] text-[#9A9A9A] sm:text-[11px]">
                  powered by {brand.trim() || 'Your business'}
                </span>
              </div>
            </PhoneFrame>
            <figcaption className="mt-4 text-center text-white/75">
              Your name under every reaction clip the fans post — the most-shared thing in the room.
            </figcaption>
          </figure>

          <figure className="m-0 w-full max-w-[380px]">
            <PhoneFrame tag="PREVIEW">
              <div className="flex h-full flex-col justify-center bg-[#0B0B0D] px-3">
                <PregameCardPreview partner={brand.trim() || 'Your business'} />
              </div>
            </PhoneFrame>
            <figcaption className="mt-4 text-center text-white/75">
              Your name on the pregame card at kickoff, when the whole fanbase is watching.
            </figcaption>
          </figure>
        </section>

        {/* [2b] APP STRIP */}
        <p className="pb-14 text-center text-sm text-white/45">
          Side Huddle Sports is the digital tailgate: Snap meets ESPN — your crew, the game, one
          room.{' '}
          <a href={APP_STORE_URL} className="text-white/70 underline underline-offset-4">
            See the app →
          </a>
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
            <li>{money(PRICE)} flat for the season. No prorating.</li>
            <li>Founding window closes around Week 8, then it's a waitlist.</li>
            <li>Each sport-season is its own unit.</li>
          </ul>
        </section>

        {/* [5] CLAIM */}
        <section id="claim" className="border-t border-white/10 py-14">
          <div className="max-w-2xl rounded-2xl border border-white/12 bg-white/[0.02] p-6">
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
                            <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/50">
                              Taken
                            </span>
                          ) : null}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              ))}
              {teams.length === 0 ? <p className="text-sm text-white/50">Loading teams…</p> : null}
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

            <p className="mt-6 text-sm text-white/75">
              Total: {money(PRICE)} × {n} {n === 1 ? 'team' : 'teams'} = {money(total)}
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
              Rather talk first? ty@sidehuddlesports.com · or{' '}
              <a href={APP_STORE_URL} className="underline underline-offset-4">
                see the app
              </a>
              .
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

/**
 * An iPhone, drawn: bezel, rounded screen, dynamic island. Both surfaces sit
 * in one so they read as the same product side by side. Screen aspect matches
 * the screenshot (863×1196), so it shows uncropped.
 */
function PhoneFrame({ tag, children }: { tag: string; children: React.ReactNode }) {
  return (
    <div className="relative rounded-[2.6rem] border border-white/15 bg-[#1A1A1D] p-[10px] shadow-[0_30px_70px_rgba(0,0,0,0.6)]">
      <div className="relative overflow-hidden rounded-[2rem] bg-black" style={{ aspectRatio: '863 / 1196' }}>
        {children}
        <div className="pointer-events-none absolute left-1/2 top-2 h-6 w-24 -translate-x-1/2 rounded-full bg-black" />
      </div>
      <span className="absolute right-5 top-5 z-10 rounded bg-black/75 px-2 py-1 text-[10px] font-bold tracking-[0.14em] text-white/80">
        {tag}
      </span>
    </div>
  );
}

/**
 * The pregame card, drawn the way the app draws it (PregameCard.tsx): gold
 * rule, week chip, the matchup on its own plate in team colors, the hype line,
 * and the one sponsor line. A real game. The sponsor line shows whatever
 * business name the reader has typed, so they see their own name in it.
 */
function PregameCardPreview({ partner }: { partner: string }) {
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
      <div className="border-t border-white/[0.08] px-4 py-2.5">
        <span className="font-mono text-[11px] tracking-wide text-white/50">powered by {partner}</span>
      </div>
    </div>
  );
}

function Side({ abbr, name, color }: { abbr: string; name: string; color: string }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 font-mono text-xs font-semibold text-white"
        style={{ backgroundColor: color }}
      >
        {abbr}
      </div>
      <span className="truncate text-[13px] font-semibold">{name}</span>
    </div>
  );
}
