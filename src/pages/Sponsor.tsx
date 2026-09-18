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
 * "cleveland-browns" → "Cleveland Browns", with no network call.
 *
 * The headline used to wait for the teams table before it could say which team
 * this was, so a link straight from an email painted the generic fallback
 * first and swapped it a moment later — the one moment the reader decides
 * whether the page is about them. The slug already carries the answer; the
 * database is only needed for the id and league the checkout uses, and its row
 * still wins when it lands because "Texas A&M" cannot be recovered from a slug.
 */
const SMALL_WORDS = new Set(['of', 'the', 'at', 'and']);
function labelFromSlug(slug: string): string | null {
  const parts = slug.split('-').filter(Boolean);
  if (parts.length === 0) return null;
  return parts
    .map((w, i) =>
      i > 0 && SMALL_WORDS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1),
    )
    .join(' ');
}

/**
 * The six things a founding partner gets. Written once, here, because the
 * package is the offer: a list that drifts between the page, the email and the
 * invoice is how a sponsor ends up arguing about what they bought.
 */
const PACKAGE = [
  {
    title: 'Category exclusivity',
    body: 'One partner per team, per season. Nobody else in your category while you hold it.',
  },
  {
    title: 'The launch story',
    body: 'Named as the team\u2019s first partner, in the announcement and on this page.',
  },
  {
    title: 'The pregame card',
    body: 'One card in the room at kickoff. Dismissible, never mid-game.',
  },
  {
    title: 'The clip caption',
    body: 'A line under clips fans post of themselves watching. Under them, never on them.',
  },
  {
    title: 'Co-branded shirts',
    body: 'Team colors, both names. You cover roughly $10\u2013$15 a shirt.',
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

        {/* 1. THE STORY, IN ONE BREATH.
            Being first is the entire reason to buy this, and it was sitting in
            item 02 of a numbered list under a paragraph explaining what the app
            is. A dealer does not buy "a small powered-by at the bottom" — he
            buys being the first name on the team. So that is the headline, the
            price is under it, and the button is next to it. What Side Huddle is
            can wait until he wants to know. */}
        <h1 className="text-4xl font-black leading-[1.02] sm:text-[3.4rem]">
          Be the first name on the{' '}
          <span className="text-[#FFD700]">{teamLabel ?? 'team'}</span>.
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/75">
          One business per team, per season. It is a thing that happens once,
          and then never again for as long as you keep it.
        </p>

        <div className="mt-7 flex flex-wrap items-center gap-3">
          <button
            onClick={claim}
            disabled={busy}
            className="rounded-lg bg-[#FFD700] px-5 py-3 font-black text-[#0A0A0C] disabled:opacity-50"
          >
            {busy ? 'Opening checkout\u2026' : `Claim it \u2014 ${SEASON_PRICE}`}
          </button>
          <span className="text-sm text-white/60">{SEASON_PRICE} for the season, flat.</span>
        </div>

        {/* 2. SHOW IT. The two surfaces at full width, because "this is what
            $2,500 buys" is a picture, not a sentence fragment. The slots render
            only when the screenshots exist — an empty frame says more honestly
            that they are coming than a mockup would say falsely. */}
        <section className="mt-14 grid gap-8 sm:grid-cols-2">
          <figure className="m-0">
            <div className="overflow-hidden rounded-2xl border border-white/12 bg-black">
              <img
                src="/sponsor/pregame-card.png"
                alt="The pregame card in a room, with a small powered-by line at the bottom"
                className="block w-full"
                loading="lazy"
                onError={(e) => { (e.currentTarget.closest('figure') as HTMLElement).style.display = 'none'; }}
              />
            </div>
            <figcaption className="mt-2 text-xs text-white/45">
              The pregame card, in the room at kickoff. Product preview.
            </figcaption>
          </figure>
          <figure className="m-0">
            <div className="overflow-hidden rounded-2xl border border-white/12 bg-black">
              <img
                src="/sponsor/clip-caption.png"
                alt="A powered-by line under a clip a fan posted of themselves watching"
                className="block w-full"
                loading="lazy"
                onError={(e) => { (e.currentTarget.closest('figure') as HTMLElement).style.display = 'none'; }}
              />
            </div>
            <figcaption className="mt-2 text-xs text-white/45">
              Under a fan’s own clip. Product preview.
            </figcaption>
          </figure>
        </section>

        {/* 3. THE LINE. It was the best sentence on the page this replaced, and
            it went out with the model it happened to be sitting in. */}
        <p className="mt-14 max-w-2xl text-2xl font-bold leading-snug sm:text-3xl">
          Not an advert beside the fans. A business behind them.
        </p>
        <p className="mt-4 max-w-xl leading-relaxed text-white/70">
          Side Huddle is where they watch the game together — their own crew,
          the score and the news landing in the room as it happens. You are in
          two moments of it, and nowhere else.
        </p>

        {/* 4. The detail, for whoever is still reading. */}
        <h2 className="mt-14 text-xl font-black">What it includes</h2>
        <ul className="mt-5 space-y-4">
          {PACKAGE.map((item) => (
            <li key={item.title} className="border-t border-white/10 pt-4">
              <h3 className="font-bold">{item.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-white/70">{item.body}</p>
            </li>
          ))}
        </ul>

        {/* 5. Terms last, where terms belong. */}
        <div id="claim" className="mt-14 rounded-2xl border border-white/12 p-6">
          <h2 className="text-xl font-black">The terms</h2>
          <ul className="mt-4 space-y-2 text-sm leading-relaxed text-white/75">
            <li>{SEASON_PRICE} flat for the season. No prorating, whenever you take it.</li>
            <li>The founding rate is locked for three seasons.</li>
            <li>First refusal on the season after that.</li>
            <li>The founding window closes around Week 8. After that it is a waitlist.</li>
          </ul>

          <div className="mt-6 space-y-3">
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
            {busy ? 'Opening checkout\u2026' : `Claim ${teamLabel ?? 'it'} \u2014 ${SEASON_PRICE}`}
          </button>
          <p className="mt-3 text-xs text-white/45">
            Rather talk first? ty@sidehuddlesports.com · or{' '}
            <a href={APP_STORE_URL} className="underline">see the app</a>.
          </p>
        </div>

        <p className="mt-10 text-xs leading-relaxed text-white/40">
          Side Huddle is an independent app, not affiliated with the team or league.
        </p>
      </main>
    </div>
  );
}
