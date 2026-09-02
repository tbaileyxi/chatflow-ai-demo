import { useEffect, useMemo, useState } from 'react';
import { SiteNav, SiteFooter } from '@/components/site/SiteChrome';
import { supabase } from '@/integrations/supabase/client';

/**
 * The sponsor board.
 *
 * This replaced a 998-line sales page that was arguing rather than selling. It
 * claimed PRE-LAUNCH after launch, showed eight invented rooms with invented
 * live counts, benchmarked itself against radio and television — inviting the
 * one question we answer worst — and promised a free second season to anyone
 * whose huddles missed 250 members, which is a debt we would have owed on every
 * deal we closed.
 *
 * What replaced it is a store. The board IS the pitch: every team, one price,
 * what is taken. A page that argues has to be read; a board only has to be
 * scanned for your own team.
 *
 * $100 is chosen to sit under the threshold where a small business has to think
 * about it. At $1,000 a bar owner needs a meeting and a reason. At $100 he needs
 * a button. It also keeps the promise small enough to keep — nobody feels misled
 * at $100, which matters a great deal while the rooms are still filling.
 */

// One number, everywhere. The moment there is a discount table we are
// negotiating again, and not negotiating is the entire point.
const SEASON_PRICE = 100;

// So a bar owner can go and look at the thing before buying a place inside it.
const APP_STORE_URL = 'https://apps.apple.com/us/app/id6777524558';

// Checkout is built server-side by create-sponsor-square-checkout, NOT by
// pointing at a fixed Square link.
//
// A fixed link cannot know that somebody picked four teams. It charges $100 and
// asks them to retype the teams they just chose — which is asking the same
// question twice and losing people between the two. The function prices the
// order, attaches the team list to the Square order note, and reserves the
// slots before the buyer ever sees a card field.

type Team = {
  id: string;
  city: string;
  name: string;
  league: string;
  logo_url: string | null;
  sponsor: string | null;
  sponsor_url: string | null;
};

const LEAGUES = ['All', 'NCAA', 'NFL', 'NBA', 'MLB', 'NHL'] as const;
const LEAGUE_LABEL: Record<string, string> = { NCAA: 'College' };

