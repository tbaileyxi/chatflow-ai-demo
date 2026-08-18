import React, { useEffect, useMemo, useRef, useState } from 'react';
import shLogo from '@/assets/sh-logo-updated.png';
import { supabase } from '@/integrations/supabase/client';

type ClaimStatus = 'reserved' | 'claimed';

// ─── Brand palette ────────────────────────────────────────────────────────────
const G = {
  bg: '#0a0a0a', surface: '#111111', surface2: '#181818', border: '#222222',
  gold: '#FFD700', goldDim: '#C9A84C', white: '#ffffff',
  muted: '#666666', muted2: '#999999', green: '#3d6b22', red: '#6b2222',
};
const FONT_H = "'Barlow Condensed', 'Orbitron', sans-serif";
const FONT_B = "'Barlow', 'Inter', sans-serif";

type League = 'NFL' | 'NBA' | 'MLB' | 'NHL' | 'NCAA';
type LeagueFilter = 'ALL' | League;

interface StaticTeam { city: string; name: string; league: League; state: string; }
function teamKey(t: StaticTeam) { return `${t.league}|${t.city}|${t.name}`; }

const EXISTING_TAKEN_CLAIMS: Record<string, ClaimStatus> = {
  'NFL|Chicago|Bears': 'claimed',
  'NFL|Buffalo|Bills': 'reserved',
  'NFL|Dallas|Cowboys': 'claimed',
  'NFL|Kansas City|Chiefs': 'reserved',
  'NFL|Philadelphia|Eagles': 'reserved',
  'NFL|San Francisco|49ers': 'claimed',
  'NFL|Detroit|Lions': 'reserved',
  'NFL|Miami|Dolphins': 'reserved',
  'NFL|Arizona|Cardinals': 'reserved',
  'NFL|Baltimore|Ravens': 'claimed',
  'NBA|Chicago|Bulls': 'reserved',
  'NBA|Los Angeles|Lakers': 'claimed',
  'NBA|Boston|Celtics': 'reserved',
  'NBA|Golden State|Warriors': 'claimed',
  'NBA|New York|Knicks': 'reserved',
  'NBA|Dallas|Mavericks': 'reserved',
  'NBA|Brooklyn|Nets': 'reserved',
  'MLB|Chicago|Cubs': 'reserved',
  'MLB|New York|Yankees': 'claimed',
  'MLB|Los Angeles|Dodgers': 'claimed',
  'MLB|Boston|Red Sox': 'reserved',
  'MLB|St. Louis|Cardinals': 'reserved',
  'MLB|Seattle|Mariners': 'reserved',
  'MLB|Atlanta|Braves': 'claimed',
  'NHL|Chicago|Blackhawks': 'reserved',
  'NHL|New York|Rangers': 'claimed',
  'NHL|Toronto|Maple Leafs': 'reserved',
  'NHL|Vegas|Golden Knights': 'reserved',
  'NHL|Boston|Bruins': 'claimed',
};

const LEAGUE_LABELS: Record<string, string> = { NCAA: 'CFB', NFL: 'NFL', NBA: 'NBA', MLB: 'MLB', NHL: 'NHL' };
function displayLeague(l: string) { return LEAGUE_LABELS[l] || l; }

function bundlePrice(count: number): { total: number; label: string } {
  if (count >= 10) return { total: 1800, label: '$180/team' };
  if (count >= 6)  return { total: 1200, label: '$200/team' };
  if (count >= 3)  return { total: 650,  label: '~$217/team' };
  return { total: count * 250, label: '$250/team' };
}

