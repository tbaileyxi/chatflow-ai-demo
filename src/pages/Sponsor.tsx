import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useCanonical } from '@/hooks/useCanonical';

/**
 * ONE SPONSOR PAGE, personalised by ?team=slug.
 *
 * What this replaced: a board selling six positions per team at $100 with $500
 * to take all six, illustrated with a fake sponsor called TicketsR and a Browns
 * mark hotlinked from acrisurestadium.com. Every part of that is gone — the
 * ladder, the invented sponsor, and other people's trademarks served from their
 * servers onto ours.
 *
 * The offer is one founding partner per team per season, $2,500 flat. There is
 * no cheaper option to fall back to, which is the point: exclusivity is the
 * product rather than an upsell.
 *
 * NO TEAM LOGOS ANYWHERE. Team colors and the city name are ours to write;
 * the marks are not.
 */

const APP_STORE_URL = 'https://apps.apple.com/us/app/id6777524558';
const SEASON_PRICE = '$2,500';

type Team = { id: string; city: string; name: string; league: string };

/** "cleveland-browns" → matches "Cleveland Browns". */
function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/**
 * The six things a founding partner gets. Written once, here, because the
 * package is the offer: a list that drifts between the page, the email and the
 * invoice is how a sponsor ends up arguing about what they bought.
 */
const PACKAGE = [
  {
    title: 'Category exclusivity',
    body:
      'One partner per team per season. Nobody else in your category on that team while you hold it.',
  },
  {
    title: 'Founding partner status',
    body:
      'Named as the first partner for the team, and the launch story that goes with being first.',
  },
  {
    title: 'The pregame card',
    body:
      'One shareable card in the room at kickoff, with a small "powered by" at the bottom. Dismissible, and never mid-game.',
  },
  {
    title: 'The clip caption',
    body:
      'A tiny grey "powered by" line under clips fans post of themselves watching. Under the clip, never on the video.',
  },
  {
    title: 'Co-branded shirts',
    body:
      'Shirts in the team’s colors carrying both names. You cover roughly $10–$15 a shirt.',
  },
  {
    title: 'The rate, locked',
    body:
      `${SEASON_PRICE} for the season, flat, whenever in the season you take it. Locked for three seasons, with first refusal after that.`,
  },
];

