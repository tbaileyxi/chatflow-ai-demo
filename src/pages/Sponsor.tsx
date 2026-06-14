import React, { useMemo, useRef, useState } from 'react';
import shLogo from '@/assets/sh-logo-updated.png';

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

interface StaticTeam { city: string; name: string; league: League; }
function teamKey(t: StaticTeam) { return `${t.league}|${t.city}|${t.name}`; }

const LEAGUE_LABELS: Record<string, string> = { NCAA: 'CFB', NFL: 'NFL', NBA: 'NBA', MLB: 'MLB', NHL: 'NHL' };
function displayLeague(l: string) { return LEAGUE_LABELS[l] || l; }

function freeMonths(d = new Date()) {
  const sep1 = new Date(d.getFullYear(), 8, 1);
  if (d >= sep1) return 0;
  const diff = (sep1.getFullYear() - d.getFullYear()) * 12 + (sep1.getMonth() - d.getMonth());
  return Math.min(diff, 3);
}
function freeLabel(n: number) {
  if (n >= 3) return 'June, July & August FREE — 3 months on us';
  if (n === 2) return 'July & August FREE — 2 months on us';
  if (n === 1) return 'August FREE — 1 month on us';
  return 'Season live — first charge today';
}
function bundlePrice(count: number): { total: number; label: string } {
  if (count >= 10) return { total: 1800, label: '$180/team' };
  if (count >= 6)  return { total: 1200, label: '$200/team' };
  if (count >= 3)  return { total: 650,  label: '~$217/team' };
  return { total: count * 250, label: '$250/team' };
}