// ─── All teams — no Supabase needed ──────────────────────────────────────────
const ALL_TEAMS: StaticTeam[] = [
  // NFL
  { city: 'Arizona', name: 'Cardinals', league: 'NFL', state: 'AZ' },
  { city: 'Atlanta', name: 'Falcons', league: 'NFL', state: 'GA' },
  { city: 'Baltimore', name: 'Ravens', league: 'NFL', state: 'MD' },
  { city: 'Buffalo', name: 'Bills', league: 'NFL', state: 'NY' },
  { city: 'Carolina', name: 'Panthers', league: 'NFL', state: 'NC' },
  { city: 'Chicago', name: 'Bears', league: 'NFL', state: 'IL' },
  { city: 'Cincinnati', name: 'Bengals', league: 'NFL', state: 'OH' },
  { city: 'Cleveland', name: 'Browns', league: 'NFL', state: 'OH' },
  { city: 'Dallas', name: 'Cowboys', league: 'NFL', state: 'TX' },
  { city: 'Denver', name: 'Broncos', league: 'NFL', state: 'CO' },
  { city: 'Detroit', name: 'Lions', league: 'NFL', state: 'MI' },
  { city: 'Green Bay', name: 'Packers', league: 'NFL', state: 'WI' },
  { city: 'Houston', name: 'Texans', league: 'NFL', state: 'TX' },
  { city: 'Indianapolis', name: 'Colts', league: 'NFL', state: 'IN' },
  { city: 'Jacksonville', name: 'Jaguars', league: 'NFL', state: 'FL' },
  { city: 'Kansas City', name: 'Chiefs', league: 'NFL', state: 'MO' },
  { city: 'Las Vegas', name: 'Raiders', league: 'NFL', state: 'NV' },
  { city: 'Los Angeles', name: 'Chargers', league: 'NFL', state: 'CA' },
  { city: 'Los Angeles', name: 'Rams', league: 'NFL', state: 'CA' },
  { city: 'Miami', name: 'Dolphins', league: 'NFL', state: 'FL' },
  { city: 'Minnesota', name: 'Vikings', league: 'NFL', state: 'MN' },
  { city: 'New England', name: 'Patriots', league: 'NFL', state: 'MA' },
  { city: 'New Orleans', name: 'Saints', league: 'NFL', state: 'LA' },
  { city: 'New York', name: 'Giants', league: 'NFL', state: 'NY' },
  { city: 'New York', name: 'Jets', league: 'NFL', state: 'NY' },
  { city: 'Philadelphia', name: 'Eagles', league: 'NFL', state: 'PA' },
  { city: 'Pittsburgh', name: 'Steelers', league: 'NFL', state: 'PA' },
  { city: 'San Francisco', name: '49ers', league: 'NFL', state: 'CA' },
  { city: 'Seattle', name: 'Seahawks', league: 'NFL', state: 'WA' },
  { city: 'Tampa Bay', name: 'Buccaneers', league: 'NFL', state: 'FL' },
  { city: 'Tennessee', name: 'Titans', league: 'NFL', state: 'TN' },
  { city: 'Washington', name: 'Commanders', league: 'NFL', state: 'DC' },
  // NBA
  { city: 'Atlanta', name: 'Hawks', league: 'NBA', state: 'GA' },
  { city: 'Boston', name: 'Celtics', league: 'NBA', state: 'MA' },
  { city: 'Brooklyn', name: 'Nets', league: 'NBA', state: 'NY' },
  { city: 'Charlotte', name: 'Hornets', league: 'NBA', state: 'NC' },
  { city: 'Chicago', name: 'Bulls', league: 'NBA', state: 'IL' },
  { city: 'Cleveland', name: 'Cavaliers', league: 'NBA', state: 'OH' },
  { city: 'Dallas', name: 'Mavericks', league: 'NBA', state: 'TX' },
  { city: 'Denver', name: 'Nuggets', league: 'NBA', state: 'CO' },
  { city: 'Detroit', name: 'Pistons', league: 'NBA', state: 'MI' },
  { city: 'Golden State', name: 'Warriors', league: 'NBA', state: 'CA' },
  { city: 'Houston', name: 'Rockets', league: 'NBA', state: 'TX' },
  { city: 'Indiana', name: 'Pacers', league: 'NBA', state: 'IN' },
  { city: 'Los Angeles', name: 'Clippers', league: 'NBA', state: 'CA' },
  { city: 'Los Angeles', name: 'Lakers', league: 'NBA', state: 'CA' },
  { city: 'Memphis', name: 'Grizzlies', league: 'NBA', state: 'TN' },
  { city: 'Miami', name: 'Heat', league: 'NBA', state: 'FL' },
  { city: 'Milwaukee', name: 'Bucks', league: 'NBA', state: 'WI' },
  { city: 'Minnesota', name: 'Timberwolves', league: 'NBA', state: 'MN' },
  { city: 'New Orleans', name: 'Pelicans', league: 'NBA', state: 'LA' },
  { city: 'New York', name: 'Knicks', league: 'NBA', state: 'NY' },
  { city: 'Oklahoma City', name: 'Thunder', league: 'NBA', state: 'OK' },
  { city: 'Orlando', name: 'Magic', league: 'NBA', state: 'FL' },
  { city: 'Philadelphia', name: '76ers', league: 'NBA', state: 'PA' },
  { city: 'Phoenix', name: 'Suns', league: 'NBA', state: 'AZ' },
  { city: 'Portland', name: 'Trail Blazers', league: 'NBA', state: 'OR' },
  { city: 'Sacramento', name: 'Kings', league: 'NBA', state: 'CA' },
  { city: 'San Antonio', name: 'Spurs', league: 'NBA', state: 'TX' },
  { city: 'Toronto', name: 'Raptors', league: 'NBA', state: 'ON' },
  { city: 'Utah', name: 'Jazz', league: 'NBA', state: 'UT' },
  { city: 'Washington', name: 'Wizards', league: 'NBA', state: 'DC' },
  // MLB
  { city: 'Arizona', name: 'Diamondbacks', league: 'MLB', state: 'AZ' },
  { city: 'Atlanta', name: 'Braves', league: 'MLB', state: 'GA' },
  { city: 'Baltimore', name: 'Orioles', league: 'MLB', state: 'MD' },
  { city: 'Boston', name: 'Red Sox', league: 'MLB', state: 'MA' },
  { city: 'Chicago', name: 'Cubs', league: 'MLB', state: 'IL' },
  { city: 'Chicago', name: 'White Sox', league: 'MLB', state: 'IL' },
  { city: 'Cincinnati', name: 'Reds', league: 'MLB', state: 'OH' },
  { city: 'Cleveland', name: 'Guardians', league: 'MLB', state: 'OH' },
  { city: 'Colorado', name: 'Rockies', league: 'MLB', state: 'CO' },
  { city: 'Detroit', name: 'Tigers', league: 'MLB', state: 'MI' },
  { city: 'Houston', name: 'Astros', league: 'MLB', state: 'TX' },
  { city: 'Kansas City', name: 'Royals', league: 'MLB', state: 'MO' },
  { city: 'Los Angeles', name: 'Angels', league: 'MLB', state: 'CA' },
  { city: 'Los Angeles', name: 'Dodgers', league: 'MLB', state: 'CA' },
  { city: 'Miami', name: 'Marlins', league: 'MLB', state: 'FL' },
  { city: 'Milwaukee', name: 'Brewers', league: 'MLB', state: 'WI' },
  { city: 'Minnesota', name: 'Twins', league: 'MLB', state: 'MN' },
  { city: 'New York', name: 'Mets', league: 'MLB', state: 'NY' },
  { city: 'New York', name: 'Yankees', league: 'MLB', state: 'NY' },
  { city: 'Oakland', name: 'Athletics', league: 'MLB', state: 'CA' },
  { city: 'Philadelphia', name: 'Phillies', league: 'MLB', state: 'PA' },
  { city: 'Pittsburgh', name: 'Pirates', league: 'MLB', state: 'PA' },
  { city: 'San Diego', name: 'Padres', league: 'MLB', state: 'CA' },
  { city: 'San Francisco', name: 'Giants', league: 'MLB', state: 'CA' },
  { city: 'Seattle', name: 'Mariners', league: 'MLB', state: 'WA' },
  { city: 'St. Louis', name: 'Cardinals', league: 'MLB', state: 'MO' },
  { city: 'Tampa Bay', name: 'Rays', league: 'MLB', state: 'FL' },
  { city: 'Texas', name: 'Rangers', league: 'MLB', state: 'TX' },
  { city: 'Toronto', name: 'Blue Jays', league: 'MLB', state: 'ON' },
  { city: 'Washington', name: 'Nationals', league: 'MLB', state: 'DC' },
  // NHL
  { city: 'Anaheim', name: 'Ducks', league: 'NHL', state: 'CA' },
  { city: 'Boston', name: 'Bruins', league: 'NHL', state: 'MA' },
  { city: 'Buffalo', name: 'Sabres', league: 'NHL', state: 'NY' },
  { city: 'Calgary', name: 'Flames', league: 'NHL', state: 'AB' },
  { city: 'Carolina', name: 'Hurricanes', league: 'NHL', state: 'NC' },
  { city: 'Chicago', name: 'Blackhawks', league: 'NHL', state: 'IL' },
  { city: 'Colorado', name: 'Avalanche', league: 'NHL', state: 'CO' },
  { city: 'Columbus', name: 'Blue Jackets', league: 'NHL', state: 'OH' },
  { city: 'Dallas', name: 'Stars', league: 'NHL', state: 'TX' },
  { city: 'Detroit', name: 'Red Wings', league: 'NHL', state: 'MI' },
  { city: 'Edmonton', name: 'Oilers', league: 'NHL', state: 'AB' },
  { city: 'Florida', name: 'Panthers', league: 'NHL', state: 'FL' },
  { city: 'Los Angeles', name: 'Kings', league: 'NHL', state: 'CA' },
  { city: 'Minnesota', name: 'Wild', league: 'NHL', state: 'MN' },
  { city: 'Montreal', name: 'Canadiens', league: 'NHL', state: 'QC' },
  { city: 'Nashville', name: 'Predators', league: 'NHL', state: 'TN' },
  { city: 'New Jersey', name: 'Devils', league: 'NHL', state: 'NJ' },
  { city: 'New York', name: 'Islanders', league: 'NHL', state: 'NY' },
  { city: 'New York', name: 'Rangers', league: 'NHL', state: 'NY' },
  { city: 'Ottawa', name: 'Senators', league: 'NHL', state: 'ON' },
  { city: 'Philadelphia', name: 'Flyers', league: 'NHL', state: 'PA' },
  { city: 'Pittsburgh', name: 'Penguins', league: 'NHL', state: 'PA' },
  { city: 'San Jose', name: 'Sharks', league: 'NHL', state: 'CA' },
  { city: 'Seattle', name: 'Kraken', league: 'NHL', state: 'WA' },
  { city: 'St. Louis', name: 'Blues', league: 'NHL', state: 'MO' },
  { city: 'Tampa Bay', name: 'Lightning', league: 'NHL', state: 'FL' },
  { city: 'Toronto', name: 'Maple Leafs', league: 'NHL', state: 'ON' },
  { city: 'Utah', name: 'Hockey Club', league: 'NHL', state: 'UT' },
  { city: 'Vancouver', name: 'Canucks', league: 'NHL', state: 'BC' },
  { city: 'Vegas', name: 'Golden Knights', league: 'NHL', state: 'NV' },
  { city: 'Washington', name: 'Capitals', league: 'NHL', state: 'DC' },
  { city: 'Winnipeg', name: 'Jets', league: 'NHL', state: 'MB' },
  // NCAA CFB
  { city: 'Alabama', name: 'Crimson Tide', league: 'NCAA', state: 'AL' },
  { city: 'Arkansas', name: 'Razorbacks', league: 'NCAA', state: 'AR' },
  { city: 'Auburn', name: 'Tigers', league: 'NCAA', state: 'AL' },
  { city: 'Baylor', name: 'Bears', league: 'NCAA', state: 'TX' },
  { city: 'Boston College', name: 'Eagles', league: 'NCAA', state: 'MA' },
  { city: 'BYU', name: 'Cougars', league: 'NCAA', state: 'UT' },
  { city: 'Arizona', name: 'Wildcats', league: 'NCAA', state: 'AZ' },
  { city: 'Arizona State', name: 'Sun Devils', league: 'NCAA', state: 'AZ' },
  { city: 'Boise State', name: 'Broncos', league: 'NCAA', state: 'ID' },
  { city: 'Cincinnati', name: 'Bearcats', league: 'NCAA', state: 'OH' },
  { city: 'Clemson', name: 'Tigers', league: 'NCAA', state: 'SC' },
  { city: 'Colorado', name: 'Buffaloes', league: 'NCAA', state: 'CO' },
  { city: 'Duke', name: 'Blue Devils', league: 'NCAA', state: 'NC' },
  { city: 'Florida', name: 'Gators', league: 'NCAA', state: 'FL' },
  { city: 'Florida State', name: 'Seminoles', league: 'NCAA', state: 'FL' },
  { city: 'Georgia', name: 'Bulldogs', league: 'NCAA', state: 'GA' },
  { city: 'Georgia Tech', name: 'Yellow Jackets', league: 'NCAA', state: 'GA' },
  { city: 'Houston', name: 'Cougars', league: 'NCAA', state: 'TX' },
  { city: 'Illinois', name: 'Fighting Illini', league: 'NCAA', state: 'IL' },
  { city: 'Indiana', name: 'Hoosiers', league: 'NCAA', state: 'IN' },
  { city: 'Iowa', name: 'Hawkeyes', league: 'NCAA', state: 'IA' },
  { city: 'Iowa State', name: 'Cyclones', league: 'NCAA', state: 'IA' },
  { city: 'Kansas', name: 'Jayhawks', league: 'NCAA', state: 'KS' },
  { city: 'Kansas State', name: 'Wildcats', league: 'NCAA', state: 'KS' },
  { city: 'Kentucky', name: 'Wildcats', league: 'NCAA', state: 'KY' },
  { city: 'LSU', name: 'Tigers', league: 'NCAA', state: 'LA' },
  { city: 'Louisville', name: 'Cardinals', league: 'NCAA', state: 'KY' },
  { city: 'Miami', name: 'Hurricanes', league: 'NCAA', state: 'FL' },
  { city: 'Michigan', name: 'Wolverines', league: 'NCAA', state: 'MI' },
  { city: 'Michigan State', name: 'Spartans', league: 'NCAA', state: 'MI' },
  { city: 'Mississippi State', name: 'Bulldogs', league: 'NCAA', state: 'MS' },
  { city: 'Missouri', name: 'Tigers', league: 'NCAA', state: 'MO' },
  { city: 'Memphis', name: 'Tigers', league: 'NCAA', state: 'TN' },
  { city: 'NC State', name: 'Wolfpack', league: 'NCAA', state: 'NC' },
  { city: 'Nebraska', name: 'Cornhuskers', league: 'NCAA', state: 'NE' },
  { city: 'North Carolina', name: 'Tar Heels', league: 'NCAA', state: 'NC' },
  { city: 'Notre Dame', name: 'Fighting Irish', league: 'NCAA', state: 'IN' },
  { city: 'Ohio State', name: 'Buckeyes', league: 'NCAA', state: 'OH' },
  { city: 'Oklahoma', name: 'Sooners', league: 'NCAA', state: 'OK' },
  { city: 'Oklahoma State', name: 'Cowboys', league: 'NCAA', state: 'OK' },
  { city: 'Ole Miss', name: 'Rebels', league: 'NCAA', state: 'MS' },
  { city: 'Oregon', name: 'Ducks', league: 'NCAA', state: 'OR' },
  { city: 'Penn State', name: 'Nittany Lions', league: 'NCAA', state: 'PA' },
  { city: 'Pittsburgh', name: 'Panthers', league: 'NCAA', state: 'PA' },
  { city: 'Purdue', name: 'Boilermakers', league: 'NCAA', state: 'IN' },
  { city: 'South Carolina', name: 'Gamecocks', league: 'NCAA', state: 'SC' },
  { city: 'SMU', name: 'Mustangs', league: 'NCAA', state: 'TX' },
  { city: 'Syracuse', name: 'Orange', league: 'NCAA', state: 'NY' },
  { city: 'TCU', name: 'Horned Frogs', league: 'NCAA', state: 'TX' },
  { city: 'Tennessee', name: 'Volunteers', league: 'NCAA', state: 'TN' },
  { city: 'Texas', name: 'Longhorns', league: 'NCAA', state: 'TX' },
  { city: 'Texas A&M', name: 'Aggies', league: 'NCAA', state: 'TX' },
  { city: 'Texas Tech', name: 'Red Raiders', league: 'NCAA', state: 'TX' },
  { city: 'Tulane', name: 'Green Wave', league: 'NCAA', state: 'LA' },
  { city: 'UCF', name: 'Knights', league: 'NCAA', state: 'FL' },
  { city: 'USC', name: 'Trojans', league: 'NCAA', state: 'CA' },
  { city: 'Utah', name: 'Utes', league: 'NCAA', state: 'UT' },
  { city: 'Vanderbilt', name: 'Commodores', league: 'NCAA', state: 'TN' },
  { city: 'Virginia', name: 'Cavaliers', league: 'NCAA', state: 'VA' },
  { city: 'Virginia Tech', name: 'Hokies', league: 'NCAA', state: 'VA' },
  { city: 'Wake Forest', name: 'Demon Deacons', league: 'NCAA', state: 'NC' },
  { city: 'Washington', name: 'Huskies', league: 'NCAA', state: 'DC' },
  { city: 'West Virginia', name: 'Mountaineers', league: 'NCAA', state: 'WV' },
  { city: 'Wisconsin', name: 'Badgers', league: 'NCAA', state: 'WI' },
];

