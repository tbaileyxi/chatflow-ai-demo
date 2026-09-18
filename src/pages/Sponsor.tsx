import { useEffect, useMemo, useRef, useState } from 'react';
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
  NCAAF: 'College football',
  NBA: 'NBA',
  NCAAB: 'College basketball',
  MLB: 'MLB',
  NHL: 'NHL',
  NCAA: 'College',
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
  const [showMore, setShowMore] = useState(false);

  const [brand, setBrand] = useState('');
  const [who, setWho] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const formRef = useRef<HTMLDivElement | null>(null);
  const brandRef = useRef<HTMLInputElement | null>(null);

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

  // THE TEAM IN THE LINK ARRIVES PRESELECTED. The selector used to be broken:
  // it needed the teams table and never matched the slug against it, so a link
  // straight from an email landed with nothing chosen.
  const linkTeam = useMemo(
    () => (slug ? teams.find((t) => slugOf(t) === slug) ?? null : null),
    [slug, teams],
  );
  useEffect(() => {
    if (linkTeam && !taken.has(slugOf(linkTeam))) {
      setPicked((prev) => (prev.size ? prev : new Set([linkTeam.id])));
    }
  }, [linkTeam, taken]);

  const teamWord = linkTeam?.name ?? null;
  const pickedTeams = teams.filter((t) => picked.has(t.id));
  const total = pickedTeams.length * PRICE;

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

  const toggle = (t: Team) => {
    if (taken.has(slugOf(t))) return;
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(t.id)) next.delete(t.id);
      else next.add(t.id);
      return next;
    });
  };

  const toClaim = () => {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => brandRef.current?.focus(), 450);
  };

  const claim = async () => {
    setErr(null);
    if (pickedTeams.length === 0) return setErr('Pick a team to claim.');
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
      const url = (data as { url?: string } | null)?.url;
      if (!url) {
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

  const heroTeamTaken = linkTeam ? taken.has(slugOf(linkTeam)) : false;

  return (
    <div className="min-h-screen bg-[#07070A] text-white">
      <main className="mx-auto max-w-5xl px-5">
        {paid ? (
          <div className="mt-8 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm">
            Payment received. I'll be in touch about the launch story and the shirts.
          </div>
        ) : null}

        {/* 1. HERO */}
        <section className="pb-14 pt-16 sm:pt-24">
          <h1 className="max-w-3xl text-[2.6rem] font-black leading-[1.02] tracking-tight sm:text-6xl">
            Power{' '}
            <span className="text-[#FFD700]">{teamWord ? `${teamWord} fans'` : "the fans'"}</span>{' '}
            reactions.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/75">
            Your name under every reaction clip and on every pregame card. One name per team.{' '}
            {money(PRICE)} for the season.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            {heroTeamTaken ? (
              <span className="rounded-lg border border-white/15 px-5 py-3 text-white/70">
                {teamWord} is taken this season. Pick another team below.
              </span>
            ) : (
              <button
                onClick={toClaim}
                className="rounded-lg bg-[#FFD700] px-6 py-3.5 text-base font-black text-[#07070A]"
              >
                Claim {teamWord ?? 'your team'} — {money(PRICE)}
              </button>
            )}
          </div>
          <p className="mt-4 text-sm text-white/55">
            Founding window closes around Week 8 — after that, waitlist.
          </p>
        </section>

        {/* 2. THE SURFACES — the pitch, shown not listed */}
        <section className="grid gap-10 border-t border-white/10 py-16 md:grid-cols-2">
          <figure className="m-0" id="surface-clip">
            <div className="overflow-hidden rounded-2xl border border-white/12 bg-black">
              <img
                src="/sponsor/clip-caption-annotated.png"
                alt="A fan's reaction clip in a room, with a small powered-by line under it"
                className="block w-full"
                loading="lazy"
                onError={(e) => {
                  const fig = e.currentTarget.closest('figure') as HTMLElement | null;
                  if (fig) fig.style.display = 'none';
                }}
              />
            </div>
            <figcaption className="mt-4">
              <p className="text-lg font-bold leading-snug">
                Under every reaction clip your team's fans post.
              </p>
              <p className="mt-1 text-white/65">
                The most-shared thing in the room carries your name.
              </p>
              <p className="mt-2 text-xs uppercase tracking-wide text-white/35">Product preview</p>
            </figcaption>
          </figure>

          <figure className="m-0">
            <PregameCardPreview partner={brand.trim() || 'Your business'} />
            <figcaption className="mt-4">
              <p className="text-lg font-bold leading-snug">
                On the pregame card at kickoff,
              </p>
              <p className="mt-1 text-white/65">when the whole fanbase is watching.</p>
              <p className="mt-2 text-xs uppercase tracking-wide text-white/35">Preview</p>
            </figcaption>
          </figure>
        </section>

        {/* 3. WHAT YOU GET */}
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

        {/* 4. TERMS */}
        <section className="border-t border-white/10 py-14">
          <h2 className="text-xl font-black">Terms</h2>
          <ul className="mt-5 space-y-2 text-white/75">
            <li>{money(PRICE)} flat for the season. No prorating.</li>
            <li>Founding window closes around Week 8, then it's a waitlist.</li>
            <li>Each sport-season is its own unit.</li>
          </ul>
        </section>

        {/* 5. CLAIM */}
        <section ref={formRef} id="claim" className="border-t border-white/10 py-14">
          <div className="max-w-2xl rounded-2xl border border-white/12 bg-white/[0.02] p-6">
            <h2 className="text-xl font-black">Claim it</h2>

            {pickedTeams.length > 0 ? (
              <p className="mt-3 text-white/80">
                {pickedTeams.map((t) => `${t.city} ${t.name}`).join(', ')}
              </p>
            ) : (
              <p className="mt-3 text-white/55">Pick a team below.</p>
            )}

            <button
              type="button"
              onClick={() => setShowMore((v) => !v)}
              className="mt-3 text-sm text-white/55 underline underline-offset-4"
            >
              {showMore ? 'Hide the team list' : pickedTeams.length ? 'Add another team' : 'Choose a team'}
            </button>

            {showMore || pickedTeams.length === 0 ? (
              <div className="mt-4 max-h-80 space-y-5 overflow-y-auto rounded-lg border border-white/10 p-4">
                {byLeague.map(([league, list]) => (
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
                              className="h-4 w-4 accent-[#FFD700]"
                            />
                            <span>
                              {t.city} {t.name}
                              {isTaken ? ' — taken' : ''}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                ))}
              </div>
            ) : null}

            <div className="mt-6 grid gap-4">
              <Field id="sp-brand" label="Business name" value={brand} onChange={setBrand} inputRef={brandRef} />
              <Field id="sp-who" label="Your name" value={who} onChange={setWho} />
              <Field id="sp-email" label="Email" type="email" value={email} onChange={setEmail} />
            </div>

            {err ? <p className="mt-4 text-sm text-red-400">{err}</p> : null}

            <button
              onClick={claim}
              disabled={busy}
              className="mt-6 w-full rounded-lg bg-[#FFD700] px-5 py-3.5 font-black text-[#07070A] disabled:opacity-60"
            >
              {busy
                ? 'Opening checkout…'
                : pickedTeams.length > 1
                  ? `Claim ${pickedTeams.length} teams — ${money(total)}`
                  : `Claim ${pickedTeams[0]?.name ?? 'it'} — ${money(PRICE)}`}
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

        <p className="pb-12 text-xs text-white/35">
          Side Huddle is an independent app, not affiliated with the team or league.
        </p>
      </main>
    </div>
  );
}

function Field({
  id, label, value, onChange, type = 'text', inputRef,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  inputRef?: React.Ref<HTMLInputElement>;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-white/80">
        {label}
      </label>
      <input
        id={id}
        ref={inputRef}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-white focus:border-[#FFD700] focus:outline-none"
      />
    </div>
  );
}

/**
 * The pregame card, drawn the way the app draws it (PregameCard.tsx): gold
 * rule, week chip, the matchup on its own plate in team colors, the hype line,
 * and the one sponsor line at the bottom. Tonight's real game, not an invented
 * one. The sponsor line shows whatever business name has been typed below, so
 * the reader sees their own name in it.
 */
function PregameCardPreview({ partner }: { partner: string }) {
  return (
    <div className="rounded-2xl bg-black p-5">
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
    </div>
  );
}

function Side({ abbr, name, color }: { abbr: string; name: string; color: string }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-white/10 font-mono text-sm font-semibold text-white"
        style={{ backgroundColor: color }}
      >
        {abbr}
      </div>
      <span className="truncate text-sm font-semibold">{name}</span>
    </div>
  );
}
