// The parts of the pitch that are identical everywhere.
//
// The landing page and every /t/<slug> team page share this body. That is the
// whole point: team pages used to be a second, separately-maintained design,
// which is why they drifted into generic template copy while the main page got
// the attention. Now a team page is this body plus a data-driven hero, so
// improving one improves all of them, and adding a team is a row in a map
// rather than a design job.
//
// `accent` lets a team page tint the same components with its own colour. It
// defaults to the Side Huddle gold.

import React from 'react';
import { appStoreUrl } from '@/lib/appStore';

export const GOLD = '#FFD700';

// Settled in HANDOFF-outreach.md. Must match the outreach emails verbatim.
export const TAGLINE = 'The digital tailgate';
export const SUBTAGLINE = 'Enhanced team chat rooms with your crew.';

// Crops of the real 1.0.4 screens, not illustrations — see public/screens.
// Regenerate from the App Store frames whenever the UI moves.
// The four beats. Step 3 is the product — people talking through a game
// together — and it was missing entirely from the first version, which went
// room → people → jump between rooms → content arrives and never once
// mentioned the conversation. "Jump" is a nice detail, not one of the four
// things worth saying.
const STEPS = [
  {
    n: '01',
    title: 'Make a huddle',
    desc: 'A private room for your team. Name it, pick the team, done.',
    img: '/screens/step-huddle.jpg',
    alt: 'A list of your rooms, each showing its member count',
  },
  {
    n: '02',
    title: 'Bring your crew',
    desc: 'Find who you already know here, or send one link to the rest.',
    img: '/screens/step-friends.jpg',
    alt: 'The Friends Now row, showing a friend and an invite button',
  },
  {
    n: '03',
    title: 'Talk through the game',
    desc: 'Every play, every bad call, every argument — with your people, not strangers.',
    img: '/screens/step-talk.jpg',
    alt: 'A message from someone in the room',
  },
  {
    n: '04',
    title: 'The Coach keeps up',
    desc: 'Scores, news and clips land on their own, so nobody has to go look.',
    img: '/screens/step-chat.jpg',
    alt: 'A Coach post in a room quoting a news item',
  },
];

const SHOTS = [
  { src: '/screens/shot-1.jpg', alt: 'A game-day room with live chat and Rally the huddle' },
  { src: '/screens/shot-2.jpg', alt: 'Your rooms and the friends you watch with' },
  { src: '/screens/shot-3.jpg', alt: 'Friends Now and your room list on the home screen' },
  { src: '/screens/shot-4.jpg', alt: 'News, scores and clips landing in a team room' },
  { src: '/screens/shot-5.jpg', alt: 'Asking the Coach a question inside a room' },
];

export function StoreButton({
  large = false,
  label = 'App Store',
  campaign,
}: {
  large?: boolean;
  label?: string;
  /** Which surface this button is on — see STORE_CAMPAIGN. Untagged buttons
   *  still work; they just land in Apple's undifferentiated bucket. */
  campaign?: string;
}) {
  return (
    <a
      href={appStoreUrl(campaign)}
      className={`inline-flex items-center gap-3 rounded-xl bg-white text-black font-semibold
        hover:bg-white/90 transition-colors ${large ? 'px-7 py-4' : 'px-5 py-3'}`}
    >
      <AppleIcon />
      <span className="text-left leading-none">
        <span className="block text-[10px] text-black/60">Download on the</span>
        <span className={`block font-bold mt-0.5 ${large ? 'text-lg' : 'text-sm'}`}>
          {label}
        </span>
      </span>
    </a>
  );
}

export function AppleIcon() {
  return (
    <svg viewBox="0 0 384 512" className="h-7 w-7 fill-current" aria-hidden="true">
      <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
    </svg>
  );
}

export function WhatHappens({ accent = GOLD }: { accent?: string }) {
  return (
    <section className="border-y border-white/5 bg-white/[0.02] py-16 px-6">
      <h2
        className="font-orbitron text-2xl sm:text-3xl font-bold text-center mb-3"
        style={{ color: accent }}
      >
        What actually happens
      </h2>
      <p className="text-white/40 text-sm text-center mb-12">Real screens from the app.</p>

      {/* Four across on desktop so the whole flow is one glance, two across on
          tablet, stacked on phones. The first version was a 2x2 of 190px cells,
          which pushed steps 3 and 4 half a page down — you cannot read a
          four-step flow that does not fit on a screen. */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {STEPS.map(({ n, title, desc, img, alt }) => (
          <div
            key={n}
            /* A real card: lighter than the section behind it, with a visible
               border. Previously black crops sat on black frames on a near-black
               section and nothing had an edge. */
            className="rounded-2xl border border-white/12 bg-white/[0.04] p-3 flex flex-col"
          >
            <div className="h-[124px] rounded-lg overflow-hidden bg-black/60 border border-white/10 flex items-center justify-center p-1.5">
              <img
                src={img}
                alt={alt}
                loading="lazy"
                className="max-h-full max-w-full w-auto object-contain rounded"
              />
            </div>

            <div className="flex items-center gap-2 mt-4">
              <span
                className="font-orbitron text-xs font-extrabold rounded px-1.5 py-0.5"
                /* Full-strength accent on a tinted chip. At 45% opacity these
                   were unreadable, which defeats numbering the steps at all. */
                style={{ color: accent, background: `${accent}22` }}
              >
                {n}
              </span>
              <h3 className="font-semibold text-white text-[15px] leading-tight">{title}</h3>
            </div>
            <p className="text-white/55 text-[13px] leading-relaxed mt-2">{desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function Screenshots({ accent = GOLD }: { accent?: string }) {
  return (
    <section className="py-16 px-6">
      <h2
        className="font-orbitron text-2xl sm:text-3xl font-bold text-center mb-10"
        style={{ color: accent }}
      >
        Inside the app
      </h2>
      <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-4 px-2 sm:justify-center sm:flex-wrap sm:overflow-visible max-w-5xl mx-auto">
        {SHOTS.map(({ src, alt }) => (
          <img
            key={src}
            src={src}
            alt={alt}
            loading="lazy"
            className="snap-center shrink-0 w-[190px] sm:w-[172px] rounded-2xl border border-white/10 shadow-2xl"
          />
        ))}
      </div>
    </section>
  );
}