// ─────────────────────────────────────────────────────────────────────────────
export default function Sponsor() {
  const [search,   setSearch]   = useState('');
  const [league,   setLeague]   = useState<LeagueFilter>('ALL');
  const [claims,   setClaims]   = useState<Record<string, ClaimStatus>>(EXISTING_TAKEN_CLAIMS);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [justPaid, setJustPaid] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  const featured = ALL_TEAMS.find(t => t.city === 'Chicago' && t.league === 'NFL')!;

  // Live claim statuses from real DB rows, if the optional status view exists.
  async function loadClaims() {
    const { data } = await supabase.from('sponsor_claim_status').select('team_key, status');
    if (data) {
      const m: Record<string, ClaimStatus> = { ...EXISTING_TAKEN_CLAIMS };
      data.forEach((r: { team_key: string; status: ClaimStatus }) => { m[r.team_key] = r.status; });
      setClaims(m);
    }
  }

  useEffect(() => {
    loadClaims();
    // Returning from a completed Square checkout: ?paid=1
    const params = new URLSearchParams(window.location.search);
    if (params.get('paid')) {
      setJustPaid(true);
      window.history.replaceState({}, '', '/sponsors');
    }
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ALL_TEAMS.filter(t => {
      if (league !== 'ALL' && t.league !== league) return false;
      // Match on state as well as team, so "SC" or "south carolina" returns
      // Clemson and South Carolina rather than nothing.
      const hay = `${t.city} ${t.name} ${t.state} ${STATE_NAMES[t.state] ?? ''}`.toLowerCase();
      if (q && !hay.includes(q)) return false;
      return true;
    });
  }, [search, league]);

  const claimedCount  = Object.values(claims).filter(s => s === 'claimed').length;
  const reservedCount = Object.values(claims).filter(s => s === 'reserved').length;
  const takenCount    = claimedCount + reservedCount;
  const openCount     = ALL_TEAMS.length - takenCount;

  // Take a whole market at once. A local sponsor thinks "who do people around
  // here care about", not "which league" — so selecting South Carolina should
  // take Clemson and South Carolina together without four separate taps.
  function selectMany(ts: StaticTeam[]) {
    setSelected(prev => {
      const next = new Set(prev);
      for (const t of ts) {
        const st = claims[teamKey(t)];
        if (st === 'claimed' || st === 'reserved') continue; // never select a taken team
        next.add(teamKey(t));
      }
      return next;
    });
  }

  function toggle(t: StaticTeam) {
    const k = teamKey(t);
    setSelected(prev => {
      const next = new Set(prev);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });
  }

  const selectedTeams = ALL_TEAMS.filter(t => selected.has(teamKey(t)));
  const scrollToForm = () => formRef.current?.scrollIntoView({ behavior: 'smooth' });

  return (
    <div style={{ background: G.bg, color: G.white, fontFamily: FONT_B, minHeight: '100vh' }}>
      <style>{css}</style>
      <Nav />
      <Hero onCta={scrollToForm} />
      <Moment featured={featured} />
      <PlatformPreview />
      <WhatYouGet />
      <ROISection />
      <RateCard />
      <div ref={formRef}>
        <TeamPicker
          filtered={filtered} claims={claims} selected={selected} toggle={toggle} selectMany={selectMany}
          search={search} setSearch={setSearch}
          league={league} setLeague={setLeague}
          taken={takenCount} open={openCount}
        />
      </div>
      <Footer onCta={scrollToForm} />

      {/* Sticky cart bar */}
      {selectedTeams.length > 0 && !checkoutOpen && (
        <CartBar teams={selectedTeams} onCheckout={() => setCheckoutOpen(true)} onClear={() => setSelected(new Set())} />
      )}
      {checkoutOpen && (
        <CheckoutModal teams={selectedTeams} onClose={() => setCheckoutOpen(false)} />
      )}
      {justPaid && <PaidSuccess onClose={() => { setJustPaid(false); setSelected(new Set()); }} />}
    </div>
  );
}

