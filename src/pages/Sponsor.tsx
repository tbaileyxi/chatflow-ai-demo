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

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (teams ?? []).filter((t) => {
      if (league !== 'All' && t.league !== league) return false;
      if (!needle) return true;
      return `${t.city} ${t.name}`.toLowerCase().includes(needle);
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
        <h1 className="text-4xl sm:text-6xl font-black leading-[1.02] tracking-tight">
          Your name in the room
          <br />
          <span className="text-[#facc15]">when the game is on.</span>
        </h1>
        {/* Said before the offer, because a bar owner landing here has never
            heard of us. The old hero sold a placement inside a product the
            reader could not picture. */}
        <p className="mt-6 text-lg leading-relaxed text-white/60 max-w-xl">
          Side Huddle is the digital tailgate — the app fan groups use to watch
          the game together. One brand per team, in every one of those rooms,
          all season.
        </p>
        <a
          href={APP_STORE_URL}
          target="_blank"
          rel="noopener"
          className="mt-5 inline-flex items-center gap-2 text-sm font-black text-[#facc15] hover:opacity-80"
        >
          See the app on the App Store →
        </a>

        {teams ? (
          <p className="mt-6 text-sm text-white/40">
            {open} teams open · {taken} taken
          </p>
        ) : null}
      </section>

      {/* ── Proof, not prose ──
          The three explanatory cards that were here read as filler and nobody
          finished them. A real screenshot of a real sponsor in a real room
          does the same job in one glance, and it is the only claim on this
          page that a buyer can verify with their own eyes. */}
      <section className="px-6 pb-16 max-w-5xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
          <div className="relative">
            <img
              src="/sponsor-room.png"
              alt="A Side Huddle room with PRESENTED BY TICKETSR above the live game"
              className="w-full rounded-2xl border border-white/10"
            />
            {/* Points at the sponsor line. Percentages, because the callout has
                to stay on the line at every width. */}
            <div
              className="absolute hidden sm:flex items-center gap-2 pointer-events-none"
              style={{ top: '24%', left: '100%', marginLeft: -14 }}
            >
              <div style={{ width: 42, height: 2, background: '#facc15' }} />
              <span className="whitespace-nowrap rounded-full bg-[#facc15] px-3 py-1.5 text-[11px] font-black text-black">
                This is you
              </span>
            </div>
            <p className="mt-3 text-xs text-white/30">
              A live room today. TicketsR sponsors the Yankees.
            </p>
          </div>

          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-[#facc15] font-black mb-5">
              What you get
            </p>
            <ul className="space-y-4">
              {[
                'Top of the room, every game, all season.',
                'Every huddle for your team — including the ones fans make next week.',
                'On every score, every play, every headline the bot drops.',
                'Your link on the team page Google already indexes.',
                'Nobody else. One brand per team.',
              ].map((b) => (
                <li key={b} className="flex gap-3">
                  <span className="text-[#facc15] font-black leading-6">→</span>
                  <span className="text-lg leading-7">{b}</span>
                </li>
              ))}
            </ul>

            <a
              href="#board"
              className="mt-8 inline-block rounded-full bg-[#facc15] px-8 py-4 text-base font-black text-black hover:opacity-90 transition-opacity"
            >
              Claim your team — $100
            </a>

            {/* Said out loud, because a sponsor who finds this out later is a
                sponsor who does not renew. */}
            <p className="mt-5 text-sm leading-relaxed text-white/40">
              Side Huddle is early and rooms are still filling. We would rather
              you knew that for $100 than found it out for $1,000. What you are
              buying is the first position on a team, and it stays yours for as
              long as you keep it.
            </p>
          </div>
        </div>
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