export default function Sponsor() {
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [league, setLeague] = useState<string>('All');
  const [q, setQ] = useState('');
  // A set, not one team. Somebody who owns three bars in three towns wants
  // three teams, and making them buy one at a time is three chances to stop.
  const [sel, setSel] = useState<string[]>([]);
  const [checkout, setCheckout] = useState(false);

  useEffect(() => {
    (async () => {
      // Taken/open has to come from team_sponsors, NOT teams.sponsor.
      //
      // There are two sponsor fields in this database and they disagree.
      // teams.sponsor is older and nothing renders it; team_sponsors is what
      // HuddleHeader and the bot cards actually read. Reading the wrong one
      // had this board calling Colorado sold — its room shows no sponsor at
      // all — while offering the Yankees, whose room says PRESENTED BY
      // TICKETSR today. Selling a slot that is already on screen is the worst
      // failure this page can have.
      const [{ data: rows }, { data: live }] = await Promise.all([
        supabase
          .from('teams')
          .select('id, city, name, league, logo_url')
          .eq('status', 'active')
          .order('city'),
        (supabase as any)
          .from('team_sponsors')
          .select('team_id, brand_name, end_date')
          .eq('is_active', true),
      ]);

      const now = Date.now();
      const byTeam = new Map<string, string>();
      for (const r of (live ?? []) as any[]) {
        if (r.end_date && new Date(r.end_date).getTime() < now) continue;
        byTeam.set(r.team_id, r.brand_name);
      }

      setTeams(
        ((rows as any[]) ?? []).map((t) => ({
          ...t,
          sponsor: byTeam.get(t.id) ?? null,
          sponsor_url: null,
        })) as Team[],
      );
    })();
  }, []);

  // Football first, because it is football season and the first card a buyer
  // sees should be a team they might plausibly care about. Alphabetical by city
  // opened the board on the Anaheim Ducks in September.
  const LEAGUE_RANK: Record<string, number> = { NCAA: 0, NFL: 1, NBA: 2, NHL: 3, MLB: 4 };

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (teams ?? [])
      .filter((t) => {
        if (league !== 'All' && t.league !== league) return false;
        if (!needle) return true;
        return `${t.city} ${t.name}`.toLowerCase().includes(needle);
      })
      .sort((a, b) => {
        const r = (LEAGUE_RANK[a.league] ?? 9) - (LEAGUE_RANK[b.league] ?? 9);
        if (r !== 0) return r;
        return `${a.city} ${a.name}`.localeCompare(`${b.city} ${b.name}`);
      });
  }, [teams, league, q]);

  const taken = (teams ?? []).filter((t) => t.sponsor && t.sponsor.trim()).length;
  const open = (teams ?? []).length - taken;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white overflow-x-hidden">
      <div style={{ height: 4, background: '#facc15' }} />
      <SiteNav />

      {/* ── The offer, in as few words as it can be made ── */}
      <section className="px-6 pt-14 pb-10 max-w-3xl mx-auto">
        <p className="text-[11px] uppercase tracking-[0.2em] text-[#facc15] font-black mb-5">
          Side Huddle · The digital tailgate
        </p>

        {/* The price IS the hook. "Your name in the room" was a description of a
            feature; $100 for a season is the thing that makes somebody stop —
            it is so far under what local sponsorship costs that the number does
            the persuading and the copy just has to not get in the way. */}
        <h1 className="text-5xl sm:text-7xl font-black leading-[0.95] tracking-tight">
          <span className="text-[#facc15]">$100</span> puts your name
          <br />
          in front of a fanbase.
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-white/60 max-w-xl">
          All season. Every room for that team. Side Huddle is the digital
          tailgate — the app fan groups use to watch the game together, and
          you're the only brand in it.
        </p>

        {/* Real scarcity, not a countdown. One sponsor per team is a fact about
            the product, and the board below proves it — a taken team is visibly
            gone. Fake urgency is the thing every local owner has learned to
            ignore. */}
        {teams ? (
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-[#facc15]">{open}</span>
              <span className="text-sm text-white/50">teams still open</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-white/30">{taken}</span>
              <span className="text-sm text-white/50">already claimed</span>
            </div>
            <a
              href="#board"
              className="rounded-full bg-[#facc15] px-7 py-3.5 text-base font-black text-black hover:opacity-90 transition-opacity"
            >
              Claim your team →
            </a>
          </div>
        ) : null}

        <a
          href={APP_STORE_URL}
          target="_blank"
          rel="noopener"
          className="mt-6 inline-flex items-center gap-2 text-sm font-black text-white/40 hover:text-white/70"
        >
          See the app first →
        </a>
      </section>

      {/* ── The three placements, shown one at a time ──
          Three bullet points asked the reader to picture three things at once
          and picture them correctly. Cycling a highlight over the actual
          screenshot shows each one where it really sits, which is both quicker
          to understand and impossible to overstate. */}
      <section className="px-6 pb-16 max-w-5xl mx-auto">
        <Placements />
      </section>

      {/* ── The board. This is the actual page. ── */}
      <section id="board" className="px-6 pb-24 max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Find your team…"
            className="flex-1 rounded-full border border-white/15 bg-white/[0.04] px-5 py-3 text-base placeholder:text-white/30 focus:outline-none focus:border-[#facc15]/60"
          />
          <div className="flex gap-2 flex-wrap">
            {LEAGUES.map((l) => (
              <button
                key={l}
                onClick={() => setLeague(l)}
                className={`rounded-full px-4 py-2 text-xs font-black transition-colors ${
                  league === l
                    ? 'bg-[#facc15] text-black'
                    : 'border border-white/15 text-white/50 hover:text-white'
                }`}
              >
                {LEAGUE_LABEL[l] ?? l}
              </button>
            ))}
          </div>
        </div>

        {!teams ? (
          <p className="text-white/40 py-12 text-center">Loading teams…</p>
        ) : filtered.length === 0 ? (
          <p className="text-white/40 py-12 text-center">No teams match that.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((t) => {
              const isTaken = !!(t.sponsor && t.sponsor.trim());
              return (
                <button
                  key={t.id}
                  disabled={isTaken}
                  onClick={() =>
                    setSel((prev) =>
                      prev.includes(t.id)
                        ? prev.filter((x) => x !== t.id)
                        : [...prev, t.id],
                    )
                  }
                  className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition-colors ${
                    isTaken
                      ? 'border-white/5 bg-white/[0.02] cursor-default'
                      : sel.includes(t.id)
                        ? 'border-[#facc15] bg-[#facc15]/10'
                        : 'border-white/10 bg-white/[0.03] hover:border-[#facc15]/60'
                  }`}
                >
                  {t.logo_url ? (
                    <img
                      src={t.logo_url}
                      alt=""
                      className={`h-9 w-9 object-contain ${isTaken ? 'opacity-25' : ''}`}
                    />
                  ) : (
                    <div className="h-9 w-9 rounded-full bg-white/5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm font-black truncate ${isTaken ? 'text-white/30' : ''}`}
                    >
                      {t.city} {t.name}
                    </p>
                    <p className="text-xs text-white/35 truncate">
                      {isTaken
                        ? `Taken — ${t.sponsor}`
                        : sel.includes(t.id)
                          ? 'Selected'
                          : `$${SEASON_PRICE} · open`}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Sticky, because the board is long and the decision happens while
          scrolling it — a checkout button at the bottom of 193 teams is a
          checkout button nobody reaches. */}
      {sel.length > 0 && !checkout ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#111]/95 backdrop-blur px-6 py-4">
          <div className="max-w-5xl mx-auto flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black">
                {sel.length} team{sel.length > 1 ? 's' : ''} · $
                {sel.length * SEASON_PRICE}
              </p>
              <button
                onClick={() => setSel([])}
                className="text-xs text-white/40 hover:text-white/70"
              >
                Clear
              </button>
            </div>
            <button
              onClick={() => setCheckout(true)}
              className="rounded-full bg-[#facc15] px-7 py-3 text-sm font-black text-black hover:opacity-90"
            >
              Continue
            </button>
          </div>
        </div>
      ) : null}

      {checkout ? (
        <Checkout
          teams={(teams ?? []).filter((t) => sel.includes(t.id))}
          onClose={() => setCheckout(false)}
        />
      ) : null}

      <SiteFooter />
    </div>
  );
}

/**
 * Checkout.
 *
 * Deliberately a single price and a single button. Every tier, deposit, rate
 * lock and phased increase from the old page is gone: each one was a promise
 * about a future we cannot control yet, and scarcity language only works where
 * there is scarcity.
 */
function Checkout({ teams, onClose }: { teams: Team[]; onClose: () => void }) {
  const names = teams.map((t) => `${t.city} ${t.name}`);
  const total = teams.length * SEASON_PRICE;
  const list = names.join(', ');

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Asked here rather than after payment, because team_sponsors needs a name
  // and a link to render at all — collected later means a sponsor pays and
  // stays invisible until someone does it by hand.
  const [brand, setBrand] = useState('');
  const [site, setSite] = useState('');

  const go = async () => {
    setBusy(true);
    setErr(null);
    try {
      const { data, error } = await supabase.functions.invoke(
        'create-sponsor-square-checkout',
        {
          body: {
            businessName: brand.trim(),
            website: site.trim(),
            teams: teams.map((t) => ({
              teamKey: t.id,
              teamName: `${t.city} ${t.name}`,
              league: t.league,
            })),
          },
        },
      );
      // functions.invoke buries the real message on error.context — "non-2xx
      // status code" on its own tells a buyer nothing and tells us less.
      if (error) {
        let detail = '';
        try {
          detail = (await (error as any).context?.json())?.error ?? '';
        } catch {
          /* keep the generic message */
        }
        throw new Error(detail || 'Checkout could not be created.');
      }
      const url = (data as any)?.url;
      if (!url) throw new Error('Checkout did not come back with a payment link.');
      window.location.href = url;
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-3xl border border-white/10 bg-[#111] p-7 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-lg font-black leading-tight mb-1">
          {names.length === 1 ? names[0] : `${names.length} teams`}
        </p>
        <p className="text-xs text-white/40 mb-5">
          One sponsor per team · full season
        </p>

        {names.length > 1 ? (
          <div className="mb-5 rounded-2xl bg-white/[0.04] p-4 text-sm text-white/70 space-y-1">
            {names.map((n) => (
              <p key={n}>{n}</p>
            ))}
          </div>
        ) : null}

        <div className="rounded-2xl bg-white/[0.04] p-5 mb-5">
          <p className="text-3xl font-black">
            ${total}
            <span className="text-base font-bold text-white/40">
              {' '}
              / season{names.length > 1 ? ` · $${SEASON_PRICE} each` : ''}
            </span>
          </p>
          <p className="mt-2 text-sm text-white/50">
            Paid once. Your name goes up when the payment clears and stays for
            the season.
          </p>
        </div>

        <div className="mb-5 space-y-3">
          <input
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="Business name"
            className="w-full rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-base placeholder:text-white/30 focus:outline-none focus:border-[#facc15]/60"
          />
          <input
            value={site}
            onChange={(e) => setSite(e.target.value)}
            placeholder="Website"
            className="w-full rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-base placeholder:text-white/30 focus:outline-none focus:border-[#facc15]/60"
          />
          <p className="text-xs text-white/35">
            This is the name fans see in the room, and where tapping it takes
            them.
          </p>
        </div>

        {err ? (
          <p className="mb-4 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {err}
          </p>
        ) : null}

        <button
          onClick={go}
          disabled={busy || !brand.trim() || !site.trim()}
          className="w-full rounded-full bg-[#facc15] px-6 py-4 text-base font-black text-black hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {busy ? 'Opening checkout…' : `Pay $${total}`}
        </button>

        <button
          onClick={onClose}
          className="w-full mt-3 py-3 text-sm font-bold text-white/40 hover:text-white/70 transition-colors"
        >
          Back to the board
        </button>
      </div>
    </div>
  );
}

/**
 * The three places a sponsor shows up, highlighted one at a time on a real
 * screenshot of a real room.
 *
 * Motion earns its place here: the page is asking a bar owner to believe his
 * name appears in three different spots inside an app he has never opened.
 * Pointing at each one in turn, on a photograph, is the shortest path from
 * claim to belief — and it beats three paragraphs he will not read.
 */
function Placements() {
  const SPOTS = [
    {
      label: 'Top of every room',
      note: 'Your name under the team name, every game, all season.',
      // Percentages of the screenshot, so the ring lands correctly at any width.
      box: { top: '25%', left: '4%', width: '92%', height: '7%' },
    },
    {
      label: 'On every bot card',
      note: 'The bot posts scores, plays and news all season. Each one carries your name.',
      box: { top: '70%', left: '4%', width: '80%', height: '22%' },
    },
    {
      label: 'On the team page',
      note: "The public page Google indexes for that team. Real, crawlable, live today.",
      box: { top: '13%', left: '4%', width: '92%', height: '10%' },
    },
  ];

  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setI((n) => (n + 1) % SPOTS.length), 2600);
    return () => clearInterval(t);
  }, [paused, SPOTS.length]);

  const spot = SPOTS[i];

  return (
    <div
      className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-center"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="relative">
        <img
          src="/sponsor-room.png"
          alt="A Side Huddle room with the sponsor's name above the live game"
          className="w-full rounded-2xl border border-white/10"
        />
        <div
          className="pointer-events-none absolute rounded-lg"
          style={{
            ...spot.box,
            border: '2px solid #facc15',
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)',
            transition: 'all 480ms cubic-bezier(.4,0,.2,1)',
          }}
        />
        <p className="mt-3 text-xs text-white/30">
          A live room today. TicketsR sponsors the Yankees.
        </p>
      </div>

      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-[#facc15] font-black mb-5">
          Three places, one price
        </p>

        <div className="space-y-2">
          {SPOTS.map((sp, n) => (
            <button
              key={sp.label}
              onClick={() => { setI(n); setPaused(true); }}
              className={`w-full text-left rounded-2xl border p-4 transition-colors ${
                n === i
                  ? 'border-[#facc15] bg-[#facc15]/10'
                  : 'border-white/10 hover:border-white/25'
              }`}
            >
              <p className={`text-base font-black ${n === i ? '' : 'text-white/50'}`}>
                {sp.label}
              </p>
              {n === i ? (
                <p className="mt-1 text-sm leading-relaxed text-white/60">{sp.note}</p>
              ) : null}
            </button>
          ))}
        </div>

        <p className="mt-6 text-sm leading-relaxed text-white/40">
          One brand per team. Side Huddle is early and rooms are still filling —
          we would rather you knew that for $100 than found it out for $1,000.
          What you are buying is the first position on a team, and it stays yours
          for as long as you keep it.
        </p>
      </div>
    </div>
  );
}
