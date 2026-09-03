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
  /** Six positions. A name means taken, null means open. */
  slots: (string | null)[];
};

// Six is a scoreboard. Unlimited is worth nothing again, which is the problem
// the exclusive-at-$100 model already had.
const SLOTS = 6;

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
  const [openTeam, setOpenTeam] = useState<string | null>(null);

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
          .select('team_id, brand_name, end_date, slot')
          .eq('is_active', true),
      ]);

      const now = Date.now();
      // Who holds which of the six. A team is no longer taken or open — it has
      // slots, and the ring needs to know which ones are filled and by whom.
      const byTeam = new Map<string, (string | null)[]>();
      for (const r of (live ?? []) as any[]) {
        if (r.end_date && new Date(r.end_date).getTime() < now) continue;
        const slots = byTeam.get(r.team_id) ?? Array(SLOTS).fill(null);
        const i = r.slot && r.slot >= 1 && r.slot <= SLOTS ? r.slot - 1
          : slots.findIndex((x: string | null) => x === null);
        if (i >= 0) slots[i] = r.brand_name;
        byTeam.set(r.team_id, slots);
      }

      setTeams(
        ((rows as any[]) ?? []).map((t) => ({
          ...t,
          slots: byTeam.get(t.id) ?? Array(SLOTS).fill(null),
        })) as Team[],
      );
    })();
  }, []);

  const matches = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return [];
    return (teams ?? []).filter((t) =>
      `${t.city} ${t.name}`.toLowerCase().includes(n),
    );
  }, [teams, q]);

  const chosen = (teams ?? []).find((t) => t.id === openTeam) ?? null;

  // Something is always in the ring. An empty circle explains nothing, and the
  // offer should be legible before anybody types. Prefers a team that has
  // sponsors, so the taken/open split is visible rather than six empty rings.
  const sample = useMemo(() => {
    const all = teams ?? [];
    return (
      all.find((t) => t.slots.some(Boolean)) ??
      all.find((t) => t.league === 'NFL') ??
      all[0] ?? null
    );
  }, [teams]);

  const shown = chosen ?? sample;


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
          <span className="text-[#facc15]">$100</span> and you support
          <br />
          your team's fans all season.
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-white/60 max-w-xl">
          Side Huddle is the digital tailgate — the app fan groups use to watch
          the game together. Your name sits in those rooms all season, as one of
          six who back them. Not an advert beside the fans; a business behind
          them.
        </p>

        <a
          href={APP_STORE_URL}
          target="_blank"
          rel="noopener"
          className="mt-6 inline-flex items-center gap-2 text-sm font-black text-white/40 hover:text-white/70"
        >
          See the app first →
        </a>
      </section>

      {/* ── Claim your team ──
          The counters that were here ("1,140 spots open") are gone. A big
          number of things nobody has bought is not encouragement, it is
          evidence — and zero taken on a team read as nobody wants this.
          What replaces them is the thing itself: the search, and a real team
          already in the ring so the offer is visible before anything is typed. */}
      <section id="board" className="px-6 pb-8 max-w-3xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-center">
          Claim your team
        </h2>

        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpenTeam(null); }}
          placeholder="Type your team — Browns, Ohio State, Yankees…"
          className="mt-6 w-full rounded-full border border-white/15 bg-white/[0.04] px-6 py-4 text-lg placeholder:text-white/30 focus:outline-none focus:border-[#facc15]/60"
        />

        {q.trim() && !openTeam ? (
          <div className="mt-3 space-y-1">
            {matches.slice(0, 6).map((t) => {
              const left = t.slots.filter((x) => !x).length;
              return (
                <button
                  key={t.id}
                  onClick={() => { setOpenTeam(t.id); setQ(`${t.city} ${t.name}`); }}
                  className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-left hover:border-[#facc15]/60"
                >
                  {t.logo_url ? (
                    <img src={t.logo_url} alt="" className="h-8 w-8 object-contain" />
                  ) : <div className="h-8 w-8 rounded-full bg-white/5" />}
                  <span className="flex-1 text-sm font-black">{t.city} {t.name}</span>
                  <span className={`text-xs font-black ${left ? 'text-[#facc15]' : 'text-white/30'}`}>
                    {left ? `${left} of ${SLOTS} open` : 'full'}
                  </span>
                </button>
              );
            })}
            {matches.length === 0 ? (
              <p className="py-6 text-center text-sm text-white/40">
                No team matches that.
              </p>
            ) : null}
          </div>
        ) : null}

        {shown ? <Ring team={shown} selected={sel} onToggle={(id) =>
          setSel((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id])
        } /> : null}

        <a
          href="#benefits"
          className="mt-8 flex flex-col items-center gap-1 text-sm font-black text-white/50 hover:text-white"
        >
          See what you get
          <span aria-hidden className="text-lg leading-none">↓</span>
        </a>
      </section>

      {/* ── What you get ── */}
      <section id="benefits" className="px-6 pb-16 max-w-5xl mx-auto">
        <TheDrop />
        <Placements />
      </section>

      {checkout ? (
        <Checkout
          picks={sel.map((k) => {
            const [teamId, slot] = k.split(':');
            const t = (teams ?? []).find((x) => x.id === teamId)!;
            return { team: t, slot: Number(slot) };
          }).filter((p) => p.team)}
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
function Checkout({
  picks, onClose,
}: {
  picks: { team: Team; slot: number }[];
  onClose: () => void;
}) {
  // A pick is a team AND a position, because six can be sold on one team and
  // "the Browns" no longer identifies what was bought.
  const names = picks.map((p) => `${p.team.city} ${p.team.name} (spot ${p.slot})`);
  const total = picks.length * SEASON_PRICE;
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
            teams: picks.map((p) => ({
              teamKey: `${p.team.id}:${p.slot}`,
              teamName: `${p.team.city} ${p.team.name} (spot ${p.slot})`,
              league: p.team.league,
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
 * The board, actually dropping.
 *
 * Every other claim on this page is a sentence. This is the thing itself,
 * recorded off a real room on a real phone — which is the only argument that
 * survives a bar owner asking "yeah, but what does it actually look like".
 * It leads the section for that reason: motion before description.
 */
function TheDrop() {
  return (
    <div className="mb-14">
      <p className="text-[11px] uppercase tracking-[0.2em] text-[#facc15] font-black mb-5">
        What it looks like
      </p>

      <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
        <div>
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-black">
            <img
              src="/sponsor-drop.gif"
              width={603}
              height={260}
              alt="The sponsor board dropping over the game bar in a Side Huddle room"
              className="block w-full"
              loading="lazy"
              decoding="async"
            />
          </div>
          <p className="mt-3 text-xs text-white/30">
            Recorded in a Yankees room. TicketsR sponsors the Yankees.
          </p>
        </div>

        <div>
          <h3 className="text-2xl sm:text-3xl font-black leading-tight">
            It drops, like a board at the stadium
          </h3>
          <p className="mt-4 text-base leading-relaxed text-white/60">
            A thin line with your name on it sits at the top of every room for
            your team, all season. Every so often it swells down over the score
            for three seconds, says who you are, and goes back up.
          </p>
          <p className="mt-4 text-base leading-relaxed text-white/60">
            Over the score on purpose — that is the one place on the screen
            everybody is already looking. Briefly on purpose too. Nobody stays
            in a room that shouts at them.
          </p>
        </div>
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
  // Measured off the screenshot itself (760x874), not guessed. The old boxes
  // pointed at the room title instead of the sponsor line, and at empty space
  // instead of the bot message.
  const SPOTS = [
    {
      label: 'Top of every room',
      note: '"Your brand supports these fans", on the board in every room for that team.',
      box: { top: '25.7%', left: '3%', width: '94%', height: '4.2%' },
    },
    {
      label: 'On the bot cards',
      note: 'The bot posts scores, plays and news all season. Your brand rides along.',
      box: { top: '70.4%', left: '3%', width: '80%', height: '21.2%' },
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
      <div>
        {/* overflow-hidden is load-bearing: the spotlight is a very large box
            shadow, and without a clip it darkens the entire page rather than
            the area around the highlight. */}
        <div className="relative overflow-hidden rounded-2xl border border-white/10">
          <img
            src="/sponsor-room.png"
            alt="A Side Huddle room with the sponsor's brand above the live game"
            className="block w-full"
          />
          <div
            className="pointer-events-none absolute rounded-md"
            style={{
              ...spot.box,
              border: '2px solid #facc15',
              boxShadow: '0 0 0 2000px rgba(0,0,0,0.55)',
              transition: 'all 480ms cubic-bezier(.4,0,.2,1)',
            }}
          />
        </div>
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

        <div className="mt-4 rounded-2xl border border-white/10 p-4">
          <p className="text-base font-black">And on the team page</p>
          <p className="mt-1 text-sm leading-relaxed text-white/60">
            Your brand and a link to your site on the public page Google indexes
            for that team. A different screen from the one above — that is why it
            is not marked on it.
          </p>
        </div>

        <a
          href="#board"
          className="mt-6 inline-block rounded-full bg-[#facc15] px-8 py-4 text-base font-black text-black hover:opacity-90"
        >
          Claim your team — $100
        </a>

        <p className="mt-5 text-sm leading-relaxed text-white/40">
          Six sponsors per team, no more. Side Huddle is early and rooms are still filling —
          we would rather you knew that for $100 than found it out for $1,000.
          What you are buying is the first position on a team, and it stays yours
          for as long as you keep it.
        </p>
      </div>
    </div>
  );
}

/**
 * The team, and the six positions around it.
 *
 * A list of 195 rows is something to be endured. A ring is something you look
 * at: the fans are in the middle, the six who back them sit around, and what is
 * left is visible rather than described. It is also the honest shape of the
 * offer — the team is the point, the sponsors are the surround.
 */
function Ring({
  team, selected, onToggle,
}: {
  team: Team;
  selected: string[];
  onToggle: (id: string) => void;
}) {
  const openCount = team.slots.filter((x) => !x).length;

  return (
    <div className="mt-10">
      <div className="relative mx-auto aspect-square w-full max-w-[420px]">
        {/* The fans, in the middle. */}
        <div className="absolute left-1/2 top-1/2 flex h-[42%] w-[42%] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border border-white/10 bg-white/[0.04] p-3 text-center">
          {team.logo_url ? (
            <img src={team.logo_url} alt="" className="h-12 w-12 object-contain" />
          ) : null}
          <p className="mt-1 text-[11px] font-black uppercase leading-tight tracking-wider text-white/70">
            {team.city} {team.name}
          </p>
          <p className="text-[10px] font-black uppercase tracking-widest text-[#facc15]">
            fans
          </p>
        </div>

        {team.slots.map((holder, i) => {
          // Six around a circle, starting at the top.
          const angle = (i / SLOTS) * 2 * Math.PI - Math.PI / 2;
          const x = 50 + 38 * Math.cos(angle);
          const y = 50 + 38 * Math.sin(angle);
          const id = `${team.id}:${i + 1}`;
          const isSel = selected.includes(id);
          return (
            <button
              key={i}
              disabled={!!holder}
              onClick={() => onToggle(id)}
              style={{ left: `${x}%`, top: `${y}%` }}
              className={`absolute flex h-[26%] w-[26%] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border p-2 text-center transition-colors ${
                holder
                  ? 'border-white/5 bg-white/[0.02] cursor-default'
                  : isSel
                    ? 'border-[#facc15] bg-[#facc15]/15'
                    : 'border-dashed border-white/25 hover:border-[#facc15]/70'
              }`}
            >
              {holder ? (
                <span className="text-[10px] font-black leading-tight text-white/35">
                  {holder}
                </span>
              ) : (
                <>
                  <span className={`text-[10px] font-black ${isSel ? 'text-[#facc15]' : 'text-white/50'}`}>
                    {isSel ? 'yours' : 'open'}
                  </span>
                  <span className="text-[9px] text-white/30">${SEASON_PRICE}</span>
                </>
              )}
            </button>
          );
        })}
      </div>

      <p className="mt-6 text-center text-sm text-white/50">
        {openCount === 0
          ? `All six spots on ${team.city} ${team.name} are taken.`
          : `${openCount} of ${SLOTS} spots open. Tap one.`}
      </p>
    </div>
  );
}
