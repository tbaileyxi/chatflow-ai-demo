// Shared nav + footer for the public marketing pages.
//
// This exists because the footer links drifted: Privacy and Terms were both
// href="#" placeholders that never got filled in, and FAQ pointed at /faq while
// no such route existed, so it silently redirected home. Three broken links in
// one row, on the page that App Review reads. One definition now, imported
// everywhere, so a link can only be wrong in a single place.

import React from 'react';
import { TEAMS } from '@/lib/teams';
import { Link } from 'react-router-dom';
import shLogo from '@/assets/sh-logo-updated.png';

// Apple's Standard EULA — the license this app actually ships under, and the
// same URL already cited in the App Store description after the 3.1.2(c)
// rejection. Do not swap this for a self-written terms page without also
// changing the License Agreement setting in App Store Connect.
export const EULA_URL =
  'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';
/** @deprecated Apple's licence. Our terms of service live at /terms. */
export const TERMS_URL = EULA_URL;
export const SUPPORT_EMAIL = 'support@sidehuddlesports.com';

export function SiteNav() {
  return (
    <nav className="flex items-center justify-between px-6 py-4 max-w-5xl mx-auto">
      <Link to="/" className="flex items-center gap-2">
        <img
          src={shLogo}
          alt="Side Huddle Sports"
          className="h-8 w-8 object-contain rounded-full"
        />
        <span className="font-orbitron font-bold text-base text-[#FFD700] tracking-wide">
          SIDE HUDDLE
        </span>
      </Link>
    </nav>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-white/5 px-6 py-8">
      {/* EVERY TEAM PAGE, LINKED FROM EVERY PAGE.
          Google finds pages by following links, and nothing on this site linked
          to /t/<slug> — so 19 team pages existed and were unreachable by a
          crawler walking the site. A sitemap tells Google they exist; internal
          links are what tell it they matter, and it gives a visitor a way to
          find their own team, which is the point of having them. */}
      <nav aria-label="Team rooms" className="max-w-5xl mx-auto mb-8">
        <h2 className="text-[11px] uppercase tracking-widest text-white/25 mb-3">
          Team rooms
        </h2>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {Object.entries(TEAMS).map(([slug, t]) => (
            <Link
              key={slug}
              to={`/t/${slug}`}
              className="text-xs text-white/35 hover:text-white/70 transition-colors"
            >
              {t.name}
            </Link>
          ))}
          {/* The other ~160 are one click away rather than all in the footer:
              a 180-name footer on every page reads as spam to a crawler and is
              useless to a person. */}
          <Link
            to="/teams"
            className="text-xs text-white/60 hover:text-white transition-colors underline underline-offset-2"
          >
            All teams →
          </Link>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <img
            src={shLogo}
            alt="Side Huddle"
            className="h-5 w-5 object-contain rounded-full opacity-60"
          />
          <span className="text-xs text-white/30 font-orbitron">
            SIDE HUDDLE SPORTS
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-white/30">
          <Link to="/faq" className="hover:text-white/60 transition-colors">
            FAQ
          </Link>
          <Link to="/contact" className="hover:text-white/60 transition-colors">
            Contact
          </Link>
          <Link to="/privacy" className="hover:text-white/60 transition-colors">
            Privacy
          </Link>
          <Link to="/terms" className="hover:text-white/60 transition-colors">
            Terms
          </Link>
          {/* Apple's standard licence, separate from our terms of service
              above. A reviewer following "Terms" must land on the document
              carrying the zero-tolerance clause, not on this one. */}
          <a
            href={EULA_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white/60 transition-colors"
          >
            Licence
          </a>
          <a
            href="https://x.com/sidehuddlesports"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white/60 transition-colors"
          >
            𝕏 @sidehuddlesports
          </a>
        </div>
      </div>
    </footer>
  );
}

/** Dark page shell matching the landing page, with nav and footer attached. */
export function SitePage({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white overflow-x-hidden flex flex-col">
      <SiteNav />
      <main className="flex-1 px-6 py-10 max-w-3xl mx-auto w-full">
        <h1 className="font-orbitron text-3xl sm:text-4xl font-extrabold tracking-tight mb-3">
          {title}
        </h1>
        {subtitle ? (
          <p className="text-white/50 text-base leading-relaxed mb-10">
            {subtitle}
          </p>
        ) : null}
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