// ─── All teams — no Supabase needed ──────────────────────────────────────────
const ALL_TEAMS: StaticTeam[] = [
  // NFL
  { city: 'Arizona',       name: 'Cardinals',  league: 'NFL' },
  { city: 'Atlanta',       name: 'Falcons',    league: 'NFL' },
  { city: 'Baltimore',     name: 'Ravens',     league: 'NFL' },
  { city: 'Buffalo',       name: 'Bills',      league: 'NFL' },
  { city: 'Carolina',      name: 'Panthers',   league: 'NFL' },
  { city: 'Chicago',       name: 'Bears',      league: 'NFL' },
  { city: 'Cincinnati',    name: 'Bengals',    league: 'NFL' },
  { city: 'Cleveland',     name: 'Browns',     league: 'NFL' },
  { city: 'Dallas',        name: 'Cowboys',    league: 'NFL' },
  { city: 'Denver',        name: 'Broncos',    league: 'NFL' },
  { city: 'Detroit',       name: 'Lions',      league: 'NFL' },
  { city: 'Green Bay',     name: 'Packers',    league: 'NFL' },
  { city: 'Houston',       name: 'Texans',     league: 'NFL' },
  { city: 'Indianapolis',  name: 'Colts',      league: 'NFL' },
  { city: 'Jacksonville',  name: 'Jaguars',    league: 'NFL' },
  { city: 'Kansas City',   name: 'Chiefs',     league: 'NFL' },
  { city: 'Las Vegas',     name: 'Raiders',    league: 'NFL' },
  { city: 'Los Angeles',   name: 'Chargers',   league: 'NFL' },
  { city: 'Los Angeles',   name: 'Rams',       league: 'NFL' },
  { city: 'Miami',         name: 'Dolphins',   league: 'NFL' },
  { city: 'Minnesota',     name: 'Vikings',    league: 'NFL' },
  { city: 'New England',   name: 'Patriots',   league: 'NFL' },
  { city: 'New Orleans',   name: 'Saints',     league: 'NFL' },
  { city: 'New York',      name: 'Giants',     league: 'NFL' },
  { city: 'New York',      name: 'Jets',       league: 'NFL' },
  { city: 'Philadelphia',  name: 'Eagles',     league: 'NFL' },
  { city: 'Pittsburgh',    name: 'Steelers',   league: 'NFL' },
  { city: 'San Francisco', name: '49ers',      league: 'NFL' },
  { city: 'Seattle',       name: 'Seahawks',   league: 'NFL' },
  { city: 'Tampa Bay',     name: 'Buccaneers', league: 'NFL' },
  { city: 'Tennessee',     name: 'Titans',     league: 'NFL' },
  { city: 'Washington',    name: 'Commanders', league: 'NFL' },
  // NBA
  { city: 'Atlanta',       name: 'Hawks',         league: 'NBA' },
  { city: 'Boston',        name: 'Celtics',        league: 'NBA' },
  { city: 'Brooklyn',      name: 'Nets',           league: 'NBA' },
  { city: 'Charlotte',     name: 'Hornets',        league: 'NBA' },
  { city: 'Chicago',       name: 'Bulls',          league: 'NBA' },
  { city: 'Cleveland',     name: 'Cavaliers',      league: 'NBA' },
  { city: 'Dallas',        name: 'Mavericks',      league: 'NBA' },
  { city: 'Denver',        name: 'Nuggets',        league: 'NBA' },
  { city: 'Detroit',       name: 'Pistons',        league: 'NBA' },
  { city: 'Golden State',  name: 'Warriors',       league: 'NBA' },
  { city: 'Houston',       name: 'Rockets',        league: 'NBA' },
  { city: 'Indiana',       name: 'Pacers',         league: 'NBA' },
  { city: 'Los Angeles',   name: 'Clippers',       league: 'NBA' },
  { city: 'Los Angeles',   name: 'Lakers',         league: 'NBA' },
  { city: 'Memphis',       name: 'Grizzlies',      league: 'NBA' },
  { city: 'Miami',         name: 'Heat',           league: 'NBA' },
  { city: 'Milwaukee',     name: 'Bucks',          league: 'NBA' },
  { city: 'Minnesota',     name: 'Timberwolves',   league: 'NBA' },
  { city: 'New Orleans',   name: 'Pelicans',       league: 'NBA' },
  { city: 'New York',      name: 'Knicks',         league: 'NBA' },
  { city: 'Oklahoma City', name: 'Thunder',        league: 'NBA' },
  { city: 'Orlando',       name: 'Magic',          league: 'NBA' },
  { city: 'Philadelphia',  name: '76ers',          league: 'NBA' },
  { city: 'Phoenix',       name: 'Suns',           league: 'NBA' },
  { city: 'Portland',      name: 'Trail Blazers',  league: 'NBA' },
  { city: 'Sacramento',    name: 'Kings',          league: 'NBA' },
  { city: 'San Antonio',   name: 'Spurs',          league: 'NBA' },
  { city: 'Toronto',       name: 'Raptors',        league: 'NBA' },
  { city: 'Utah',          name: 'Jazz',           league: 'NBA' },
  { city: 'Washington',    name: 'Wizards',        league: 'NBA' },
  // MLB
  { city: 'Arizona',       name: 'Diamondbacks', league: 'MLB' },
  { city: 'Atlanta',       name: 'Braves',       league: 'MLB' },
  { city: 'Baltimore',     name: 'Orioles',      league: 'MLB' },
  { city: 'Boston',        name: 'Red Sox',      league: 'MLB' },
  { city: 'Chicago',       name: 'Cubs',         league: 'MLB' },
  { city: 'Chicago',       name: 'White Sox',    league: 'MLB' },
  { city: 'Cincinnati',    name: 'Reds',         league: 'MLB' },
  { city: 'Cleveland',     name: 'Guardians',    league: 'MLB' },
  { city: 'Colorado',      name: 'Rockies',      league: 'MLB' },
  { city: 'Detroit',       name: 'Tigers',       league: 'MLB' },
  { city: 'Houston',       name: 'Astros',       league: 'MLB' },
  { city: 'Kansas City',   name: 'Royals',       league: 'MLB' },
  { city: 'Los Angeles',   name: 'Angels',       league: 'MLB' },
  { city: 'Los Angeles',   name: 'Dodgers',      league: 'MLB' },
  { city: 'Miami',         name: 'Marlins',      league: 'MLB' },
  { city: 'Milwaukee',     name: 'Brewers',      league: 'MLB' },
  { city: 'Minnesota',     name: 'Twins',        league: 'MLB' },
  { city: 'New York',      name: 'Mets',         league: 'MLB' },
  { city: 'New York',      name: 'Yankees',      league: 'MLB' },
  { city: 'Oakland',       name: 'Athletics',    league: 'MLB' },
  { city: 'Philadelphia',  name: 'Phillies',     league: 'MLB' },
  { city: 'Pittsburgh',    name: 'Pirates',      league: 'MLB' },
  { city: 'San Diego',     name: 'Padres',       league: 'MLB' },
  { city: 'San Francisco', name: 'Giants',       league: 'MLB' },
  { city: 'Seattle',       name: 'Mariners',     league: 'MLB' },
  { city: 'St. Louis',     name: 'Cardinals',    league: 'MLB' },
  { city: 'Tampa Bay',     name: 'Rays',         league: 'MLB' },
  { city: 'Texas',         name: 'Rangers',      league: 'MLB' },
  { city: 'Toronto',       name: 'Blue Jays',    league: 'MLB' },
  { city: 'Washington',    name: 'Nationals',    league: 'MLB' },
  // NHL
  { city: 'Anaheim',       name: 'Ducks',        league: 'NHL' },
  { city: 'Boston',        name: 'Bruins',       league: 'NHL' },
  { city: 'Buffalo',       name: 'Sabres',       league: 'NHL' },
  { city: 'Calgary',       name: 'Flames',       league: 'NHL' },
  { city: 'Carolina',      name: 'Hurricanes',   league: 'NHL' },
  { city: 'Chicago',       name: 'Blackhawks',   league: 'NHL' },
  { city: 'Colorado',      name: 'Avalanche',    league: 'NHL' },
  { city: 'Columbus',      name: 'Blue Jackets', league: 'NHL' },
  { city: 'Dallas',        name: 'Stars',        league: 'NHL' },
  { city: 'Detroit',       name: 'Red Wings',    league: 'NHL' },
  { city: 'Edmonton',      name: 'Oilers',       league: 'NHL' },
  { city: 'Florida',       name: 'Panthers',     league: 'NHL' },
  { city: 'Los Angeles',   name: 'Kings',        league: 'NHL' },
  { city: 'Minnesota',     name: 'Wild',         league: 'NHL' },
  { city: 'Montreal',      name: 'Canadiens',    league: 'NHL' },
  { city: 'Nashville',     name: 'Predators',    league: 'NHL' },
  { city: 'New Jersey',    name: 'Devils',       league: 'NHL' },
  { city: 'New York',      name: 'Islanders',    league: 'NHL' },
  { city: 'New York',      name: 'Rangers',      league: 'NHL' },
  { city: 'Ottawa',        name: 'Senators',     league: 'NHL' },
  { city: 'Philadelphia',  name: 'Flyers',       league: 'NHL' },
  { city: 'Pittsburgh',    name: 'Penguins',     league: 'NHL' },
  { city: 'San Jose',      name: 'Sharks',       league: 'NHL' },
  { city: 'Seattle',       name: 'Kraken',       league: 'NHL' },
  { city: 'St. Louis',     name: 'Blues',        league: 'NHL' },
  { city: 'Tampa Bay',     name: 'Lightning',    league: 'NHL' },
  { city: 'Toronto',       name: 'Maple Leafs',  league: 'NHL' },
  { city: 'Utah',          name: 'Hockey Club',  league: 'NHL' },
  { city: 'Vancouver',     name: 'Canucks',      league: 'NHL' },
  { city: 'Vegas',         name: 'Golden Knights', league: 'NHL' },
  { city: 'Washington',    name: 'Capitals',     league: 'NHL' },
  { city: 'Winnipeg',      name: 'Jets',         league: 'NHL' },
  // NCAA CFB
  { city: 'Alabama',        name: 'Crimson Tide',    league: 'NCAA' },
  { city: 'Arkansas',       name: 'Razorbacks',      league: 'NCAA' },
  { city: 'Auburn',         name: 'Tigers',          league: 'NCAA' },
  { city: 'Baylor',         name: 'Bears',           league: 'NCAA' },
  { city: 'BYU',            name: 'Cougars',         league: 'NCAA' },
  { city: 'Clemson',        name: 'Tigers',          league: 'NCAA' },
  { city: 'Colorado',       name: 'Buffaloes',       league: 'NCAA' },
  { city: 'Duke',           name: 'Blue Devils',     league: 'NCAA' },
  { city: 'Florida',        name: 'Gators',          league: 'NCAA' },
  { city: 'Florida State',  name: 'Seminoles',       league: 'NCAA' },
  { city: 'Georgia',        name: 'Bulldogs',        league: 'NCAA' },
  { city: 'Georgia Tech',   name: 'Yellow Jackets',  league: 'NCAA' },
  { city: 'Iowa',           name: 'Hawkeyes',        league: 'NCAA' },
  { city: 'Iowa State',     name: 'Cyclones',        league: 'NCAA' },
  { city: 'Kansas',         name: 'Jayhawks',        league: 'NCAA' },
  { city: 'Kansas State',   name: 'Wildcats',        league: 'NCAA' },
  { city: 'Kentucky',       name: 'Wildcats',        league: 'NCAA' },
  { city: 'LSU',            name: 'Tigers',          league: 'NCAA' },
  { city: 'Louisville',     name: 'Cardinals',       league: 'NCAA' },
  { city: 'Michigan',       name: 'Wolverines',      league: 'NCAA' },
  { city: 'Michigan State', name: 'Spartans',        league: 'NCAA' },
  { city: 'Mississippi St', name: 'Bulldogs',        league: 'NCAA' },
  { city: 'Missouri',       name: 'Tigers',          league: 'NCAA' },
  { city: 'Nebraska',       name: 'Cornhuskers',     league: 'NCAA' },
  { city: 'North Carolina', name: 'Tar Heels',       league: 'NCAA' },
  { city: 'Notre Dame',     name: 'Fighting Irish',  league: 'NCAA' },
  { city: 'Ohio State',     name: 'Buckeyes',        league: 'NCAA' },
  { city: 'Oklahoma',       name: 'Sooners',         league: 'NCAA' },
  { city: 'Oklahoma State', name: 'Cowboys',         league: 'NCAA' },
  { city: 'Ole Miss',       name: 'Rebels',          league: 'NCAA' },
  { city: 'Oregon',         name: 'Ducks',           league: 'NCAA' },
  { city: 'Penn State',     name: 'Nittany Lions',   league: 'NCAA' },
  { city: 'Purdue',         name: 'Boilermakers',    league: 'NCAA' },
  { city: 'South Carolina', name: 'Gamecocks',       league: 'NCAA' },
  { city: 'Tennessee',      name: 'Volunteers',      league: 'NCAA' },
  { city: 'Texas',          name: 'Longhorns',       league: 'NCAA' },
  { city: 'Texas A&M',      name: 'Aggies',          league: 'NCAA' },
  { city: 'USC',            name: 'Trojans',         league: 'NCAA' },
  { city: 'Utah',           name: 'Utes',            league: 'NCAA' },
  { city: 'Vanderbilt',     name: 'Commodores',      league: 'NCAA' },
  { city: 'Virginia Tech',  name: 'Hokies',          league: 'NCAA' },
  { city: 'Washington',     name: 'Huskies',         league: 'NCAA' },
  { city: 'Wisconsin',      name: 'Badgers',         league: 'NCAA' },
];

