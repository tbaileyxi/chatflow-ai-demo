import React from 'react';
import { useParams, Navigate, Link } from 'react-router-dom';
import { SiteNav, SiteFooter } from '@/components/site/SiteChrome';
import {
  StoreButton,
  WhatHappens,
  Screenshots,
  TAGLINE,
  SUBTAGLINE,
} from '@/components/site/AppSections';
import { STORE_CAMPAIGN } from '@/lib/appStore';

/**
 * Per-team page for chapter outreach — the one page a chapter president sees,
 * and its only job is to get the app downloaded.
 *
 * This used to be a SECOND, separately-maintained design, which is exactly how
 * it drifted into generic template copy while the main landing page got the
 * attention. It is now the landing page's body with a data-driven hero on top:
 *
 *   • adding a team is one row in TEAMS, not a design job
 *   • improving the landing page improves all of these for free
 *   • no per-team artwork, ever — the same screenshots run everywhere
 *
 * It carries NO stats and NO schedule on purpose — see the note in the body.
 * What makes it feel like this team's page is the name, the accent colour and a
 * CTA written for that community.
 *
 * An unknown slug redirects to the landing page, so outreach can link
 * /t/<slug> for ANY team without risking a dead link — teams we have not added
 * yet simply land on the generic page.
 *
 * Trademark posture matches the outreach copy: the team name describes who the
 * fans are, never an affiliation. No club marks or logos; colours are generic
 * accents and the disclaimer sits in the footer.
 */

type Team = {
  name: string;
  accent: string;
  ink: string; // readable text colour on `accent` — light accents need #000
  // NOT RENDERED TODAY. `chapters`/`members` are scraper counts, deliberately
  // off the page (see the note in the body); `league`/`espn` powered the live
  // schedule that was removed. Kept because both are the data a future version
  // needs and re-deriving ESPN ids is fiddly — but nothing below reads them, so
  // don't assume a page change picks them up.
  chapters: number;
  members?: number;
  league: 'nfl' | 'college-football';
  espn: string;
};

// Chapter counts are real, from chapter-db/chapters.db. ESPN ids were each
// verified to return a 2026 schedule — `osu` is Oregon State and `ohio` is Ohio
// University, so Ohio State and Texas A&M use numeric ids on purpose.
const TEAMS: Record<string, Team> = {
  'cleveland-browns':    { name: 'Cleveland Browns', chapters: 352, members: 131059, accent: '#FF3C00', ink: '#fff', league: 'nfl', espn: 'cle' },
  'buffalo-bills':       { name: 'Buffalo Bills', chapters: 234, accent: '#00338D', ink: '#fff', league: 'nfl', espn: 'buf' },
  'texas-am':            { name: 'Texas A&M', chapters: 261, accent: '#500000', ink: '#fff', league: 'college-football', espn: '245' },
  'penn-state':          { name: 'Penn State', chapters: 126, accent: '#041E42', ink: '#fff', league: 'college-football', espn: 'psu' },
  'ohio-state':          { name: 'Ohio State', chapters: 104, accent: '#BB0000', ink: '#fff', league: 'college-football', espn: '194' },
  'alabama':             { name: 'Alabama', chapters: 94, accent: '#9E1B32', ink: '#fff', league: 'college-football', espn: 'ala' },
  'pittsburgh-steelers': { name: 'Pittsburgh Steelers', chapters: 80, accent: '#FFB612', ink: '#000', league: 'nfl', espn: 'pit' },
  'green-bay-packers':   { name: 'Green Bay Packers', chapters: 74, accent: '#203731', ink: '#fff', league: 'nfl', espn: 'gb' },
  'clemson':             { name: 'Clemson', chapters: 49, accent: '#F56600', ink: '#000', league: 'college-football', espn: 'clem' },
  'georgia':             { name: 'Georgia', chapters: 43, accent: '#BA0C2F', ink: '#fff', league: 'college-football', espn: 'uga' },
  'dallas-cowboys':      { name: 'Dallas Cowboys', chapters: 41, accent: '#041E42', ink: '#fff', league: 'nfl', espn: 'dal' },
  'seattle-seahawks':    { name: 'Seattle Seahawks', chapters: 37, accent: '#69BE28', ink: '#000', league: 'nfl', espn: 'sea' },
  'texas':               { name: 'Texas Longhorns', chapters: 14, accent: '#BF5700', ink: '#fff', league: 'college-football', espn: 'tex' },
  'las-vegas-raiders':   { name: 'Las Vegas Raiders', chapters: 11, accent: '#A5ACAF', ink: '#000', league: 'nfl', espn: 'lv' },
  'lsu':                 { name: 'LSU', chapters: 7, accent: '#461D7C', ink: '#fff', league: 'college-football', espn: 'lsu' },
  // Scraped 2026-08-21. Accents are ESPN's official team colours. Georgia
  // Tech's old gold is light enough that it needs black ink on the button.
  'georgia-tech':        { name: 'Georgia Tech', chapters: 45, accent: '#B3A369', ink: '#000', league: 'college-football', espn: '59' },
  'tcu':                 { name: 'TCU', chapters: 15, accent: '#4D1979', ink: '#fff', league: 'college-football', espn: '2628' },
  // Two different schools both called "USC" — the slug is what keeps them
  // apart, and chapter-send derives it from the org name, so 'USC Trojans' and
  // 'South Carolina' must stay exactly as spelled in chapter_leads.org.
  'usc-trojans':         { name: 'USC Trojans', chapters: 0, accent: '#9D2235', ink: '#fff', league: 'college-football', espn: '30' },
  'south-carolina':      { name: 'South Carolina Gamecocks', chapters: 50, accent: '#73000A', ink: '#fff', league: 'college-football', espn: '2579' },
};

