// Contact page.
//
// Deliberately a mailto rather than a form: a form needs a backend, a spam
// gate and somewhere for submissions to land, and all three are things to get
// wrong quietly. App Review also wants a contact route that demonstrably works,
// and an address that opens in their mail client is the version that cannot
// silently fail.

import React from 'react';
import { Link } from 'react-router-dom';
import { SitePage, SUPPORT_EMAIL } from '@/components/site/SiteChrome';

const REASONS: { title: string; desc: string; subject: string }[] = [
  {
    title: 'Something is broken',
    desc: 'A bug, a room that will not load, notifications that are not arriving. Tell us what you were doing and what happened.',
    subject: 'Bug report',
  },
  {
    title: 'Account help',
    desc: 'Cannot sign in, need your account or data deleted, or something looks wrong on your profile.',
    subject: 'Account help',
  },
  {
    title: 'Report someone',
    desc: 'Abuse, harassment or anything else in a room that should not be there. We take this seriously and act on it.',
    subject: 'Report a user',
  },
  {
    title: 'Partnerships and press',
    desc: 'Sponsorships, team or chapter partnerships, or anything media related.',
    subject: 'Partnership enquiry',
  },
];

export default function Contact() {
  return (
    <SitePage
      title="Contact us"
      subtitle="Questions, bugs, account help or anything else — this reaches a real person."
    >
      <a
        href={`mailto:${SUPPORT_EMAIL}`}
        className="block rounded-2xl border border-[#FFD700]/30 bg-[#FFD700]/10 px-6 py-6 text-center hover:bg-[#FFD700]/15 transition-colors mb-10"
      >
        <span className="block text-xs uppercase tracking-widest text-[#FFD700]/70 mb-2">
          Email us
        </span>
        <span className="font-orbitron text-lg sm:text-xl font-bold text-[#FFD700] break-all">
          {SUPPORT_EMAIL}
        </span>
      </a>

      <div className="flex flex-col gap-7">
        {REASONS.map(({ title, desc, subject }) => (
          <div key={title}>
            <h3 className="text-white font-semibold text-base mb-1.5">
              {title}
            </h3>
            <p className="text-white/55 text-sm leading-relaxed">
              {desc}{' '}
              <a
                href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`}
                className="text-[#FFD700] hover:underline whitespace-nowrap"
              >
                Email about this →
              </a>
            </p>
          </div>
        ))}
      </div>

      <div className="border-t border-white/5 mt-12 pt-8 flex flex-col gap-3">
        <p className="text-white/55 text-sm leading-relaxed">
          Plenty of questions are already answered on the{' '}
          <Link to="/faq" className="text-[#FFD700] hover:underline">
            FAQ
          </Link>
          .
        </p>
        <p className="text-white/55 text-sm leading-relaxed">
          You can also find us on{' '}
          <a
            href="https://x.com/sidehuddlesports"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#FFD700] hover:underline"
          >
            𝕏 @sidehuddlesports
          </a>
          .
        </p>
      </div>
    </SitePage>
  );
}
