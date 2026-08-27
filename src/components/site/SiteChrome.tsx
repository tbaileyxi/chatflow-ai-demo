// Shared nav + footer for the public marketing pages.
//
// This exists because the footer links drifted: Privacy and Terms were both
// href="#" placeholders that never got filled in, and FAQ pointed at /faq while
// no such route existed, so it silently redirected home. Three broken links in
// one row, on the page that App Review reads. One definition now, imported
// everywhere, so a link can only be wrong in a single place.

import React from 'react';
import { Link } from 'react-router-dom';
import shLogo from '@/assets/sh-logo-updated.png';

// Apple's Standard EULA — the license this app actually ships under, and the
// same URL already cited in the App Store description after the 3.1.2(c)
// rejection. Do not swap this for a self-written terms page without also
// changing the License Agreement setting in App Store Connect.
export const TERMS_URL =
  'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';
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
          <a
            href={TERMS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white/60 transition-colors"
          >
            Terms
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