export default function TeamLanding() {
  const { slug = '' } = useParams();
  const team = TEAMS[slug.toLowerCase()];
  if (!team) return <Navigate to="/" replace />;
  const { name, accent, ink } = team;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white overflow-x-hidden">
      {/* The one piece of team colour that carries the whole page. */}
      <div style={{ height: 5, background: accent }} />
      <SiteNav />

      {/* ── Hero ── */}
      <section className="px-6 pt-8 pb-14 max-w-3xl mx-auto text-center">
        <div
          className="mb-6 inline-flex items-center gap-2 rounded-full border px-4 py-1.5"
          style={{ borderColor: `${accent}66`, background: `${accent}1a` }}
        >
          <span
            className="h-2 w-2 rounded-full animate-pulse"
            style={{ background: accent }}
          />
          <span
            className="text-xs font-medium tracking-widest uppercase"
            style={{ color: accent }}
          >
            For {name} fans
          </span>
        </div>

        {/* The tagline leads on every page — landing, team, and the outreach
            emails — so a chapter president who clicks a link about the Browns
            reads the same sentence they were just sent. */}
        <h1 className="font-orbitron text-4xl sm:text-5xl font-extrabold leading-[1.08] tracking-tight mb-5">
          {TAGLINE},<br />
          <span style={{ color: accent }}>for {name} fans.</span>
        </h1>

        <p className="text-white/70 text-lg leading-snug max-w-md mx-auto mb-8">
          {SUBTAGLINE}
        </p>

        <StoreButton large campaign={STORE_CAMPAIGN.chapterOutreach} />
        <p className="text-white/35 text-xs mt-4">
          Free · iPhone · no ads inside your huddle
        </p>
      </section>

      {/*
        DELIBERATELY NO STATS HERE.
        This used to show "352 chapters we track / 131,059 members". That is a
        number about OUR scraper, dressed up as a number about them — it answers
        a question no visitor asked, and on a small team it renders as a lone
        "7", which argues against the product. Real usage numbers ("225 Browns
        huddles, 25,000 people") belong here the moment they exist. Inventing
        significance before then is the thing that makes a page read as
        generated.

        NO SCHEDULE EITHER. The live ESPN fetch was added when these pages were
        meant to carry dynamic content. As a strip of fixtures under a claim
        that "your huddle wakes up for every one of these", it was a product
        promise wearing a schedule costume.
      */}

      <WhatHappens accent={accent} />
      <Screenshots accent={accent} />

      {/* ── CTA ──
          Was "Run a {team} chapter?", which over-fits one audience. These pages
          go to chapter presidents, but also alumni clubs, fraternities, bar
          groups and plain group chats. "Your {team} community" covers all of
          them without excluding anyone. */}
      <section className="py-16 px-6 text-center border-t border-white/5">
        <h2 className="font-orbitron text-2xl sm:text-3xl font-bold mb-4">
          Start your tailgate room
          <br />
          with your <span style={{ color: accent }}>{name}</span> community.
        </h2>
        <p className="text-white/50 text-sm leading-relaxed max-w-md mx-auto mb-8">
          Download the app, tap <strong className="text-white">create a huddle</strong>, and
          send your people the link. You're the admin, it stays private to your group, it's
          free, and it takes about a minute.
        </p>
        <StoreButton large campaign={STORE_CAMPAIGN.chapterOutreach} />
        <p className="text-white/40 text-sm mt-8">
          Questions?{' '}
          <a href="mailto:ty@sidehuddlesports.com" style={{ color: accent }}>
            ty@sidehuddlesports.com
          </a>
        </p>
      </section>

      {/* ── Sponsorship ──
          One brand per team, so a local business reading a Browns page is
          looking at the Browns slot specifically. /sponsors carries the full
          offer; this is the doorway. */}
      <section className="pb-16 px-6">
        <div
          className="max-w-2xl mx-auto rounded-2xl border px-6 py-7 text-center"
          style={{ borderColor: `${accent}44`, background: `${accent}0f` }}
        >
          <h3 className="font-orbitron text-lg font-bold text-white mb-2">
            Sponsor the {name} rooms
          </h3>
          <p className="text-white/50 text-sm leading-relaxed max-w-md mx-auto mb-5">
            One local brand per team, inside the conversation all season — not a banner
            nobody looks at.
          </p>
          <Link
            to="/sponsors"
            className="inline-block rounded-lg px-5 py-3 text-sm font-bold transition-opacity hover:opacity-90"
            style={{ background: accent, color: ink }}
          >
            See sponsorship →
          </Link>
        </div>
      </section>

      {/* Trademark disclaimer — required on every team page. */}
      <p className="text-[11px] text-white/25 leading-relaxed max-w-3xl mx-auto px-6 pb-10 text-center">
        Side Huddle is an independent app and is not affiliated with, endorsed by, or
        sponsored by any school, team, or league. Team names are used only to describe the
        fans who use the app. Schedule data from ESPN.
      </p>

      <SiteFooter />
    </div>
  );
}
