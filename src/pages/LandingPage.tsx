import React from 'react';
import { SiteNav, SiteFooter } from '@/components/site/SiteChrome';
import {
  StoreButton,
  WhatHappens,
  Screenshots,
  SUBTAGLINE,
} from '@/components/site/AppSections';
import { STORE_CAMPAIGN } from '@/lib/appStore';

/**
 * App-download landing page.
 *
 * A conversion page, not a brochure: one job, getting the App Store tapped.
 * Most traffic arrives from an outreach email on a phone, so the CTA is above
 * the fold, repeats at the end, and nothing competes with it.
 *
 * The body lives in AppSections so the /t/<slug> team pages render the exact
 * same pitch. Improving it here improves all of them.
 */

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white overflow-x-hidden">
      <SiteNav />

      {/* ── Hero ── */}
      <section className="flex flex-col items-center text-center px-6 pt-10 pb-14 max-w-2xl mx-auto">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#FFD700]/30 bg-[#FFD700]/10 px-4 py-1.5">
          <span className="h-2 w-2 rounded-full bg-[#FFD700] animate-pulse" />
          <span className="text-xs font-medium text-[#FFD700] tracking-widest uppercase">
            Now on the App Store
          </span>
        </div>

        <h1 className="font-orbitron text-5xl sm:text-6xl font-extrabold leading-[1.05] tracking-tight mb-5">
          The <span className="text-[#FFD700]">digital tailgate</span>
        </h1>

        <p className="text-white/70 text-xl leading-snug max-w-md mb-9">{SUBTAGLINE}</p>

        <StoreButton large campaign={STORE_CAMPAIGN.landing} />
        <p className="text-white/35 text-xs mt-4">
          Free · iPhone · no ads inside your huddle
        </p>
      </section>

      <WhatHappens />
      <Screenshots />

      {/* ── Leagues ── */}
      <section className="pb-14 px-6 text-center">
        <p className="text-white/25 text-xs uppercase tracking-widest font-medium mb-5">
          Built for fans of
        </p>
        <div className="flex flex-wrap justify-center gap-2.5 max-w-2xl mx-auto">
          {['NFL', 'College Football', 'NBA', 'MLB', 'NHL'].map((league) => (
            <span
              key={league}
              className="text-xs font-medium text-white/50 border border-white/10 rounded-full px-3 py-1"
            >
              {league}
            </span>
          ))}
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section className="py-16 px-6 text-center border-t border-white/5">
        <h2 className="font-orbitron text-2xl sm:text-3xl font-bold mb-6">
          Get your crew <span className="text-[#FFD700]">in the room.</span>
        </h2>
        <StoreButton large campaign={STORE_CAMPAIGN.landing} />
      </section>

      <SiteFooter />
    </div>
  );
}