export default function Sponsor() {
  // One sponsor page. ?team= personalises it; it does not make a new document,
  // so every variant points at /sponsor.
  useCanonical('/sponsor');

  const [params] = useSearchParams();
  const slug = (params.get('team') || '').trim();
  const paid = params.get('paid') === '1';

  const [teams, setTeams] = useState<Team[]>([]);
  const [brand, setBrand] = useState('');
  const [site, setSite] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from('teams')
        .select('id, city, name, league')
        .eq('status', 'active')
        .order('name');
      setTeams((data ?? []) as Team[]);
    })();
  }, []);

  // The team in the link, if it names one we have.
  const team = useMemo(() => {
    if (!slug) return null;
    return (
      teams.find((t) => slugify(`${t.city} ${t.name}`) === slug) ??
      teams.find((t) => slugify(t.name) === slug) ??
      null
    );
  }, [slug, teams]);

  // The database row when we have it, the slug's own words until then.
  const teamLabel = team ? `${team.city} ${team.name}` : labelFromSlug(slug);

  const claim = async () => {
    setBusy(true);
    setErr(null);
    try {
      const { data, error } = await supabase.functions.invoke(
        'create-sponsor-square-checkout',
        {
          body: {
            businessName: brand.trim(),
            website: site.trim(),
            // The slug is enough to sell against. Waiting for the teams
            // table would mean the button above the fold does nothing for the
            // first second of the page's life, which is the second it is most
            // likely to be pressed.
            teams: teamLabel
              ? [
                  {
                    teamKey: `${team?.id ?? slug}:founding`,
                    teamName: teamLabel,
                    league: team?.league ?? null,
                  },
                ]
              : [],
          },
        },
      );
      // functions.invoke buries the real message on error.context — "non-2xx
      // status code" on its own tells a buyer nothing and tells us less.
      if (error) {
        let detail = '';
        try {
          detail = await (error as { context?: Response }).context?.text?.() ?? '';
        } catch { /* the message below is still better than nothing */ }
        throw new Error(detail || error.message);
      }
      const url = (data as { url?: string } | null)?.url;
      if (!url) throw new Error('Checkout did not come back with a link.');
      window.location.href = url;
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0C] text-white">
      <main className="mx-auto max-w-3xl px-5 py-14 sm:py-20">
        {paid ? (
          <div className="mb-10 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm">
            Payment received. I’ll be in touch about the launch story and the shirts.
          </div>
        ) : null}

        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#FFD700]">
          Founding partner
        </p>
        <h1 className="mt-3 text-4xl font-black leading-[1.05] sm:text-5xl">
          {teamLabel
            ? <>Back {teamLabel} fans on Side Huddle.</>
            : <>Back your team’s fans on Side Huddle.</>}
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/75">
          Side Huddle is where fans watch the game together — their crew, with
          the score and the news landing in the room as it happens. One business
          per team becomes its founding partner, the name attached to those fans
          from the start.
        </p>
        <p className="mt-4 text-lg font-bold">
          {SEASON_PRICE} for the season, flat.
        </p>
        <p className="mt-1.5 text-sm text-white/60">
          The founding window closes around Week 8. After that it is a waitlist.
        </p>

        {/* THE BUY BUTTON IS THE ACTION, not a jump link to a form that had
            no button in it. Self-serve funnel: above the fold and again in the
            claim section, both going to checkout. */}
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <button
            onClick={claim}
            disabled={busy}
            className="rounded-lg bg-[#FFD700] px-5 py-3 font-black text-[#0A0A0C] disabled:opacity-50"
          >
            {busy
              ? 'Opening checkout…'
              : `Claim ${teamLabel ?? 'a team'} — ${SEASON_PRICE}`}
          </button>
          <a
            href={APP_STORE_URL}
            className="rounded-lg border border-white/15 px-5 py-3 font-semibold text-white/85"
          >
            See the app first
          </a>
        </div>

        <h2 className="mt-16 text-2xl font-black">What a founding partner gets</h2>
        {/* An <ol> numbers its own items, so printing "01" inside each one
            rendered "1. 01". This is a plain list and the number is drawn once. */}
        <ul className="mt-6 space-y-6">
          {PACKAGE.map((item, i) => (
            <li key={item.title} className="border-t border-white/10 pt-5">
              <p className="font-mono text-[11px] tracking-[0.14em] text-white/40">
                {String(i + 1).padStart(2, '0')}
              </p>
              <h3 className="mt-1 text-lg font-bold">{item.title}</h3>
              <p className="mt-1.5 leading-relaxed text-white/70">{item.body}</p>
            </li>
          ))}
        </ul>

        <div id="claim" className="mt-16 rounded-2xl border border-white/12 p-6">
          <h2 className="text-2xl font-black">
            Claim {teamLabel ?? 'your team'}
          </h2>
          <>
              <p className="mt-2 text-sm text-white/60">
                {SEASON_PRICE} for the {new Date().getFullYear()} season. Nothing owed later.
              </p>
              <div className="mt-5 space-y-3">
                <input
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  placeholder="Business name"
                  className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-white placeholder:text-white/35"
                />
                <input
                  value={site}
                  onChange={(e) => setSite(e.target.value)}
                  placeholder="Website"
                  className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-white placeholder:text-white/35"
                />
              </div>
              {err ? <p className="mt-3 text-sm text-red-400">{err}</p> : null}
              <button
                onClick={claim}
                disabled={busy || !brand.trim()}
                className="mt-5 w-full rounded-lg bg-[#FFD700] px-5 py-3 font-black text-[#0A0A0C] disabled:opacity-50"
              >
                {busy ? 'Opening checkout…' : `Claim it — ${SEASON_PRICE}`}
              </button>
              {/* The fallback, and only the fallback. */}
              <p className="mt-3 text-xs text-white/45">
                Rather talk first? ty@sidehuddlesports.com
              </p>
          </>
        </div>

        <p className="mt-10 text-xs leading-relaxed text-white/40">
          Side Huddle is an independent app, not affiliated with the team or league.
        </p>
      </main>
    </div>
  );
}
