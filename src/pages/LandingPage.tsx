import React, { useEffect, useState } from 'react';
import { SiteNav, SiteFooter } from '@/components/site/SiteChrome';
import { StoreButton, SUBTAGLINE } from '@/components/site/AppSections';
import { GamedayTicker } from '@/components/site/GamedayTicker';
import { STORE_CAMPAIGN } from '@/lib/appStore';

/**
 * App-download landing page.
 *
 * One job: get the App Store tapped. Most traffic arrives from an outreach
 * email on a phone, so the CTA is above the fold and again at the close.
 *
 * Order: hero (two phones: a room in front, Home tucked behind) → gameday
 * ticker → three steps → the bot → dual cam → "Get your crew in the room".
 * Every phone shows a real screenshot from the app (public/landing).
 *
 * The /t/<slug> team pages still render AppSections; this page no longer does.
 */

const GOLD = '#FFD700';

/** The rooms the front phone cycles through. */
const ROOM_SHOTS = [
  { src: '/landing/room-chat.jpg', alt: 'A room of friends talking through the Chiefs game' },
  { src: '/landing/room-dualcam.jpg', alt: 'A dual-cam reaction clip dropped into the room' },
  { src: '/landing/room-live.jpg', alt: 'A live game room with the score up top' },
  { src: '/landing/room-bot.jpg', alt: 'The bot posting the play-by-play into a room' },
];

const STEPS = [
  {
    n: '01',
    title: "See who's watching",
    desc: 'Gameday: friends at the game light up, live game huddles show the score. You always know where the party is.',
    img: '/landing/home.jpg',
    alt: 'Home: friends at the game and live game huddles with scores',
    // The friends strip and the live game huddles are the point of this
    // screen, so the phone crops in on them rather than the whole Home.
    zoom: true,
  },
  {
    n: '02',
    title: 'Jump in',
    desc: "One tap into the live game huddle. Or spin up your own for your crew — it lives for that game, then it's gone. No invites, no setup.",
    img: '/landing/step-spinup.jpg',
    alt: 'A side huddle spun up for the game, the crew already talking',
  },
  {
    n: '03',
    title: 'Feel every play together',
    desc: 'Every score, bad call, and celebration lands in the room in real time. React with your face and the field in one clip.',
    img: '/landing/room-chat.jpg',
    alt: 'A lively room reacting to the game, with a dual-cam clip',
  },
];

/** Motion, defined once. Everything stops for prefers-reduced-motion. */
const MOTION_CSS = `
@keyframes sh-float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-12px) } }
.sh-float-a { animation: sh-float 6s ease-in-out infinite }
.sh-float-b { animation: sh-float 7.5s ease-in-out -2.5s infinite }
@keyframes sh-ping { 0% { transform: scale(1); opacity: .75 } 80%,100% { transform: scale(2.6); opacity: 0 } }
.sh-ping { animation: sh-ping 1.6s cubic-bezier(0,0,.2,1) infinite }
@media (prefers-reduced-motion: reduce) {
  .sh-float-a, .sh-float-b, .sh-ping { animation: none }
}
`;

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const m = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!m) return;
    setReduced(m.matches);
    const on = () => setReduced(m.matches);
    m.addEventListener?.('change', on);
    return () => m.removeEventListener?.('change', on);
  }, []);
  return reduced;
}

/** A full iPhone around a real screenshot (1320×2868). */
function Phone({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`relative rounded-[2.6rem] bg-[#1C1C1F] p-[9px] ring-1 ring-white/15 shadow-[0_40px_90px_rgba(0,0,0,0.7)] ${className}`}
    >
      <div className="relative overflow-hidden rounded-[2.1rem] bg-black" style={{ aspectRatio: '1320 / 2868' }}>
        {children}
        <div className="pointer-events-none absolute left-1/2 top-[1.3%] h-[3.2%] w-[30%] -translate-x-1/2 rounded-full bg-black" />
      </div>
    </div>
  );
}

function Shot({ src, alt, zoom = false }: { src: string; alt: string; zoom?: boolean }) {
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className="block h-full w-full object-cover"
      // Zoomed: the top of Home (friends + game huddles) fills the screen.
      style={zoom ? { transform: 'scale(1.15) translateY(-3%)', transformOrigin: '25% 0%' } : undefined}
    />
  );
}

/** The front phone: room screenshots crossfading, with the live "watching" pill. */
function RoomPhone() {
  const reduced = useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduced) return;
    const t = setInterval(() => setI((v) => (v + 1) % ROOM_SHOTS.length), 3600);
    return () => clearInterval(t);
  }, [reduced]);

  return (
    <Phone>
      {ROOM_SHOTS.map((s, k) => (
        <img
          key={s.src}
          src={s.src}
          alt={k === i ? s.alt : ''}
          aria-hidden={k !== i}
          className="absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ease-in-out"
          style={{ opacity: k === i ? 1 : 0 }}
        />
      ))}
    </Phone>
  );
}