// ─── Nav ─────────────────────────────────────────────────────────────────────
function Nav() {
  return (
    <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 32px', borderBottom: `1px solid ${G.border}`, position: 'sticky', top: 0, background: `${G.bg}ee`, backdropFilter: 'blur(12px)', zIndex: 50 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <img src={shLogo} alt="Side Huddle" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
        <span style={{ fontFamily: "'Orbitron', sans-serif", fontWeight: 700, color: G.gold, fontSize: 14, letterSpacing: '0.12em' }}>SIDE HUDDLE</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div className="badge-dot"><span style={{ width: 7, height: 7, borderRadius: '50%', background: '#e74c3c' }} className="pulse-dot" /><span style={{ color: G.gold, fontWeight: 700 }}>PRE-LAUNCH</span></div>
        <div style={{ fontSize: 10, letterSpacing: '0.2em', color: G.muted, fontWeight: 600, textTransform: 'uppercase' }}>LIMITED AVAILABILITY</div>
      </div>
    </nav>
  );
}

// ─── Hero ────────────────────────────────────────────────────────────────────
function Hero({ onCta }: { onCta: () => void }) {
  return (
    <section style={{ minHeight: '92vh', display: 'flex', alignItems: 'center', padding: '0 clamp(24px, 6vw, 96px)' }}>
      <div style={{ maxWidth: 1100, width: '100%', margin: '0 auto' }}>
        <div className="sh-label" style={{ marginBottom: 28 }}>FOUNDING TEAM SPONSORSHIP · LIMITED TIME ACCESS</div>
        <h1 style={{ fontFamily: FONT_H, fontWeight: 700, fontSize: 'clamp(52px, 8.5vw, 108px)', lineHeight: 0.92, margin: 0, textTransform: 'uppercase', letterSpacing: '-0.02em' }}>
          Your brand.<br />
          Inside the huddle.<br />
          <span style={{ color: G.gold }}>When the game is on the line.</span>
        </h1>
        <p style={{ fontSize: 'clamp(15px, 1.6vw, 19px)', lineHeight: 1.6, color: '#aaa', maxWidth: 760, marginTop: 36, fontWeight: 400 }}>
          Founding sponsorships are open. One brand per team, inside the conversation all season. <strong style={{ color: G.white }}>Your founding rate is
          protected for the first year, and your team stays exclusive while your sponsorship is active.</strong> Select your team and check out securely below.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 28 }}>
          {[
            { phase: 'Early Founding', price: 'First-year rate protection', active: true },
            { phase: 'Next Phase',     price: 'Higher as inventory fills', active: false },
            { phase: 'Full Rollout',   price: 'Market pricing',    active: false },
          ].map(p => (
            <div key={p.phase} style={{ padding: '10px 16px', border: `1px solid ${p.active ? G.gold : G.border}`, borderRadius: 4, background: p.active ? 'rgba(255,215,0,.08)' : 'transparent' }}>
              <div className="sh-label" style={{ color: p.active ? G.gold : G.muted }}>{p.phase}</div>
              <div style={{ fontWeight: 700, fontSize: 14, color: p.active ? G.white : G.muted2, marginTop: 4 }}>{p.price}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 36 }}>
          <button className="btn-gold" onClick={onCta}>Claim your team →</button>
          <button className="btn-outline" onClick={() => document.getElementById('placements')?.scrollIntoView({ behavior: 'smooth' })}>How it works</button>
        </div>
      </div>
    </section>
  );
}

// ─── Section 1: The Moment ────────────────────────────────────────────────────
const HUDDLE_BUBBLES = [
  { name: 'The Boys Fantasy',    live: 18, jump: 'Ty + 3 friends joined', initials: ['TY', 'MD', 'JR'] },
  { name: 'Bears War Room',      live: 24, jump: 'Alex hopped in', initials: ['AL', 'KB', 'DS'] },
  { name: 'Section 204 Crew',    live: 31, jump: '5 friends watching', initials: ['TM', 'CJ', 'RB'] },
  { name: 'Sports Degenerates',  live: 16, jump: 'Dan + 2 joined', initials: ['DL', 'NS', 'PG'] },
  { name: 'Da Bears Diehards',   live: 27, jump: 'Sarah hopped in', initials: ['SK', 'BT', 'AM'] },
  { name: 'Halftime Hustle',     live: 14, jump: '4 friends watching', initials: ['RW', 'KM', 'JT'] },
  { name: 'Monsters of Midway',  live: 22, jump: 'Mike + 3 joined', initials: ['MB', 'TC', 'LP'] },
  { name: 'Sunday Ritual',       live: 19, jump: 'Jimmy hopped in', initials: ['JS', 'EV', 'NG'] },
];

