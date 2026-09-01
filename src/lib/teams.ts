// The teams outreach can link to, and the only place their names and colours
// are written down.
//
// Lifted out of TeamLanding so the OG-image renderer can read it too. Those two
// must agree: the card that unfurls in someone's group chat is the promise, and
// the page they land on is the delivery. Two copies drift, and the first symptom
// is a card in the wrong colour for the wrong team.

import { GENERATED_TEAMS } from './teams.generated';

export type Team = {
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
  // Display label for the directory. `league` above only knows two values, so
  // without this every hockey and baseball team lists under College.
  leagueLabel?: string;
};

// Chapter counts are real, from chapter-db/chapters.db. ESPN ids were each
// verified to return a 2026 schedule — `osu` is Oregon State and `ohio` is Ohio
// University, so Ohio State and Texas A&M use numeric ids on purpose.
export const TEAMS: Record<string, Team> = {
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


// ── The other ~160 teams ────────────────────────────────────────────────────
//
// Everything above was typed by hand: real brand colours, real chapter counts.
// Everything below comes out of the database via scripts/gen-team-pages.mjs —
// every team whose public room has actually been talking. Those rooms already
// existed; they just had no page pointing at them, which meant no way for
// anyone to find them from a search.
//
// A generated team gets a colour derived from its own name instead of a brand
// colour. That is on purpose and matches the trademark posture of the rest of
// the page: no club marks, no logos, generic accents only. It also means 160
// pages don't all render in the same gold.

const GENERIC_ACCENTS: Array<[string, string]> = [
  ['#1E4B8F', '#fff'], ['#7A1F3D', '#fff'], ['#12684F', '#fff'],
  ['#8A3A12', '#fff'], ['#3B2C6B', '#fff'], ['#0F5563', '#fff'],
  ['#6B1414', '#fff'], ['#2C4A21', '#fff'],
];

// Deterministic, so a team's colour never changes between builds — a page that
// is blue today and green tomorrow looks broken to anyone who saw both.
function accentFor(slug: string): [string, string] {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  return GENERIC_ACCENTS[h % GENERIC_ACCENTS.length];
}

const GENERATED: Record<string, Team> = Object.fromEntries(
  GENERATED_TEAMS.map((g) => {
    const [accent, ink] = accentFor(g.slug);
    return [g.slug, {
      name: g.name,
      accent,
      ink,
      chapters: 0,
      league: (g.league === 'NFL' ? 'nfl' : 'college-football') as Team['league'],
      leagueLabel: g.league === 'NCAA' ? 'College' : g.league,
      espn: '',
    }];
  }),
);

// Hand-written wins. If somebody bothered to look up the real colour, that is
// better than a hash of the slug, and the slug is what outreach already links.
export const ALL_TEAMS: Record<string, Team> = { ...GENERATED, ...TEAMS };

export function teamFor(slug: string): Team | null {
  return ALL_TEAMS[slug] ?? null;
}
