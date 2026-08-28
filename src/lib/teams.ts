// The teams outreach can link to, and the only place their names and colours
// are written down.
//
// Lifted out of TeamLanding so the OG-image renderer can read it too. Those two
// must agree: the card that unfurls in someone's group chat is the promise, and
// the page they land on is the delivery. Two copies drift, and the first symptom
// is a card in the wrong colour for the wrong team.

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


export function teamFor(slug: string): Team | null {
  return TEAMS[slug] ?? null;
}