// ─────────────────────────────────────────────────────────────────────────────
export default function Sponsor() {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search,   setSearch]   = useState('');
  const [league,   setLeague]   = useState<LeagueFilter>('ALL');
  const formRef = useRef<HTMLDivElement>(null);
  const free = freeMonths();

  const featured = ALL_TEAMS.find(t => t.city === 'Chicago' && t.league === 'NFL')!;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ALL_TEAMS.filter(t => {
      if (league !== 'ALL' && t.league !== league) return false;
      if (q && !`${t.city} ${t.name}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [search, league]);

  const selectedTeams = ALL_TEAMS.filter(t => selected.has(teamKey(t)));
  const price = bundlePrice(selectedTeams.length);

  function toggle(t: StaticTeam) {
    const k = teamKey(t);
    setSelected(prev => {
      const next = new Set(prev);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });
  }

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
      <RateCard free={free} />
      <div ref={formRef}>
        <TeamPicker
          filtered={filtered} selected={selected} toggle={toggle}
          search={search} setSearch={setSearch}
          league={league} setLeague={setLeague}
          free={free}
        />
        {selectedTeams.length > 0 && (
          <ContactForm
            selectedTeams={selectedTeams} price={price} free={free}
            onClearAll={() => setSelected(new Set())}
          />
        )}
      </div>
      <Footer onCta={scrollToForm} />
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
          We're opening Side Huddle Founding Team Sponsorships for a limited time. Own a team's entire fanbase —
          exclusive, always-on, inside the conversation. <strong style={{ color: G.white }}>Founding rates are
          locked for the life of your sponsorship.</strong> Reach out and we'll send pricing and availability.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 28 }}>
          {[
            { phase: 'Early Founding', price: 'Locked founding rate', active: true },
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
          <button className="btn-outline" onClick={() => document.getElementById('rate-card')?.scrollIntoView({ behavior: 'smooth' })}>How it works</button>
        </div>
      </div>
    </section>
  );
}

// ─── Section 1: The Moment ────────────────────────────────────────────────────
const HUDDLE_BUBBLES = [
  { name: 'The Boys Fantasy',    live: 5 },
  { name: 'Bears War Room',      live: 3 },
  { name: 'Section 204 Crew',    live: 8 },
  { name: 'Sports Degenerates',  live: 4 },
  { name: 'Da Bears Diehards',   live: 6 },
  { name: 'Halftime Hustle',     live: 2 },
  { name: 'Monsters of Midway',  live: 7 },
  { name: 'Sunday Ritual',       live: 4 },
];

function Moment({ featured }: { featured: StaticTeam }) {
  return (
    <section className="sh-section" style={{ borderTop: `1px solid ${G.border}` }}>
      <div className="sh-label">01 — WHY THIS IS DIFFERENT</div>
      <h2 style={{ fontFamily: FONT_H, fontWeight: 700, fontSize: 'clamp(36px, 5vw, 60px)', lineHeight: 1.0, marginTop: 16, maxWidth: 960, textTransform: 'uppercase' }}>
        It's not one chatroom.<br />
        It's <span style={{ color: G.gold }}>hundreds of live huddles</span> — all powered by your brand.
      </h2>
      <p style={{ fontSize: 17, lineHeight: 1.65, color: '#aaa', maxWidth: 860, marginTop: 24 }}>
        On game day, dozens of separate fan huddles are happening simultaneously around your team. Friends jumping between
        rooms. Debates, predictions, live reactions. The Side Huddle AI bot is active in every single one — surfacing stats,
        highlights, and real-time updates. Your brand is on every message.{' '}
        <strong style={{ color: G.white }}>Not one impression. Hundreds of simultaneous moments, all game long.</strong>
      </p>
      <HuddleMultiplier />
      <p style={{ textAlign: 'center', marginTop: 32, fontSize: 13, color: G.muted, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
        One team. One sponsor. Everywhere at once.
      </p>
    </section>
  );
}

function HuddleMultiplier() {
  return (
    <div style={{ position: 'relative', margin: '72px auto 0', height: 540, maxWidth: 900 }}>
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: 120, height: 120, borderRadius: '50%', background: G.surface2, border: `2px solid ${G.gold}`, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5, boxShadow: `0 0 48px rgba(255,215,0,.18)` }}>
        <img src={shLogo} alt="Side Huddle" style={{ width: 64, height: 64, objectFit: 'contain', borderRadius: '50%' }} />
      </div>
      {HUDDLE_BUBBLES.map((h, i) => {
        const a = (i / HUDDLE_BUBBLES.length) * Math.PI * 2 - Math.PI / 2;
        const r = 220;
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        return (
          <div key={h.name} className="bubble-in" style={{ position: 'absolute', left: `calc(50% + ${x}px)`, top: `calc(50% + ${y}px)`, transform: 'translate(-50%,-50%)', width: 176, animationDelay: `${i * 0.09}s` }}>
            <div style={{ background: G.surface, border: `1px solid ${G.border}`, borderRadius: 8, padding: '12px 14px' }}>
              <div style={{ fontWeight: 700, fontSize: 12 }}>{h.name}</div>
              <div style={{ fontSize: 11, color: '#7ec85f', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 6, height: 6, background: '#7ec85f', borderRadius: '50%', flexShrink: 0 }} />
                {h.live} live
              </div>
              <div className="pulse-gold" style={{ marginTop: 9, borderTop: `1px solid ${G.goldDim}`, paddingTop: 7, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', color: G.gold, fontWeight: 700 }}>
                powered by YOUR BRAND
              </div>
            </div>
          </div>
        );
      })}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1 }}>
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
  return (
    <section className="sh-section" style={{ borderTop: `1px solid ${G.border}` }}>
      <div className="sh-label">02 — THE PLATFORM</div>
      <h2 style={{ fontFamily: FONT_H, fontWeight: 700, fontSize: 'clamp(36px, 5vw, 60px)', lineHeight: 1.0, marginTop: 16, textTransform: 'uppercase' }}>
        Three placements. <span style={{ color: G.gold }}>One sponsor.</span> Always on.
      </h2>
      <p style={{ color: '#999', marginTop: 16, maxWidth: 720, fontSize: 16, lineHeight: 1.6 }}>
        Your brand is embedded across three distinct surfaces — not one banner, not one impression. Always on, all game long.
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))', gap: 28, marginTop: 64 }}>
        <PhoneFrame label="TEAM FEED · Placement 01 & 02">
          <img src="/sponsor-screens/team-feed.png" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', borderRadius: 18 }} alt="Team feed sponsor placement" />
        </PhoneFrame>
        <PhoneFrame label="BOT IN HUDDLE · Placement 03">
          <img src="/sponsor-screens/huddle-bot.png" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', borderRadius: 18 }} alt="Huddle bot sponsor placement" />
        </PhoneFrame>
        <PhoneFrame label="WEEKLY IN-FEED SPONSOR DROP">
          <img src="/sponsor-screens/sponsor-drop.png" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', borderRadius: 18 }} alt="Weekly sponsor drop placement" />
        </PhoneFrame>
      </div>
    </section>
  );
}

function PhoneFrame({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="sh-label" style={{ color: G.muted, marginBottom: 12 }}>{label}</div>
      <div style={{ background: '#000', border: `1.5px solid ${G.border}`, borderRadius: 32, padding: 10, maxWidth: 300, margin: '0 auto', boxShadow: '0 24px 64px rgba(0,0,0,.6)', aspectRatio: '9/19' }}>
        <div style={{ background: G.bg, height: '100%', borderRadius: 24, overflow: 'hidden' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ─── Section 3: What You Get ──────────────────────────────────────────────────
function WhatYouGet() {
  const cards = [
    { icon: '⚡', title: 'Bot Attribution',    body: 'Every team-bot message carries a "powered by" line. One sponsor per team — no competitors in your community. Ever.' },
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
          <div style={{ fontFamily: FONT_H, fontWeight: 700, fontSize: 'clamp(44px, 6vw, 76px)', color: G.gold, lineHeight: 0.95, letterSpacing: '-0.02em' }}>Locked for life</div>
          <div className="sh-label" style={{ color: G.muted, marginTop: 8 }}>founding sponsors only</div>
        </div>
        <div>
          <div className="sh-label" style={{ marginBottom: 16 }}>COMPARABLE VALUE</div>
          <p style={{ fontSize: 18, lineHeight: 1.65, color: '#ddd' }}>
            A single local radio spot runs <strong>$500–1,500/week</strong>. One local TV placement: <strong>$2,000–5,000</strong>. A Side Huddle founding sponsorship is a fraction of that — exclusive, always-on, inside the conversation when fans are most engaged.
          </p>
          <p style={{ fontSize: 18, lineHeight: 1.65, color: '#ddd', marginTop: 16 }}>
            Own an entire fanbase on Side Huddle. <strong style={{ color: G.gold }}>Reach out for current founding rates and availability.</strong>
          </p>
        </div>
      </div>
    </section>
  );
}

// ─── Section 5: Rate Card ─────────────────────────────────────────────────────
function RateCard({ free }: { free: number }) {
  const urgency = [
    { when: 'Start today',   detail: 'June, July & August FREE',  sub: '3 months · first charge Sep 1', active: free >= 3 },
    { when: 'Start in June', detail: 'July & August FREE',        sub: '2 months · first charge Sep 1', active: free === 2 },
    { when: 'Start in July', detail: 'August FREE',               sub: '1 month · first charge Sep 1',  active: free === 1 },
    { when: 'Start Sep 1+',  detail: 'No free months',           sub: 'Season live — charged immediately', active: free === 0 },
  ];
  const infoCards = [
    { title: 'BILLING',     body: 'Month-to-month. No annual contract. Up to 3 free months for founding sponsors who start now. First charge September 1.' },
    { title: 'RATE LOCK',   body: 'Founding rate locked through your first active season. Pricing increases in stages as inventory fills. Cancel and it\'s gone.' },
    { title: 'EXCLUSIVITY', body: 'One sponsor per team. No competitors in your community. Ever.' },
    { title: 'RENEWAL',     body: 'End-of-season pricing based on platform performance at that time.' },
  ];
  return (
    <section className="sh-section" id="rate-card" style={{ borderTop: `1px solid ${G.border}` }}>
      <div className="sh-label">04 — FOUNDING SPONSOR PRICING</div>

      <div style={{ marginTop: 24, border: `1px solid ${G.gold}`, borderRadius: 8, padding: 'clamp(20px,3vw,32px)', background: 'rgba(255,215,0,.04)' }}>
        <div style={{ fontFamily: FONT_H, fontWeight: 700, fontSize: 'clamp(20px,2.8vw,30px)', color: G.gold, textTransform: 'uppercase' }}>
          🏈 Start today — get June, July & August free.
        </div>
        <p style={{ color: '#ddd', marginTop: 10, fontSize: 16 }}>Paid season begins September 1 — right as college football hits full stride. The sooner you lock in, the more free runway you get.</p>
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
          Email us for current founding rates
        </div>
        <p style={{ color: '#ccc', marginTop: 10, fontSize: 15 }}>Pick your team(s) below and send your info — we'll reply with pricing and availability, usually same day.</p>
        <a href="mailto:qb1@sidehuddlesports.com" style={{ display: 'inline-block', marginTop: 16, color: G.gold, fontWeight: 700, fontSize: 18, textDecoration: 'none' }}>qb1@sidehuddlesports.com</a>
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
const LEAGUES: LeagueFilter[] = ['ALL', 'NCAA', 'NFL', 'NBA', 'MLB', 'NHL'];
const LEAGUE_DISPLAY: Record<LeagueFilter, string> = { ALL: 'ALL', NCAA: 'CFB', NFL: 'NFL', NBA: 'NBA', MLB: 'MLB', NHL: 'NHL' };

function TeamPicker({ filtered, selected, toggle, search, setSearch, league, setLeague, free }: {
  filtered: StaticTeam[]; selected: Set<string>; toggle: (t: StaticTeam) => void;
  search: string; setSearch: (s: string) => void;
  league: LeagueFilter; setLeague: (l: LeagueFilter) => void;
  free: number;
}) {
  const count = selected.size;
  return (
    <section className="sh-section" style={{ borderTop: `1px solid ${G.border}` }}>
      <div className="sh-label">05 — CLAIM YOUR TEAM</div>
      <h2 style={{ fontFamily: FONT_H, fontWeight: 700, fontSize: 'clamp(44px,6vw,80px)', lineHeight: 0.95, marginTop: 16, textTransform: 'uppercase' }}>
        First in <span style={{ color: G.gold }}>owns the team.</span>
      </h2>
      <p style={{ color: '#aaa', marginTop: 16, maxWidth: 720, fontSize: 17, lineHeight: 1.6 }}>
        Pick the team(s) you want below — then fill out your info and we'll email you founding rates within a day.
        {free > 0 && <> Start today — <strong style={{ color: G.gold }}>{freeLabel(free)}</strong>.</>}
      </p>

      {count > 0 && (
        <div style={{ marginTop: 20, padding: '14px 20px', background: 'rgba(255,215,0,.06)', border: `1px solid ${G.gold}`, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <span style={{ fontFamily: FONT_H, fontWeight: 700, fontSize: 22, color: G.gold }}>{count} team{count !== 1 ? 's' : ''} selected</span>
            <span style={{ color: G.muted2, fontSize: 14, marginLeft: 12 }}>Founding bundle — we'll send pricing</span>
          </div>
          <span style={{ fontSize: 13, color: '#7ec85f' }}>↓ Fill your info below and we'll be in touch</span>
        </div>
      )}

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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px,1fr))', gap: 10, marginTop: 28 }}>
        {filtered.length === 0 && <div style={{ gridColumn: '1/-1', color: G.muted, padding: 48, textAlign: 'center' }}>No teams match your search.</div>}
        {filtered.map(t => {
          const on = selected.has(teamKey(t));
          return (
            <button key={teamKey(t)} onClick={() => toggle(t)}
              style={{ background: on ? 'rgba(255,215,0,.08)' : G.surface, border: `1px solid ${on ? G.gold : G.border}`, borderRadius: 8, padding: '14px 16px', cursor: 'pointer', textAlign: 'left', transition: 'border-color .15s, background .15s', position: 'relative' }}>
              {on && <span style={{ position: 'absolute', top: 8, right: 10, color: G.gold, fontWeight: 800, fontSize: 14 }}>✓</span>}
              <div style={{ fontWeight: 700, fontSize: 14, color: on ? G.gold : G.white, lineHeight: 1.2 }}>{t.city} {t.name}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 8 }}>
                <span className="sh-label" style={{ fontSize: 9, color: on ? G.gold : G.muted }}>{displayLeague(t.league)}</span>
                <span style={{ fontFamily: FONT_H, fontWeight: 700, fontSize: 13, color: on ? G.gold : G.muted2 }}>{on ? 'SELECTED' : 'AVAILABLE'}</span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ─── Section 7: Contact Form (sends email directly) ───────────────────────────
function ContactForm({ selectedTeams, price, free, onClearAll }: {
  selectedTeams: StaticTeam[]; price: { total: number; label: string }; free: number; onClearAll: () => void;
}) {
  const [f, setF] = useState({ brand: '', name: '', email: '', phone: '', message: '' });
  const [sent, setSent] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.brand || !f.name || !f.email) return;

    const teamList = selectedTeams.map(t => `• ${t.city} ${t.name} (${displayLeague(t.league)})`).join('\n');
    const subject = encodeURIComponent(`Founding Sponsor Inquiry — ${f.brand} — ${selectedTeams.length} team${selectedTeams.length !== 1 ? 's' : ''}`);
    const body = encodeURIComponent(
`FOUNDING SPONSOR INQUIRY
========================

TEAMS REQUESTED (${selectedTeams.length}):
${teamList}

(Please send founding rates + availability for these teams.)

BRAND INFO:
Company: ${f.brand}
Contact: ${f.name}
Email: ${f.email}
Phone: ${f.phone || 'Not provided'}

MESSAGE:
${f.message || 'No message provided'}

---
Submitted via sidehuddlesports.com/sponsors`
    );

    window.location.href = `mailto:qb1@sidehuddlesports.com?subject=${subject}&body=${body}`;
    setSent(true);
  }

  if (sent) {
    return (
      <section className="sh-section" style={{ borderTop: `1px solid ${G.border}` }}>
        <div style={{ maxWidth: 640, margin: '0 auto', textAlign: 'center', padding: '40px 0' }}>
          <div style={{ fontSize: 56, marginBottom: 20 }}>🏆</div>
          <div style={{ fontFamily: FONT_H, fontWeight: 700, fontSize: 40, color: G.gold, textTransform: 'uppercase' }}>Your email is ready.</div>
          <p style={{ color: '#ccc', marginTop: 16, fontSize: 17, lineHeight: 1.65 }}>
            Your mail app opened with all your info pre-filled. Hit send and we'll reply with founding rates and availability, usually same day.
          </p>
          <p style={{ color: G.muted, marginTop: 12, fontSize: 14 }}>
            No mail app? Email us directly: <a href="mailto:qb1@sidehuddlesports.com" style={{ color: G.gold }}>qb1@sidehuddlesports.com</a>
          </p>
          <button className="btn-outline" style={{ marginTop: 28 }} onClick={() => { setSent(false); onClearAll(); }}>Start over</button>
        </div>
      </section>
    );
  }

  return (
    <section className="sh-section" style={{ borderTop: `1px solid ${G.border}` }}>
      <div className="sh-label">06 — YOUR INFO</div>
      <h2 style={{ fontFamily: FONT_H, fontWeight: 700, fontSize: 'clamp(36px, 5vw, 56px)', lineHeight: 1.0, marginTop: 16, textTransform: 'uppercase' }}>
        Lock in your spot. <span style={{ color: G.gold }}>We'll handle the rest.</span>
      </h2>
      <p style={{ color: '#aaa', marginTop: 12, fontSize: 16, lineHeight: 1.6, maxWidth: 680 }}>
        No payment today. We'll reply with pricing and availability, usually same day.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.1fr)', gap: 40, marginTop: 48, alignItems: 'start' }}>
        {/* Order summary */}
        <div style={{ background: G.surface, border: `1px solid ${G.border}`, borderRadius: 8, padding: 28 }}>
          <div className="sh-label" style={{ marginBottom: 16 }}>ORDER SUMMARY</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {selectedTeams.map(t => (
              <div key={teamKey(t)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${G.border}` }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{t.city} {t.name}</div>
                  <div className="sh-label" style={{ fontSize: 9, color: G.muted, marginTop: 2 }}>{displayLeague(t.league)}</div>
                </div>
                <div style={{ fontSize: 13, color: G.muted2 }}>Founding rate</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 20, paddingTop: 16, borderTop: `1px solid ${G.gold}44` }}>
            <div className="sh-label">PRICING</div>
            <div style={{ fontFamily: FONT_H, fontWeight: 700, fontSize: 20, color: G.gold }}>We'll email you</div>
          </div>
          <div style={{ marginTop: 16, padding: '12px 14px', background: G.bg, border: `1px solid ${G.border}`, borderRadius: 6, fontSize: 13, color: '#bbb', lineHeight: 1.6 }}>
            <strong style={{ color: G.white }}>No card charged.</strong> Send your info and we'll reply with founding rates and availability for your team(s) — usually same day. Your spot is held while we talk.
          </div>
        </div>

        {/* Contact form */}
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <FF label="Brand / Company *"    value={f.brand}   onChange={v => setF({ ...f, brand: v })} />
          <FF label="Your name *"          value={f.name}    onChange={v => setF({ ...f, name: v })} />
          <FF label="Email *"              value={f.email}   onChange={v => setF({ ...f, email: v })} type="email" />
          <FF label="Phone (optional)"     value={f.phone}   onChange={v => setF({ ...f, phone: v })} />
          <FF label="Message (optional)"   value={f.message} onChange={v => setF({ ...f, message: v })} multiline />
          <button className="btn-gold" type="submit" style={{ marginTop: 8, width: '100%', fontSize: 15, padding: '16px 28px' }}
            disabled={!f.brand || !f.name || !f.email}>
            Request pricing →
          </button>
          <p style={{ fontSize: 12, color: G.muted, textAlign: 'center', marginTop: 4 }}>
            This opens your email app with everything pre-filled. Just hit send.
          </p>
        </form>
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

// ─── Shared form field ────────────────────────────────────────────────────────
function FF({ label, value, onChange, type = 'text', multiline = false }: { label: string; value: string; onChange: (v: string) => void; type?: string; multiline?: boolean }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <span className="sh-label" style={{ color: G.muted }}>{label}</span>
      {multiline
        ? <textarea className="sh-input" rows={3} value={value} onChange={e => onChange(e.target.value)} style={{ resize: 'vertical' }} />
        : <input className="sh-input" type={type} value={value} onChange={e => onChange(e.target.value)} />
      }
    </label>
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
@media (max-width: 700px) { .sh-section { padding: 64px 20px; } }
@media (max-width: 860px) { .contact-grid { grid-template-columns: 1fr !important; } }
`;