function WatchingPill() {
  return (
    <div className="flex items-center gap-2 rounded-full border border-white/15 bg-black/85 px-3 py-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.6)] backdrop-blur">
      <span className="relative flex h-2.5 w-2.5">
        <span className="sh-ping absolute inline-flex h-full w-full rounded-full bg-[#4ADE80]" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#4ADE80]" />
      </span>
      <span className="text-xs font-semibold text-white">3 watching</span>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#0a0a0a] text-white">
      <style>{MOTION_CSS}</style>
      <SiteNav />

      {/* ── Hero: copy left, two phones right (room in front, Home behind) ── */}
      <section
        className="relative"
        style={{ background: 'radial-gradient(55% 60% at 75% 40%, rgba(255,215,0,0.10) 0%, rgba(10,10,10,0) 70%)' }}
      >
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-12 pt-8 md:grid-cols-[1.05fr_1fr] md:gap-6 md:pb-16 md:pt-14">
          <div className="text-center md:text-left">
            <p className="text-xs font-semibold uppercase tracking-[0.28em]" style={{ color: GOLD }}>
              The digital tailgate
            </p>
            <h1 className="mt-4 font-orbitron text-[2.6rem] font-extrabold leading-[1.04] tracking-tight sm:text-6xl">
              Your crew.
              <br />
              The game.
              <br />
              <span style={{ color: GOLD }}>One room.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-md text-xl leading-snug text-white/80 md:mx-0">{SUBTAGLINE}</p>
            <div className="mt-8 flex flex-col items-center gap-3 md:items-start">
              <StoreButton large campaign={STORE_CAMPAIGN.landing} />
              <p className="text-xs text-white/45">Free · iPhone · no ads inside your huddle</p>
            </div>
          </div>

          <div className="relative mx-auto h-[520px] w-full max-w-[420px] sm:h-[600px]">
            {/* Home, tucked behind */}
            <div className="sh-float-b absolute right-0 top-0 w-[58%] opacity-60">
              <div className="rotate-[7deg]">
                <Phone>
                  <Shot src="/landing/home.jpg" alt="The Side Huddle home screen: friends, game huddles, your huddles" />
                </Phone>
              </div>
            </div>
            {/* The room, in front */}
            <div className="sh-float-a absolute bottom-0 left-0 z-10 w-[64%]">
              <div className="-rotate-[3deg]">
                <RoomPhone />
                <div className="absolute -right-6 top-[14%] sm:-right-10">
                  <WatchingPill />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Gameday ticker: real rooms and upcoming games ── */}
      <GamedayTicker />

      {/* ── Three steps ── */}
      <section className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
        <h2 className="text-center font-orbitron text-2xl font-bold sm:text-3xl">
          How it <span style={{ color: GOLD }}>works</span>
        </h2>
        <ol className="mt-10 grid gap-10 sm:grid-cols-3 sm:gap-8">
          {STEPS.map((s) => (
            <li key={s.n} className="flex flex-col items-center text-center">
              <Phone className="w-[210px]">
                <Shot src={s.img} alt={s.alt} zoom={'zoom' in s && s.zoom} />
              </Phone>
              <span className="mt-6 font-mono text-xs tracking-[0.2em]" style={{ color: GOLD }}>
                {s.n}
              </span>
              <h3 className="mt-1 text-xl font-bold">{s.title}</h3>
              <p className="mt-2 max-w-[260px] text-white/70">{s.desc}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ── The bot ── */}
      <section className="border-t border-white/5">
        <div className="mx-auto grid max-w-5xl items-center gap-10 px-5 py-16 sm:py-20 md:grid-cols-2">
          <div className="order-2 text-center md:order-1 md:text-left">
            <p className="text-xs font-semibold uppercase tracking-[0.28em]" style={{ color: GOLD }}>
              The bot
            </p>
            <h2 className="mt-3 font-orbitron text-2xl font-bold leading-tight sm:text-4xl">
              It keeps up so you don't have to.
            </h2>
            <p className="mx-auto mt-4 max-w-md text-lg text-white/75 md:mx-0">
              Scores, big plays, news and clips land in your room on their own. Nobody has to go look.
            </p>
          </div>
          <div className="order-1 flex justify-center md:order-2">
            <Phone className="sh-float-a w-[250px] sm:w-[280px]">
              <Shot src="/landing/home.jpg" alt="The Side Huddle home screen: friends, game huddles with live scores, your huddles" />
            </Phone>
          </div>
        </div>
      </section>

      {/* ── Dual cam ── */}
      <section className="border-t border-white/5">
        <div className="mx-auto grid max-w-5xl items-center gap-10 px-5 py-16 sm:py-20 md:grid-cols-2">
          <div className="flex justify-center">
            <Phone className="sh-float-b w-[250px] sm:w-[280px]">
              <Shot src="/landing/room-dualcam.jpg" alt="A dual-cam reaction clip in a room" />
            </Phone>
          </div>
          <div className="text-center md:text-left">
            <p className="text-xs font-semibold uppercase tracking-[0.28em]" style={{ color: GOLD }}>
              Dual cam
            </p>
            <h2 className="mt-3 font-orbitron text-2xl font-bold leading-tight sm:text-4xl">
              Your face and the field. One clip.
            </h2>
            <p className="mx-auto mt-4 max-w-md text-lg text-white/75 md:mx-0">
              Front and back camera at once — the reaction and the moment, dropped straight into the room.
            </p>
          </div>
        </div>
      </section>

      {/* ── Close ── */}
      <section
        className="border-t border-white/5 px-5 py-20 text-center sm:py-28"
        style={{ background: 'radial-gradient(50% 70% at 50% 100%, rgba(255,215,0,0.10) 0%, rgba(10,10,10,0) 70%)' }}
      >
        <h2 className="mx-auto max-w-3xl font-orbitron text-4xl font-extrabold leading-[1.05] sm:text-6xl">
          Get your crew <span style={{ color: GOLD }}>in the room.</span>
        </h2>
        <div className="mt-10 flex justify-center">
          <StoreButton large campaign={STORE_CAMPAIGN.landing} />
        </div>
        <p className="mt-4 text-xs text-white/45">Free · iPhone</p>
      </section>

      <SiteFooter />
    </div>
  );
}
