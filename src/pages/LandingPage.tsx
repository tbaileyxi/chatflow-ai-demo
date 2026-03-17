import React, { useState } from 'react';
import shLogo from '@/assets/sh-logo-updated.png';
import { supabase } from '@/integrations/supabase/client';

// ─── Placeholder store links — swap when live ───────────────────────────────
const APP_STORE_URL = '#';
const PLAY_STORE_URL = '#';
// ────────────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const [error, setError] = useState('');

  const handleNotify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setError('');
    const { error: dbError } = await supabase
      .from('app_waitlist')
      .insert({ email: email.trim().toLowerCase() });
    if (dbError && dbError.code !== '23505') {
      // 23505 = unique violation (already signed up) — treat as success
      setError('Something went wrong. Please try again.');
      return;
    }
    setSubmitted(true);
    setEmail('');
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white overflow-x-hidden">

      {/* ── Nav ── */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-5xl mx-auto">
        <div className="flex items-center gap-2">
          <img src={shLogo} alt="Side Huddle Sports" className="h-8 w-8 object-contain rounded-full" />
          <span className="font-orbitron font-bold text-base text-[#FFD700] tracking-wide">
            SIDE HUDDLE
          </span>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="flex flex-col items-center text-center px-6 pt-12 pb-16 max-w-2xl mx-auto">
        {/* Pill badge */}
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#FFD700]/30 bg-[#FFD700]/10 px-4 py-1.5">
          <span className="h-2 w-2 rounded-full bg-[#FFD700] animate-pulse" />
          <span className="text-xs font-medium text-[#FFD700] tracking-widest uppercase">
            Coming to App Store &amp; Google Play
          </span>
        </div>

        <h1 className="font-orbitron text-4xl sm:text-5xl font-extrabold leading-tight tracking-tight mb-4">
          Follow Your Teams.{' '}
          <br />
          <span className="text-[#FFD700]">Chat With Your Crew.</span>
        </h1>

        <p className="text-white/60 text-lg leading-relaxed max-w-lg mb-10">
          Side Huddle pulls together every player tweet, coach update, and breaking
          news into one live group chat — so you and your friends never miss a moment.
        </p>

        {/* Store badges */}
        <div className="flex flex-col sm:flex-row items-center gap-4 mb-8">
          <StoreBadge
            href={APP_STORE_URL}
            icon={<AppleIcon />}
            label="Download on the"
            store="App Store"
          />
          <StoreBadge
            href={PLAY_STORE_URL}
            icon={<PlayIcon />}
            label="Get it on"
            store="Google Play"
          />
        </div>

        {/* Email waitlist */}
        {!submitted ? (
          <form onSubmit={handleNotify} className="w-full max-w-sm">
            <p className="text-xs text-white/40 mb-3">
              Not live in your region yet? Get notified first.
            </p>
            <div className="flex gap-2">
              <input
                type="email"
                required
                placeholder="your@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm placeholder:text-white/30 focus:outline-none focus:border-[#FFD700]/50 transition-colors"
              />
              <button
                type="submit"
                className="bg-[#FFD700] text-black font-semibold text-sm px-5 py-3 rounded-xl hover:bg-yellow-300 transition-colors whitespace-nowrap"
              >
                Notify me
              </button>
            </div>
            {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
          </form>
        ) : (
          <div className="text-sm text-[#FFD700] border border-[#FFD700]/30 bg-[#FFD700]/10 rounded-xl px-6 py-3">
            ✓ You're on the list — we'll ping you when it drops.
          </div>
        )}
      </section>

      {/* ── Phone mockup + feature highlight ── */}
      <section className="flex flex-col lg:flex-row items-center gap-12 max-w-5xl mx-auto px-6 py-16">
        {/* Mockup */}
        <div className="flex-shrink-0">
          <PhoneMockup />
        </div>

        {/* Feature list */}
        <div className="flex flex-col gap-8 text-left max-w-lg">
          <Feature
            emoji="📡"
            title="All your team's socials, one feed"
            desc="Players, coaches, beat reporters — every tweet and post, curated in real time for your team."
          />
          <Feature
            emoji="🏆"
            title="Huddle up with your crew"
            desc="Private group chats that light up during games. React, predict, trash-talk — all in one place."
          />
          <Feature
            emoji="🎯"
            title="Live prediction markets"
            desc="Make friendly bets with your huddle using Chips. Who's starting? Who scores first? You decide."
          />
          <Feature
            emoji="🔔"
            title="Game-time alerts that matter"
            desc="Push notifications tied to real scores, roster moves, and breaking news — nothing you don't care about."
          />
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="bg-white/[0.02] border-y border-white/5 py-16 px-6">
        <div className="max-w-4xl mx-auto text-center mb-12">
          <h2 className="font-orbitron text-2xl sm:text-3xl font-bold text-[#FFD700]">
            How It Works
          </h2>
          <p className="text-white/50 mt-2 text-sm">Get set up in under 60 seconds.</p>
        </div>

        <div className="max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-8">
          {[
            { step: '01', title: 'Pick your teams', desc: 'NFL, NBA, MLB, EPL and more. Follow as many as you want.' },
            { step: '02', title: 'Create a Huddle', desc: 'Start a private group for your friends — or join a public one for your team.' },
            { step: '03', title: 'Chat live', desc: 'Your team feed drops straight into the chat during games.' },
          ].map(({ step, title, desc }) => (
            <div key={step} className="flex flex-col items-center text-center gap-3">
              <div className="font-orbitron text-3xl font-extrabold text-[#FFD700]/20">
                {step}
              </div>
              <h3 className="font-semibold text-white text-base">{title}</h3>
              <p className="text-white/50 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Social proof strip ── */}
      <section className="py-10 px-6 text-center">
        <p className="text-white/30 text-xs uppercase tracking-widest font-medium mb-6">
          Built for fans of
        </p>
        <div className="flex flex-wrap justify-center gap-3 max-w-2xl mx-auto">
          {['NFL', 'NBA', 'MLB', 'NHL', 'EPL', 'La Liga', 'UFC', 'College Football', 'March Madness'].map(league => (
            <span
              key={league}
              className="text-xs font-medium text-white/60 border border-white/10 rounded-full px-3 py-1"
            >
              {league}
            </span>
          ))}
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section className="py-16 px-6 text-center border-t border-white/5">
        <h2 className="font-orbitron text-2xl sm:text-3xl font-bold mb-4">
          Ready to{' '}
          <span className="text-[#FFD700]">huddle up?</span>
        </h2>
        <p className="text-white/50 text-sm mb-8 max-w-sm mx-auto">
          Download the app and bring your game-day crew together.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <StoreBadge href={APP_STORE_URL} icon={<AppleIcon />} label="Download on the" store="App Store" large />
          <StoreBadge href={PLAY_STORE_URL} icon={<PlayIcon />} label="Get it on" store="Google Play" large />
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/5 px-6 py-8">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src={shLogo} alt="Side Huddle" className="h-5 w-5 object-contain rounded-full opacity-60" />
            <span className="text-xs text-white/30 font-orbitron">SIDE HUDDLE SPORTS</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-white/30">
            <a href="/faq" className="hover:text-white/60 transition-colors">FAQ</a>
            <a href="#" className="hover:text-white/60 transition-colors">Privacy</a>
            <a href="#" className="hover:text-white/60 transition-colors">Terms</a>
            <a href="https://x.com/sidehuddlesports" target="_blank" rel="noopener noreferrer" className="hover:text-white/60 transition-colors">
              𝕏 @sidehuddlesports
            </a>
          </div>
        </div>
      </footer>

    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Feature({ emoji, title, desc }: { emoji: string; title: string; desc: string }) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 h-10 w-10 rounded-xl bg-[#FFD700]/10 flex items-center justify-center text-xl">
        {emoji}
      </div>
      <div>
        <h3 className="font-semibold text-white mb-1">{title}</h3>
        <p className="text-white/50 text-sm leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

function StoreBadge({
  href,
  icon,
  label,
  store,
  large,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  store: string;
  large?: boolean;
}) {
  const isPlaceholder = href === '#';
  return (
    <a
      href={href}
      onClick={isPlaceholder ? e => e.preventDefault() : undefined}
      className={`relative flex items-center gap-3 border rounded-xl transition-all
        ${large ? 'px-6 py-3.5' : 'px-5 py-3'}
        ${isPlaceholder
          ? 'border-white/10 bg-white/5 opacity-60 cursor-not-allowed'
          : 'border-white/20 bg-white/5 hover:bg-white/10 hover:border-white/30 cursor-pointer'
        }`}
    >
      <div className="text-white">{icon}</div>
      <div className="text-left">
        <div className={`text-white/50 leading-none ${large ? 'text-xs' : 'text-[10px]'}`}>{label}</div>
        <div className={`font-semibold text-white leading-tight mt-0.5 ${large ? 'text-base' : 'text-sm'}`}>
          {store}
        </div>
      </div>
      {isPlaceholder && (
        <span className="absolute -top-2 -right-2 bg-[#FFD700] text-black text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider">
          Soon
        </span>
      )}
    </a>
  );
}

function PhoneMockup() {
  return (
    <div className="relative mx-auto" style={{ width: 240 }}>
      {/* Glow behind phone */}
      <div className="absolute inset-0 rounded-[48px] bg-[#FFD700]/10 blur-3xl scale-110" />

      {/* Phone shell */}
      <div className="relative rounded-[42px] border-2 border-white/10 bg-[#111] overflow-hidden shadow-2xl"
        style={{ width: 240, height: 500 }}>

        {/* Status bar */}
        <div className="flex justify-between items-center px-6 pt-4 pb-2">
          <span className="text-[10px] text-white/40">9:41</span>
          <div className="w-16 h-4 bg-black rounded-full mx-auto" />
          <div className="flex gap-1">
            <div className="w-3 h-2 border border-white/30 rounded-sm" />
          </div>
        </div>

        {/* App UI mockup */}
        <div className="px-3 pb-3 flex flex-col gap-2">
          {/* Header */}
          <div className="flex items-center justify-between px-1 py-2">
            <span className="font-orbitron text-xs font-bold text-[#FFD700]">SIDE HUDDLE</span>
            <div className="h-5 w-5 rounded-full bg-[#FFD700]/20 flex items-center justify-center">
              <span className="text-[8px]">🔔</span>
            </div>
          </div>

          {/* Live card */}
          <div className="rounded-2xl bg-gradient-to-br from-[#FFD700]/20 to-[#00BFFF]/10 border border-[#FFD700]/20 p-3">
            <div className="flex items-center gap-1 mb-2">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[9px] text-red-400 font-semibold uppercase tracking-wider">Live</span>
            </div>
            <div className="flex justify-between items-center">
              <div className="text-center">
                <div className="text-[10px] text-white/60">NYK</div>
                <div className="text-base font-bold text-white">108</div>
              </div>
              <div className="text-[9px] text-white/40">Q3 4:22</div>
              <div className="text-center">
                <div className="text-[10px] text-white/60">BOS</div>
                <div className="text-base font-bold text-white">104</div>
              </div>
            </div>
          </div>

          {/* Chat bubbles */}
          {[
            { side: 'left', msg: '🔥 Jalen dropping 30 tonight' },
            { side: 'right', msg: 'Called it!! 🏀' },
            { side: 'left', msg: 'Defense is elite rn' },
            { side: 'right', msg: 'Let\'s gooo 🎉' },
          ].map(({ side, msg }, i) => (
            <div key={i} className={`flex ${side === 'right' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[70%] rounded-2xl px-2.5 py-1.5 text-[9px] leading-relaxed
                  ${side === 'right'
                    ? 'bg-[#FFD700]/90 text-black font-medium'
                    : 'bg-white/10 text-white'
                  }`}
              >
                {msg}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom nav bar */}
        <div className="absolute bottom-0 left-0 right-0 flex justify-around items-center px-4 py-2 bg-[#0a0a0a]/90 border-t border-white/5">
          {['🏠', '📊', '👤'].map((icon, i) => (
            <div key={i} className={`text-sm p-1 ${i === 0 ? 'opacity-100' : 'opacity-30'}`}>
              {icon}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AppleIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <path d="M3.18 23.5a2 2 0 0 1-.98-.27 2 2 0 0 1-1-1.73V2.5a2 2 0 0 1 1-1.73 2 2 0 0 1 2 0l18 10a2 2 0 0 1 0 3.46l-18 10a2 2 0 0 1-1.02.27z" />
    </svg>
  );
}