function Moment({ featured }: { featured: StaticTeam }) {
  return (
    <section className="sh-section" style={{ borderTop: `1px solid ${G.border}` }}>
      <div className="sh-label">01 — WHAT YOU GET</div>
      {/* The diagram IS the pitch. It used to sit under a headline and a
          ninety-word paragraph, so the one asset that explains the model in a
          glance was the last thing anyone reached.
          The old copy also promised "hundreds of live huddles" and "hundreds of
          simultaneous moments" — a claim a buyer can disprove by opening the
          app. The founding-rate story is true and stronger; this sells that. */}
      <h2 style={{ fontFamily: FONT_H, fontWeight: 700, fontSize: 'clamp(36px, 5vw, 60px)', lineHeight: 1.0, marginTop: 16, maxWidth: 960, textTransform: 'uppercase' }}>
        One sponsor.<br />
        <span style={{ color: G.gold }}>Every huddle for your team.</span>
      </h2>
      <HuddleMultiplier />
      <p style={{ textAlign: 'center', marginTop: 32, fontSize: 13, color: G.muted, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
        Fans don't gather in one room. You're in all of them.
      </p>
    </section>
  );
}

function HuddleMultiplier() {
  return (
    <div className="huddle-multiplier" style={{ position: 'relative', margin: '72px auto 0', height: 540, maxWidth: 900 }}>
      <div className="huddle-brand-center" style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: 138, height: 138, borderRadius: '50%', background: G.surface2, border: `2px solid ${G.gold}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 5, boxShadow: `0 0 48px rgba(255,215,0,.18)`, textAlign: 'center' }}>
        <div className="sh-label" style={{ color: G.muted2, fontSize: 8 }}>POWERED BY</div>
        <div style={{ fontFamily: FONT_H, color: G.gold, fontWeight: 700, fontSize: 21, lineHeight: 1.05, marginTop: 5 }}>YOUR<br />BRAND</div>
      </div>
      {HUDDLE_BUBBLES.map((h, i) => {
        const a = (i / HUDDLE_BUBBLES.length) * Math.PI * 2 - Math.PI / 2;
        const r = 220;
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        return (
          <div key={h.name} className="bubble-in huddle-bubble" style={{ position: 'absolute', left: `calc(50% + ${x}px)`, top: `calc(50% + ${y}px)`, transform: 'translate(-50%,-50%)', width: 176, animationDelay: `${i * 0.09}s` }}>
            <div style={{ background: G.surface, border: `1px solid ${G.border}`, borderRadius: 8, padding: '12px 14px' }}>
              <div style={{ fontWeight: 700, fontSize: 12 }}>{h.name}</div>
              <div style={{ fontSize: 11, color: '#7ec85f', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 6, height: 6, background: '#7ec85f', borderRadius: '50%', flexShrink: 0 }} />
                {h.live} live
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 8 }}>
                <div style={{ display: 'flex' }}>
                  {h.initials.map((initial, avatarIndex) => (
                    <span key={initial} style={{ width: 22, height: 22, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: avatarIndex === 0 ? '#20364d' : avatarIndex === 1 ? '#3a2d50' : '#273e30', border: `2px solid ${G.surface}`, marginLeft: avatarIndex ? -6 : 0, color: '#ddd', fontSize: 7, fontWeight: 800 }}>
                      {initial}
                    </span>
                  ))}
                </div>
                <span className="huddle-jump" style={{ color: G.muted2, fontSize: 8.5, whiteSpace: 'nowrap' }}>{h.jump}</span>
              </div>
              <div className="pulse-gold" style={{ marginTop: 9, borderTop: `1px solid ${G.goldDim}`, paddingTop: 7, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', color: G.gold, fontWeight: 700 }}>
                powered by YOUR BRAND
              </div>
            </div>
          </div>
        );
      })}
      <svg className="huddle-lines" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1 }}>
        {HUDDLE_BUBBLES.map((_, i) => {
          const a = (i / HUDDLE_BUBBLES.length) * Math.PI * 2 - Math.PI / 2;
          return (
            <line key={i} x1="50%" y1="50%"
              x2={`calc(50% + ${Math.cos(a) * 220}px)`}
              y2={`calc(50% + ${Math.sin(a) * 220}px)`}
              stroke={G.gold} strokeOpacity="0.12" strokeWidth="1" strokeDasharray="4 6"
            />
          );
        })}
      </svg>
    </div>
  );
}

// ─── Section 2: Platform Preview ──────────────────────────────────────────────
const PLACEMENT_CARDS = [
  { num: '01', title: 'Team Feed Badge',          sub: 'PRESENTED BY placement',         body: 'Your brand appears at the top of your team\'s live feed as "Presented by [Your Brand]" — visible to every fan who opens the feed, every session, all season long.' },
  { num: '02', title: '1 Message / Week In-Feed', sub: 'SPONSORED DROP in team feed',    body: 'Once per week during the active season, your brand gets a full message card in the team feed — with optional QR code, promo code, or offer. Side Huddle approves before it goes live.' },
  { num: '03', title: 'All-Bot Sponsorship',       sub: 'POWERED BY on every bot card',  body: 'The Side Huddle AI bot is active in every fan huddle around your team — surfacing stats, highlights, and live updates. Every bot card carries your "powered by" attribution. All huddles. All game long.' },
];

function PlatformPreview() {
  const screenshots = [
    {
      label: 'HUDDLE ROOM · PRESENTED BY HEADER + BOT CARD',
      src: '/sponsor-screens/huddle-presented-browns.png',
      alt: 'Side Huddle room showing Presented by Browns Backers sponsor placements',
      featured: true,
      marks: [
        { label: 'Room sponsor header', top: '13.8%', left: '13%', width: '74%', height: '3.3%' },
        { label: 'Bot-card attribution', top: '65.8%', left: '18%', width: '60%', height: '3.6%' },
      ],
    },
    {
      label: 'ROOM DIRECTORY · PRIVATE HUDDLES',
      src: '/sponsor-screens/rooms-list.png',
      alt: 'Side Huddle private rooms list',
    },
    {
      label: 'LIVE HUDDLE · AI-ENHANCED PROMPTS',
      src: '/sponsor-screens/huddle-buff-crew.png',
      alt: 'Side Huddle live room with AI-enhanced team prompts',
    },
    {
      label: 'TEAM FEED · NEWS SURFACE',
      src: '/sponsor-screens/team-feed-news.png',
      alt: 'Side Huddle team feed news cards',
    },
  ];

  return (
    <section id="placements" className="sh-section" style={{ borderTop: `1px solid ${G.border}` }}>
      <div className="sh-label">02 — THE PLATFORM</div>
      <h2 style={{ fontFamily: FONT_H, fontWeight: 700, fontSize: 'clamp(36px, 5vw, 60px)', lineHeight: 1.0, marginTop: 16, textTransform: 'uppercase' }}>
        Three placements. <span style={{ color: G.gold }}>One sponsor.</span> Always on.
      </h2>
      <p style={{ color: '#999', marginTop: 16, maxWidth: 720, fontSize: 16, lineHeight: 1.6 }}>
        Three surfaces, not one banner. On all game.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px,1fr))', gap: 20, marginTop: 48 }}>
        {PLACEMENT_CARDS.map(c => (
          <div key={c.num} style={{ background: G.surface, border: `1px solid ${G.border}`, borderRadius: 8, padding: '24px 24px 28px', position: 'relative' }}>
            <div style={{ fontFamily: FONT_H, fontWeight: 700, fontSize: 48, color: G.gold, lineHeight: 1, marginBottom: 12 }}>{c.num}</div>
            <div className="sh-label" style={{ color: G.muted, marginBottom: 6 }}>{c.sub}</div>
            <h3 style={{ fontFamily: FONT_H, fontWeight: 700, fontSize: 22, textTransform: 'uppercase', marginBottom: 12 }}>{c.title}</h3>
            <p style={{ color: '#bbb', fontSize: 14, lineHeight: 1.65 }}>{c.body}</p>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 54, display: 'flex', alignItems: 'end', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
        <div>
          <div className="sh-label" style={{ color: G.gold }}>ACTUAL APP SCREENS</div>
          <h3 style={{ fontFamily: FONT_H, fontWeight: 700, fontSize: 'clamp(26px,3vw,38px)', textTransform: 'uppercase', marginTop: 8 }}>
            The sponsorship is visible inside the huddle.
          </h3>
        </div>
        <p style={{ color: '#999', fontSize: 14, lineHeight: 1.55, maxWidth: 390, margin: 0 }}>
          Gold marks what fans actually see.
        </p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1.1fr) repeat(3, minmax(190px, .75fr))', gap: 22, marginTop: 26, alignItems: 'start' }} className="sponsor-shot-grid">
        {screenshots.map((shot) => (
          <ScreenshotPhone
            key={shot.src}
            label={shot.label}
            src={shot.src}
            alt={shot.alt}
            featured={shot.featured}
            marks={shot.marks}
          />
        ))}
      </div>
    </section>
  );
}

function ScreenshotPhone({
  label,
  src,
  alt,
  featured,
  marks = [],
}: {
  label: string;
  src: string;
  alt: string;
  featured?: boolean;
  marks?: Array<{ label: string; top: string; left: string; width: string; height: string }>;
}) {
  return (
    <div style={{ minWidth: 0 }}>
      <div className="sh-label" style={{ color: featured ? G.gold : G.muted, marginBottom: 12 }}>{label}</div>
      <div style={{ background: '#000', border: `1.5px solid ${featured ? G.gold : G.border}`, borderRadius: featured ? 34 : 28, padding: featured ? 10 : 8, maxWidth: featured ? 360 : 260, margin: '0 auto', boxShadow: featured ? '0 28px 80px rgba(255,215,0,.16)' : '0 24px 64px rgba(0,0,0,.6)', aspectRatio: '750/1624' }}>
        <div style={{ position: 'relative', background: G.bg, height: '100%', borderRadius: featured ? 24 : 21, overflow: 'hidden' }}>
          <img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', display: 'block' }} alt={alt} />
          {marks.map((mark) => (
            <div key={mark.label} style={{ position: 'absolute', top: mark.top, left: mark.left, width: mark.width, height: mark.height, border: `2px solid ${G.gold}`, borderRadius: 8, boxShadow: '0 0 0 999px rgba(0,0,0,.18), 0 0 24px rgba(255,215,0,.48)', pointerEvents: 'none' }}>
              <span style={{ position: 'absolute', left: 8, top: '-1.55em', background: G.gold, color: '#000', borderRadius: 999, padding: '3px 8px', fontSize: 9, fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                {mark.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Section 3: What You Get ──────────────────────────────────────────────────
function WhatYouGet() {
  const cards = [
    { icon: '⚡', title: 'Bot Attribution',    body: 'Every team-bot message carries a "powered by" line. One active sponsor per team — no competing brand shares your placement.' },
    { icon: '🛡️', title: 'Team Feed Badge',    body: '"Presented by" lockup at the top of your team\'s live feed. Visible to every fan in every session, all season.' },
    { icon: '📣', title: '1 Branded Drop / Week', body: 'One sponsor-controlled message per week during active season. Optional QR code for offers or traffic. Side Huddle approved before posting.', note: 'Drive fans to your location, offer, or event on game day.' },
  ];
  return (
    <section className="sh-section" style={{ borderTop: `1px solid ${G.border}` }}>
      <div className="sh-label">03 — WHAT YOU GET</div>
      <h2 style={{ fontFamily: FONT_H, fontWeight: 700, fontSize: 'clamp(36px, 5vw, 60px)', lineHeight: 1.0, marginTop: 16, textTransform: 'uppercase' }}>Three placements. Built into the moment.</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: 24, marginTop: 52 }}>
        {cards.map(c => (
          <div key={c.title} style={{ background: G.surface, border: `1px solid ${G.border}`, borderRadius: 8, padding: 28 }}>
            <div style={{ fontSize: 34 }}>{c.icon}</div>
            <h3 style={{ fontFamily: FONT_H, fontWeight: 700, fontSize: 22, marginTop: 16, textTransform: 'uppercase' }}>{c.title}</h3>
            <p style={{ color: '#bbb', fontSize: 14, lineHeight: 1.65, marginTop: 10 }}>{c.body}</p>
            {c.note && <p style={{ color: G.gold, fontSize: 12, marginTop: 14, fontStyle: 'italic' }}>{c.note}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Section 4: ROI ───────────────────────────────────────────────────────────
function ROISection() {
  return (
    <section className="sh-section" style={{ borderTop: `1px solid ${G.border}` }}>
      <div style={{ border: `1px solid ${G.gold}`, borderRadius: 8, padding: 'clamp(28px, 5vw, 56px)', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,2fr)', gap: 40, alignItems: 'center', background: `rgba(255,215,0,.03)` }}>
        <div>
          <div className="sh-label" style={{ marginBottom: 12 }}>FOUNDING RATE</div>
          <div style={{ fontFamily: FONT_H, fontWeight: 700, fontSize: 'clamp(44px, 6vw, 76px)', color: G.gold, lineHeight: 0.95 }}>First year protected</div>
          <div className="sh-label" style={{ color: G.muted, marginTop: 8 }}>exclusive team sponsorship</div>
        </div>
        <div>
          <div className="sh-label" style={{ marginBottom: 16 }}>COMPARABLE VALUE</div>
          <p style={{ fontSize: 18, lineHeight: 1.65, color: '#ddd' }}>
            A single local radio spot runs <strong>$500–1,500/week</strong>. One local TV placement: <strong>$2,000–5,000</strong>. A Side Huddle founding sponsorship comes in <strong>below the average local-sponsorship spend</strong> — exclusive, always-on, inside the conversation when fans are most engaged.
          </p>
          <p style={{ fontSize: 18, lineHeight: 1.65, color: '#ddd', marginTop: 16 }}>
            Own an entire fanbase on Side Huddle. <strong style={{ color: G.gold }}>$250/month for one team, with lower per-team founding rates for bundles.</strong>
          </p>
        </div>
      </div>
    </section>
  );
}

// ─── Section 5: Rate Card ─────────────────────────────────────────────────────
function RateCard() {
  const urgency = [
    { when: 'Single team', detail: '$250/month', sub: 'Exclusive placement for one team', active: true },
    { when: '3-team bundle', detail: '$650/month', sub: '~$217/team', active: false },
    { when: '6-team bundle', detail: '$1,200/month', sub: '$200/team', active: false },
    { when: '10+ teams', detail: '$1,800/month', sub: '$180/team', active: false },
  ];
  const infoCards = [
    { title: 'BILLING',     body: 'Month-to-month. No annual contract. Your first monthly charge is paid at checkout and recurring billing continues monthly.' },
    { title: 'RATE LOCK',   body: 'Your founding monthly rate is protected for the first year.' },
    { title: 'EXCLUSIVITY', body: 'One active sponsor per team. No competing brand shares your team placement while your sponsorship is active.' },
    { title: 'FOUNDING BONUS', body: 'Founding sponsors receive two bonus months of placement plus sponsor drops inside the chat experience.' },
    { title: 'BUNDLES',     body: '3 teams: $650/month. 6 teams: $1,200/month. 10 or more: $1,800/month.' },
  ];
  return (
    <section className="sh-section" id="rate-card" style={{ borderTop: `1px solid ${G.border}` }}>
      <div className="sh-label">04 — FOUNDING SPONSOR PRICING</div>

      <div style={{ marginTop: 24, border: `1px solid ${G.gold}`, borderRadius: 8, padding: 'clamp(20px,3vw,32px)', background: 'rgba(255,215,0,.04)' }}>
        <div style={{ fontFamily: FONT_H, fontWeight: 700, fontSize: 'clamp(20px,2.8vw,30px)', color: G.gold, textTransform: 'uppercase' }}>
          🏈 Claim your exclusive team sponsorship.
        </div>
        <p style={{ color: '#ddd', marginTop: 10, fontSize: 16 }}>One active sponsor per team. Bundle for a lower rate.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))', gap: 10, marginTop: 20 }}>
          {urgency.map(u => (
            <div key={u.when} style={{ padding: 14, border: `1px solid ${u.active ? G.gold : G.border}`, borderRadius: 6, background: u.active ? 'rgba(255,215,0,.08)' : G.bg }}>
              <div className="sh-label" style={{ color: u.active ? G.gold : G.muted }}>{u.when}</div>
              <div style={{ marginTop: 5, fontWeight: 700, color: u.active ? G.white : '#888', fontSize: 13 }}>{u.detail}</div>
              <div style={{ marginTop: 3, fontSize: 11, color: u.active ? G.muted2 : G.muted }}>{u.sub}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 32 }}>
        <div style={{ border: `1px solid ${G.border}`, borderRadius: 8, padding: 24, background: G.surface }}>
          <div className="sh-label" style={{ color: G.muted }}>SINGLE TEAM</div>
          <div style={{ fontFamily: FONT_H, fontWeight: 700, fontSize: 'clamp(28px,4vw,44px)', color: G.white, lineHeight: 1.05, marginTop: 8 }}>Own one team</div>
          <div style={{ marginTop: 14, fontSize: 13, color: '#ccc', lineHeight: 1.5 }}>Exclusive placement across every huddle for your team — zero competitors in that community.</div>
        </div>
        <div style={{ border: `2px solid ${G.gold}`, borderRadius: 8, padding: 24, background: 'rgba(255,215,0,.04)', position: 'relative' }}>
          <div style={{ position: 'absolute', top: -12, left: 20, background: G.gold, color: '#000', fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 999, letterSpacing: '0.1em' }}>BEST VALUE</div>
          <div className="sh-label" style={{ color: G.gold }}>BUNDLE · MULTIPLE TEAMS</div>
          <div style={{ fontFamily: FONT_H, fontWeight: 700, fontSize: 'clamp(28px,4vw,44px)', color: G.gold, lineHeight: 1.05, marginTop: 8 }}>Own your market</div>
          <div style={{ marginTop: 14, fontSize: 13, color: '#ccc', lineHeight: 1.5 }}>Bundle a conference or a whole market — best per-team founding rate. Ask us for a bundle quote.</div>
        </div>
      </div>

      <div style={{ marginTop: 24, border: `1px solid ${G.gold}`, borderRadius: 8, padding: 'clamp(20px,3vw,32px)', background: 'rgba(255,215,0,.04)', textAlign: 'center' }}>
        <div style={{ fontFamily: FONT_H, fontWeight: 700, fontSize: 'clamp(20px,2.6vw,30px)', textTransform: 'uppercase' }}>
          One team: <span style={{ color: G.gold }}>$250/month</span>
        </div>
        <p style={{ color: '#ddd', marginTop: 12, fontSize: 16, lineHeight: 1.6, maxWidth: 620, margin: '12px auto 0' }}>
          Pay the first monthly charge today to claim your team.
          Founding sponsors receive <strong style={{ color: G.white }}>two bonus months of placement</strong> plus sponsor drops inside the chat experience.
          Bundle pricing is applied automatically when you select multiple teams.
        </p>
        <p style={{ color: G.muted, marginTop: 14, fontSize: 13 }}>Take several at once. Conference and market packages on request.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px,1fr))', gap: 14, marginTop: 28 }}>
        {infoCards.map(c => (
          <div key={c.title} style={{ background: G.surface, border: `1px solid ${G.border}`, borderRadius: 6, padding: 20 }}>
            <div className="sh-label">{c.title}</div>
            <p style={{ marginTop: 8, color: '#ccc', fontSize: 13, lineHeight: 1.6 }}>{c.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Section 6: Team Picker ───────────────────────────────────────────────────
// Full state names, so a sponsor can type how they think — "south carolina",
// "SC", "Charleston" and "Clemson" all have to land on the same shortlist.
const STATE_NAMES: Record<string, string> = {
  AL:'Alabama', AR:'Arkansas', AZ:'Arizona', CA:'California', CO:'Colorado', DC:'Washington DC',
  FL:'Florida', GA:'Georgia', IA:'Iowa', ID:'Idaho', IL:'Illinois', IN:'Indiana', KS:'Kansas',
  KY:'Kentucky', LA:'Louisiana', MA:'Massachusetts', MD:'Maryland', MI:'Michigan', MN:'Minnesota',
  MO:'Missouri', MS:'Mississippi', NC:'North Carolina', NE:'Nebraska', NJ:'New Jersey', NV:'Nevada',
  NY:'New York', OH:'Ohio', OK:'Oklahoma', OR:'Oregon', PA:'Pennsylvania', SC:'South Carolina',
  TN:'Tennessee', TX:'Texas', UT:'Utah', VA:'Virginia', WA:'Washington', WI:'Wisconsin',
  WV:'West Virginia', AB:'Alberta', BC:'British Columbia', MB:'Manitoba', ON:'Ontario', QC:'Quebec',
};

// The markets worth surfacing as one-tap chips: states carrying several teams,
// which is where a local sponsor's money actually goes.
const TOP_MARKETS = ['SC','NC','GA','FL','TX','TN','LA','OH','PA','CA','NY'];

const LEAGUES: LeagueFilter[] = ['ALL', 'NCAA', 'NFL', 'NBA', 'MLB', 'NHL'];
const LEAGUE_DISPLAY: Record<LeagueFilter, string> = { ALL: 'ALL', NCAA: 'CFB', NFL: 'NFL', NBA: 'NBA', MLB: 'MLB', NHL: 'NHL' };

function TeamPicker({ filtered, claims, selected, toggle, selectMany, search, setSearch, league, setLeague, taken, open }: {
  filtered: StaticTeam[]; claims: Record<string, ClaimStatus>;
  selected: Set<string>; toggle: (t: StaticTeam) => void;
  selectMany: (ts: StaticTeam[]) => void;
  search: string; setSearch: (s: string) => void;
  league: LeagueFilter; setLeague: (l: LeagueFilter) => void;
  taken: number; open: number;
}) {
  return (
    <section className="sh-section" style={{ borderTop: `1px solid ${G.border}`, paddingBottom: 160 }}>
      <div className="sh-label">05 — CLAIM YOUR TEAM</div>
      <h2 style={{ fontFamily: FONT_H, fontWeight: 700, fontSize: 'clamp(44px,6vw,80px)', lineHeight: 0.95, marginTop: 16, textTransform: 'uppercase' }}>
        First in <span style={{ color: G.gold }}>owns the team.</span>
      </h2>
      <p style={{ color: '#aaa', marginTop: 16, maxWidth: 720, fontSize: 17, lineHeight: 1.6 }}>
        Pick your market or your team. One active sponsor each — take several and the founding rate drops.
      </p>

      {/* Honest scarcity — live counts from real DB rows. */}
      <div style={{ marginTop: 20, padding: '14px 20px', background: 'rgba(255,215,0,.06)', border: `1px solid ${G.gold}`, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ fontFamily: FONT_H, fontWeight: 700, fontSize: 22, color: G.gold }}>
          {taken} claimed · {open} founding slots open
        </div>
        <span style={{ fontSize: 13, color: G.muted2, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          Founding window closes August 29, 2026
        </span>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 28, alignItems: 'center' }}>
        {LEAGUES.map(l => (
          <button key={l} onClick={() => setLeague(l)} className="sh-label"
            style={{ padding: '9px 18px', borderRadius: 4, border: `1px solid ${league === l ? G.gold : G.border}`, background: league === l ? 'rgba(255,215,0,.1)' : G.surface, color: league === l ? G.gold : G.muted, cursor: 'pointer' }}>
            {LEAGUE_DISPLAY[l]}
          </button>
        ))}
        <input className="sh-input" placeholder="Search teams…" value={search} onChange={e => setSearch(e.target.value)}
          style={{ marginLeft: 8, maxWidth: 280, height: 40 }} />
      </div>

      {/* Markets. A sponsor buys where their customers are, so the fastest path
          is their own state — not a 188-team wall sorted by league. */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16, alignItems: 'center' }}>
        <span className="sh-label" style={{ fontSize: 11, color: G.muted2 }}>MARKETS</span>
        {TOP_MARKETS.map(st => (
          <button key={st} onClick={() => setSearch(STATE_NAMES[st] ?? st)} className="sh-label"
            style={{ padding: '7px 14px', borderRadius: 4, border: `1px solid ${G.border}`, background: G.surface, color: G.muted, cursor: 'pointer', fontSize: 11 }}>
            {STATE_NAMES[st] ?? st}
          </button>
        ))}
        {search && (
          <button onClick={() => setSearch('')} className="sh-label"
            style={{ padding: '7px 14px', borderRadius: 4, border: `1px solid ${G.border}`, background: 'transparent', color: G.muted2, cursor: 'pointer', fontSize: 11 }}>
            CLEAR
          </button>
        )}
      </div>

      {/* One tap for the whole shortlist, once it is small enough to mean something. */}
      {filtered.length > 1 && filtered.length <= 12 && (
        <button onClick={() => selectMany(filtered)}
          style={{ marginTop: 18, padding: '10px 18px', borderRadius: 4, border: `1px solid ${G.gold}`, background: 'rgba(255,215,0,.08)', color: G.gold, cursor: 'pointer', fontFamily: FONT_H, fontWeight: 700, fontSize: 13, textTransform: 'uppercase' }}>
          Select all {filtered.length} shown
        </button>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px,1fr))', gap: 10, marginTop: 28 }}>
        {filtered.length === 0 && <div style={{ gridColumn: '1/-1', color: G.muted, padding: 48, textAlign: 'center' }}>No teams match your search.</div>}
        {filtered.map(t => {
          const status = claims[teamKey(t)]; // undefined => open
          const locked = status === 'reserved' || status === 'claimed';
          const on = selected.has(teamKey(t));
          const badge = status === 'claimed' ? 'CLAIMED' : status === 'reserved' ? 'RESERVED' : on ? 'SELECTED' : 'OPEN';
          const badgeColor = locked ? G.muted2 : on ? G.gold : '#7ec85f';
          return (
            <button key={teamKey(t)} disabled={locked} onClick={() => !locked && toggle(t)}
              aria-label={locked ? `${t.city} ${t.name} — ${badge}` : `Select ${t.city} ${t.name}`}
              style={{ background: locked ? '#0c0c0c' : on ? 'rgba(255,215,0,.08)' : G.surface, border: `1px solid ${on ? G.gold : G.border}`, borderRadius: 8, padding: '14px 16px', cursor: locked ? 'not-allowed' : 'pointer', textAlign: 'left', transition: 'border-color .15s, background .15s', position: 'relative', opacity: locked ? 0.55 : 1 }}
              onMouseEnter={e => { if (!locked && !on) e.currentTarget.style.borderColor = G.gold; }}
              onMouseLeave={e => { if (!locked && !on) e.currentTarget.style.borderColor = G.border; }}>
              {locked && (
                <>
                  <span aria-hidden="true" style={{ position: 'absolute', inset: 10, pointerEvents: 'none' }}>
                    <span style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 2, background: '#d54f4f', transform: 'rotate(16deg)', opacity: 0.9 }} />
                    <span style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 2, background: '#d54f4f', transform: 'rotate(-16deg)', opacity: 0.9 }} />
                  </span>
                  <span style={{ position: 'absolute', top: 8, right: 10, color: '#d54f4f', fontWeight: 900, fontSize: 14 }}>X</span>
                </>
              )}
              {on && !locked && <span style={{ position: 'absolute', top: 8, right: 10, color: G.gold, fontWeight: 800, fontSize: 14 }}>✓</span>}
              <div style={{ fontWeight: 700, fontSize: 14, color: locked ? G.muted2 : on ? G.gold : G.white, lineHeight: 1.2 }}>{t.city} {t.name}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 8 }}>
                <span className="sh-label" style={{ fontSize: 9, color: G.muted }}>{displayLeague(t.league)}{t.state ? ` · ${t.state}` : ''}</span>
                <span style={{ fontFamily: FONT_H, fontWeight: 700, fontSize: 13, color: badgeColor }}>{badge}</span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function Footer({ onCta }: { onCta: () => void }) {
  return (
    <footer style={{ borderTop: `1px solid ${G.gold}44`, marginTop: 40 }}>
      <div className="sh-section" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px,1fr))', gap: 32, alignItems: 'center', paddingTop: 52, paddingBottom: 52 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src={shLogo} alt="Side Huddle" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
            <span style={{ fontFamily: "'Orbitron', sans-serif", fontWeight: 700, color: G.gold, fontSize: 13, letterSpacing: '0.1em' }}>SIDE HUDDLE SPORTS</span>
          </div>
          <div style={{ color: G.muted, fontSize: 13, marginTop: 8, marginLeft: 46 }}>Pre-launch founding sponsor program</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: FONT_H, fontWeight: 700, fontSize: 20, textTransform: 'uppercase', lineHeight: 1.2 }}>
            Founding slots are limited.<br /><span style={{ color: G.gold }}>First in owns the team.</span>
          </div>
          <button className="btn-gold" style={{ marginTop: 20 }} onClick={onCta}>Claim your team →</button>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="sh-label" style={{ color: G.muted }}>PARTNERSHIPS & BUNDLE INQUIRIES</div>
          <a href="mailto:qb1@sidehuddlesports.com" style={{ display: 'block', marginTop: 8, color: G.gold, fontWeight: 700, fontSize: 16, textDecoration: 'none' }}>
            qb1@sidehuddlesports.com
          </a>
        </div>
      </div>
      <div style={{ borderTop: `1px solid ${G.border}`, padding: '16px 32px', textAlign: 'center', fontSize: 12, color: G.muted }}>
        © {new Date().getFullYear()} Side Huddle Sports · sidehuddlesports.com/sponsors
      </div>
    </footer>
  );
}

// ─── Cart bar + Square checkout ──────────────────────────────────────────────
function CartBar({ teams, onCheckout, onClear }: { teams: StaticTeam[]; onCheckout: () => void; onClear: () => void }) {
  const price = bundlePrice(teams.length);
  return (
    <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 90, background: '#0c0c0cf2', backdropFilter: 'blur(10px)', borderTop: `1px solid ${G.gold}`, padding: '14px clamp(16px,5vw,48px)' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <span style={{ fontFamily: FONT_H, fontWeight: 700, fontSize: 22, color: G.gold }}>{teams.length} team{teams.length !== 1 ? 's' : ''} selected</span>
          <span style={{ color: G.muted2, fontSize: 14, marginLeft: 12 }}>${price.total}/month · {price.label}</span>
          <button onClick={onClear} style={{ marginLeft: 14, background: 'none', border: 'none', color: G.muted, fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>clear</button>
        </div>
        <button className="btn-gold" onClick={onCheckout} style={{ fontSize: 14, padding: '13px 26px' }}>Review &amp; checkout →</button>
      </div>
    </div>
  );
}

function CheckoutModal({ teams, onClose }: { teams: StaticTeam[]; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const price = bundlePrice(teams.length);

  async function go() {
    setLoading(true); setError('');
    try {
      const { data, error } = await supabase.functions.invoke('create-sponsor-square-checkout', {
        body: {
          teams: teams.map(t => ({ teamKey: teamKey(t), teamName: `${t.city} ${t.name}`, league: t.league })),
        },
      });
      if (error) throw new Error(error.message);
      if (data?.url) { window.location.href = data.url; return; }
      throw new Error(data?.error || 'Could not start checkout.');
    } catch (e) {
      setError((e as Error)?.message || 'Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.78)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: G.surface, border: `1px solid ${G.gold}`, borderRadius: 12, padding: 'clamp(22px,4vw,34px)', maxWidth: 500, width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 30px 80px rgba(0,0,0,.7)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div className="sh-label" style={{ color: G.gold }}>FOUNDING SPONSOR CHECKOUT</div>
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', color: G.muted, fontSize: 26, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ marginTop: 16, maxHeight: 180, overflowY: 'auto', border: `1px solid ${G.border}`, borderRadius: 8 }}>
          {teams.map(t => (
            <div key={teamKey(t)} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderBottom: `1px solid ${G.border}` }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>{t.city} {t.name}</span>
              <span style={{ color: G.muted2, fontSize: 13 }}>{displayLeague(t.league)}</span>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 16, padding: '15px 16px', background: 'rgba(255,215,0,.07)', border: `1px solid ${G.gold}`, borderRadius: 8 }}>
          <div style={{ fontFamily: FONT_H, fontWeight: 700, fontSize: 19, color: G.gold }}>MONTH-TO-MONTH FOUNDING SPONSORSHIP</div>
          <div style={{ fontSize: 13, color: '#ccc', marginTop: 5, lineHeight: 1.55 }}>
            First monthly charge today. First recurring charge begins September 1. No annual contract.
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 18, paddingTop: 14, borderTop: `1px solid ${G.gold}44` }}>
          <span className="sh-label">TOTAL TODAY</span>
          <span style={{ fontFamily: FONT_H, fontWeight: 700, fontSize: 30, color: G.gold }}>${price.total.toLocaleString()}</span>
        </div>

        {error && <p style={{ color: '#ff6b6b', fontSize: 13, marginTop: 12 }}>{error}</p>}

        <button className="btn-gold" onClick={go} disabled={loading} style={{ marginTop: 16, width: '100%', fontSize: 15, padding: '15px 28px' }}>
          {loading ? 'Starting Square checkout…' : `Checkout ${teams.length} team${teams.length !== 1 ? 's' : ''} — $${price.total.toLocaleString()} →`}
        </button>
        <p style={{ fontSize: 11, color: G.muted, textAlign: 'center', marginTop: 10, lineHeight: 1.5 }}>
          Secure checkout powered by Square. This payment claims the selected team sponsorship(s).
        </p>
      </div>
    </div>
  );
}

function PaidSuccess({ onClose }: { onClose: () => void }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.82)', backdropFilter: 'blur(4px)', zIndex: 101, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: G.surface, border: `1px solid ${G.gold}`, borderRadius: 12, padding: 'clamp(28px,5vw,44px)', maxWidth: 460, width: '100%', textAlign: 'center', boxShadow: '0 30px 80px rgba(0,0,0,.7)' }}>
        <div style={{ fontSize: 52 }}>🏆</div>
        <div style={{ fontFamily: FONT_H, fontWeight: 700, fontSize: 34, color: G.gold, textTransform: 'uppercase', marginTop: 8 }}>You're in.</div>
        <p style={{ color: '#ddd', marginTop: 14, fontSize: 16, lineHeight: 1.6 }}>
          Payment received — your team sponsorship(s) are claimed. We will send setup details and confirm recurring billing.
        </p>
        <button className="btn-gold" onClick={onClose} style={{ marginTop: 24 }}>Back to the board</button>
      </div>
    </div>
  );
}

// ─── CSS ─────────────────────────────────────────────────────────────────────
const css = `
.sh-section { padding: 96px clamp(24px,6vw,96px); max-width: 1280px; margin: 0 auto; }
.sh-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.2em; font-weight: 700; color: ${G.gold}; font-family: ${FONT_B}; }
.btn-gold { background: ${G.gold}; color: #0a0a0a; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; padding: 14px 28px; border-radius: 4px; cursor: pointer; border: 1.5px solid ${G.gold}; transition: background .15s, border-color .15s; font-family: ${FONT_B}; font-size: 13px; }
.btn-gold:hover { background: #ffe74a; border-color: #ffe74a; }
.btn-gold:disabled { opacity: .5; cursor: not-allowed; }
.btn-outline { background: transparent; color: ${G.white}; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; padding: 14px 28px; border-radius: 4px; cursor: pointer; border: 1.5px solid ${G.border}; transition: border-color .15s, color .15s; font-family: ${FONT_B}; font-size: 13px; }
.btn-outline:hover { border-color: ${G.gold}; color: ${G.gold}; }
.sh-input { background: #080808; border: 1px solid ${G.border}; color: ${G.white}; padding: 11px 14px; border-radius: 4px; width: 100%; font-family: ${FONT_B}; font-size: 14px; outline: none; box-sizing: border-box; }
.sh-input:focus { border-color: ${G.gold}; }
.badge-dot { display: flex; align-items: center; gap: 6px; font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase; }
.pulse-dot { animation: pulseDot 2s ease-in-out infinite; }
.pulse-gold { animation: pulseGold 2.5s ease-in-out infinite; }
.bubble-in { animation: bubbleIn .55s ease-out backwards; position: absolute; }
@keyframes pulseDot { 0%,100% { opacity: 1; box-shadow: 0 0 0 0 rgba(231,76,60,.4); } 50% { opacity: .7; box-shadow: 0 0 0 4px rgba(231,76,60,.1); } }
@keyframes pulseGold { 0%,100% { opacity: .8; } 50% { opacity: 1; } }
@keyframes bubbleIn { from { opacity: 0; transform: translate(-50%,-50%) scale(.88); } to { opacity: 1; transform: translate(-50%,-50%) scale(1); } }
@media (max-width: 700px) {
  .sh-section { padding: 64px 20px; }
  .huddle-multiplier { height: auto !important; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 42px !important; }
  .huddle-brand-center { position: relative !important; left: auto !important; top: auto !important; transform: none !important; grid-column: 1 / -1; margin: 0 auto 12px; }
  .huddle-bubble { position: relative !important; left: auto !important; top: auto !important; transform: none !important; width: auto !important; animation: none !important; }
  .huddle-jump { white-space: normal !important; line-height: 1.25; }
  .huddle-lines { display: none; }
  .sponsor-shot-grid { grid-template-columns: 1fr !important; }
}
@media (max-width: 1080px) { .sponsor-shot-grid { grid-template-columns: repeat(2, minmax(220px, 1fr)) !important; } }
@media (max-width: 860px) { .contact-grid { grid-template-columns: 1fr !important; } }
`;
