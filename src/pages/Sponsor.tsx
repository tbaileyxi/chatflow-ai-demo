import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import shLogo from '@/assets/sh-logo-updated.png';

// ─── Brand palette (matches sidehuddlesports.com) ──────────────────────────
const G = {
  bg: '#0a0a0a',
  surface: '#111111',
  surface2: '#181818',
  border: '#222222',
  gold: '#FFD700',
  goldDim: '#C9A84C',
  white: '#ffffff',
  muted: '#666666',
  muted2: '#999999',
  green: '#3d6b22',
  red: '#6b2222',
};

const FONT_H = "'Barlow Condensed', 'Orbitron', sans-serif";
const FONT_B = "'Barlow', 'Inter', sans-serif";

type LeagueFilter = 'ALL' | 'NCAA' | 'NFL' | 'NBA' | 'MLB' | 'NHL';

interface Team {
  id: string;
  name: string;
  city: string;
  league: string | null;
  logo_url: string | null;
  sponsorStatus: 'available' | 'confirmed';
}

// Billing starts Sep 1. June/Jul/Aug = free runway.
function freeMonths(d = new Date()) {
  const sep1 = new Date(d.getFullYear(), 8, 1);
  if (d >= sep1) return 0;
  // months remaining before Sep 1
  const diff = (sep1.getFullYear() - d.getFullYear()) * 12 + (sep1.getMonth() - d.getMonth());
  return Math.min(diff, 3); // cap at 3
}
function freeLabel(n: number) {
  if (n >= 3) return 'June, July & August FREE — 3 months on us';
  if (n === 2) return 'July & August FREE — 2 months on us';
  if (n === 1) return 'August FREE — 1 month on us';
  return 'Season live — first charge today';
}
function billingDate(n: number) {
  if (n === 0) return 'Charged immediately';
  return 'First charge September 1';
}
function bundlePrice(count: number): { total: number; label: string } {
  if (count >= 10) return { total: 1800, label: '$180/team' };
  if (count >= 6)  return { total: 1200, label: '$200/team' };
  if (count >= 3)  return { total: 650,  label: '~$217/team' };
  return { total: count * 250, label: '$250/team' };
}

const LEAGUE_LABELS: Record<string, string> = {
  NCAA: 'CFB', NFL: 'NFL', NBA: 'NBA', MLB: 'MLB', NHL: 'NHL',
};
function displayLeague(l: string | null) {
  return LEAGUE_LABELS[l || ''] || l || '—';
}

// ─────────────────────────────────────────────────────────────────────────────
export default function Sponsor() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [league, setLeague] = useState<LeagueFilter>('ALL');
  const [inquireFor, setInquireFor] = useState<Team | null>(null);
  const [buyFor, setBuyFor]         = useState<Team | null>(null);
  const teamsRef = useRef<HTMLDivElement>(null);
  const free = freeMonths();

  // Featured team for diagram (Chicago Bears)
  const featured = useMemo(
    () => teams.find(t => t.name === 'Bears' || (t.city === 'Chicago' && t.league === 'NFL')) || teams.find(t => t.league === 'NFL'),
    [teams]
  );

  useEffect(() => {
    let active = true;
    (async () => {
      // Pull real teams with logos
      const { data: teamsData } = await supabase
        .from('teams')
        .select('id, name, city, league, logo_url')
        .in('league', ['NFL', 'NCAA', 'NBA', 'MLB', 'NHL'])
        .neq('status', 'inactive')
        .order('league').order('city');

      // Pull confirmed sponsor claims
      const { data: claimed } = await supabase
        .from('sponsor_teams' as any)
        .select('team_id')
        .eq('status', 'confirmed');

      if (!active) return;
      const claimedSet = new Set((claimed || []).map((r: any) => r.team_id));
      const merged: Team[] = (teamsData || []).map((t: any) => ({
        id: t.id,
        name: t.name,
        city: t.city,
        league: t.league,
        logo_url: t.logo_url,
        sponsorStatus: claimedSet.has(t.id) ? 'confirmed' : 'available',
      }));
      setTeams(merged);
      setLoading(false);
    })();

    // Realtime for live status updates
    const ch = supabase.channel('sponsor_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sponsor_teams' }, (p: any) => {
        if (p.eventType === 'INSERT' || p.eventType === 'UPDATE') {
          const row = p.new;
          if (row.status === 'confirmed') {
            setTeams(prev => prev.map(t => t.id === row.team_id ? { ...t, sponsorStatus: 'confirmed' } : t));
          }
        }
      })
      .subscribe();

    return () => { active = false; supabase.removeChannel(ch); };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return teams.filter(t => {
      if (league !== 'ALL' && t.league !== league) return false;
      if (q) {
        const full = `${t.city} ${t.name}`.toLowerCase();
        if (!full.includes(q)) return false;
      }
      return true;
    });
  }, [teams, search, league]);

  const scroll = () => teamsRef.current?.scrollIntoView({ behavior: 'smooth' });

  return (
    <div style={{ background: G.bg, color: G.white, fontFamily: FONT_B, minHeight: '100vh' }}>
      <style>{css}</style>
      <Nav />
      <Hero onCta={scroll} />
      <Moment featured={featured} />
      <PlatformPreview />
      <WhatYouGet />
      <ROISection />
      <RateCard free={free} />
      <div ref={teamsRef}>
        <TeamPicker
          teams={filtered} loading={loading}
          search={search} setSearch={setSearch}
          league={league} setLeague={setLeague}
          free={free}
          onInquire={setInquireFor}
          onBuy={setBuyFor}
        />
      </div>
      <Footer onCta={scroll} />

      {inquireFor && <InquireModal team={inquireFor} free={free} onClose={() => setInquireFor(null)} />}
      {buyFor && <BuyModal team={buyFor} free={free} allTeams={teams} onClose={() => setBuyFor(null)} />}
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
          We're opening Side Huddle Founding Team Sponsorships for a limited time. Brands can secure exclusive access
          at <strong style={{ color: G.white }}>$250/month per team</strong> — locked for the duration of your sponsorship.
          Pricing increases in stages as inventory fills. This is early access to a new fan engagement layer,
          not just an ad product.
        </p>
        {/* Phase ladder */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 28 }}>
          {[
            { phase: 'Early Founding', price: '$250/mo', active: true },
            { phase: 'Next Phase', price: 'Increased pricing', active: false },
            { phase: 'Full Rollout', price: 'Market pricing', active: false },
          ].map(p => (
            <div key={p.phase} style={{ padding: '10px 16px', border: `1px solid ${p.active ? G.gold : G.border}`, borderRadius: 4, background: p.active ? 'rgba(255,215,0,.08)' : 'transparent' }}>
              <div className="sh-label" style={{ color: p.active ? G.gold : G.muted }}>{p.phase}</div>
              <div style={{ fontWeight: 700, fontSize: 14, color: p.active ? G.white : G.muted2, marginTop: 4 }}>{p.price}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 36 }}>
          <button className="btn-gold" onClick={onCta}>Claim your team →</button>
          <button className="btn-outline" onClick={() => document.getElementById('rate-card')?.scrollIntoView({ behavior: 'smooth' })}>See pricing</button>
        </div>
      </div>
    </section>
  );
}

// ─── Section 2: The Moment + Diagram ─────────────────────────────────────────
const HUDDLE_BUBBLES = [
  { name: 'The Boys Fantasy', live: 5 },
  { name: 'Bears War Room',   live: 3 },
  { name: 'Section 204 Crew', live: 8 },
  { name: 'Sports Degenerates', live: 4 },
  { name: 'Da Bears Diehards', live: 6 },
  { name: 'Halftime Hustle',  live: 2 },
  { name: 'Monsters of Midway', live: 7 },
  { name: 'Sunday Ritual',   live: 4 },
];

function Moment({ featured }: { featured?: Team }) {
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
      <HuddleMultiplier featured={featured} />
      <p style={{ textAlign: 'center', marginTop: 32, fontSize: 13, color: G.muted, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
        One team. One sponsor. Everywhere at once.
      </p>
    </section>
  );
}

function HuddleMultiplier({ featured }: { featured?: Team }) {
  return (
    <div style={{ position: 'relative', margin: '72px auto 0', height: 540, maxWidth: 900 }}>
      {/* Center logo */}
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: 120, height: 120, borderRadius: '50%', background: G.surface2, border: `2px solid ${G.gold}`, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5, boxShadow: `0 0 48px rgba(255,215,0,.18)` }}>
        {featured?.logo_url
          ? <img src={featured.logo_url} alt={featured.name} style={{ width: 80, height: 80, objectFit: 'contain' }} />
          : <img src={shLogo} alt="Side Huddle" style={{ width: 64, height: 64, objectFit: 'contain', borderRadius: '50%' }} />
        }
      </div>
      {/* Bubbles */}
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
      {/* SVG lines */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1 }}>
        {HUDDLE_BUBBLES.map((_, i) => {
          const a = (i / HUDDLE_BUBBLES.length) * Math.PI * 2 - Math.PI / 2;
          return (
            <line key={i} x1="50%" y1="50%"
              x2={`calc(50% + ${Math.cos(a) * 220}px)`}
              y2={`calc(50% + ${Math.sin(a) * 220}px)`}
              stroke={G.gold} strokeOpacity={0.18} strokeWidth={1} strokeDasharray="3,5" />
          );
        })}
      </svg>
    </div>
  );
}

// ─── Section 3: Platform Preview ─────────────────────────────────────────────
const PLACEMENT_CARDS = [
  {
    num: '01',
    title: 'Team Feed Badge',
    sub: 'PRESENTED BY placement',
    body: 'Your brand appears at the top of your team\'s live feed as "Presented by [Your Brand]" — visible to every fan who opens the feed, every session, all season long.',
  },
  {
    num: '02',
    title: '1 Message / Week In-Feed',
    sub: 'SPONSORED DROP in team feed',
    body: 'Once per week during the active season, your brand gets a full message card in the team feed — with optional QR code, promo code, or offer. Side Huddle approves before it goes live.',
  },
  {
    num: '03',
    title: 'All-Bot Sponsorship',
    sub: 'POWERED BY on every bot card',
    body: 'The Side Huddle AI bot is active in every fan huddle around your team — surfacing stats, highlights, and live updates. Every bot card carries your "powered by" attribution. All huddles. All game long.',
  },
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

      {/* Placement breakdown cards */}
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

      {/* Phone frames */}
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
        <div style={{ background: G.bg, height: '100%', borderRadius: 24, padding: 14, fontSize: 11, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 9 }}>
          {children}
        </div>
      </div>
    </div>
  );
}
function YB({ size = 10 }: { size?: number }) {
  return <span style={{ color: G.gold, fontWeight: 800, fontSize: size, letterSpacing: '0.1em', textShadow: `0 0 10px rgba(255,215,0,.4)` }}>YOUR BRAND</span>;
}
function BotBadge() {
  return <span style={{ fontSize: 7, padding: '1px 5px', background: G.border, borderRadius: 3, color: G.muted2, fontWeight: 600, letterSpacing: '0.08em' }}>BOT</span>;
}
function FrameSponsorDrop() {
  return (<>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#e74c3c', flexShrink: 0 }} className="pulse-dot" />
      <span className="sh-label" style={{ fontSize: 8 }}>LIVE FEED · CHICAGO BEARS</span>
    </div>
    {/* Sponsor card matching real app style */}
    <div style={{ background: G.surface2, border: `1px solid ${G.gold}`, borderRadius: 8, padding: 12, marginTop: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{ width: 28, height: 28, borderRadius: 6, background: G.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#000', flexShrink: 0 }}>YB</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 11 }}><YB /></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
            <span style={{ fontSize: 7, padding: '1px 5px', background: 'rgba(255,215,0,.2)', color: G.gold, borderRadius: 3, fontWeight: 700, letterSpacing: '0.08em' }}>SPONSOR</span>
            <span style={{ fontSize: 8, color: G.muted }}>Week 12 · Game day</span>
          </div>
        </div>
      </div>
      <div style={{ background: G.bg, border: `1px solid ${G.border}`, borderRadius: 6, padding: 10 }}>
        <div style={{ fontSize: 8, color: G.gold, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase' }}>BEARS FANS · THIS WEEK ONLY</div>
        <div style={{ fontWeight: 700, fontSize: 11, marginTop: 6, lineHeight: 1.3 }}>$2 off any pour — show this at the bar</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
          <button style={{ background: G.gold, color: '#000', fontWeight: 700, fontSize: 9, padding: '5px 10px', borderRadius: 12, border: 'none', cursor: 'pointer' }}>Claim offer →</button>
          <span style={{ fontSize: 8, color: G.muted }}>code <strong style={{ color: G.white }}>SH-BEARS</strong></span>
        </div>
      </div>
      <div style={{ marginTop: 8, fontSize: 8, color: G.muted }}>1 sponsor message / week during active season</div>
    </div>
    <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
      <span style={{ background: G.surface, border: `1px solid ${G.border}`, borderRadius: 12, padding: '3px 8px', fontSize: 10 }}>🔥 41</span>
      <span style={{ background: G.surface, border: `1px solid ${G.border}`, borderRadius: 12, padding: '3px 8px', fontSize: 10 }}>👍 28</span>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
      <span style={{ fontSize: 8, color: G.muted, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Powered by</span>
      <YB size={8} />
    </div>
  </>);
}
function FrameFeed() {
  return (<>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#e74c3c', flexShrink: 0 }} className="pulse-dot" />
      <span className="sh-label" style={{ fontSize: 8 }}>LIVE FEED · CHICAGO BEARS</span>
    </div>
    <div style={{ background: G.surface, border: `1px solid ${G.gold}`, borderRadius: 6, padding: 9 }}>
      <div style={{ fontSize: 8, color: G.muted, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Bears Feed · Presented by</div>
      <div style={{ marginTop: 5 }}><YB /></div>
    </div>
    <div style={{ background: G.surface2, border: `1px solid ${G.border}`, borderRadius: 6, padding: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ width: 18, height: 18, borderRadius: '50%', background: G.gold, color: '#000', fontWeight: 800, fontSize: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>SH</div>
        <span style={{ fontSize: 10, fontWeight: 700, color: G.gold }}>Bears Bot</span>
        <BotBadge />
      </div>
      <p style={{ fontSize: 10, marginTop: 6, lineHeight: 1.4 }}>Caleb Williams just hit 300 yards — here's every 300-yd game in Bears history.</p>
      <div style={{ borderTop: `1px solid ${G.border}`, marginTop: 8, paddingTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 8, color: G.muted, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Powered by</span>
        <YB />
      </div>
    </div>
    <div style={{ display: 'flex', gap: 6 }}>
      <span style={{ background: G.surface, border: `1px solid ${G.border}`, borderRadius: 12, padding: '3px 8px', fontSize: 10 }}>🔥 41</span>
      <span style={{ background: G.surface, border: `1px solid ${G.border}`, borderRadius: 12, padding: '3px 8px', fontSize: 10 }}>👍 28</span>
    </div>
  </>);
}
function FrameHuddle() {
  return (<>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 9, color: '#7ec85f' }}>● 5 in the room</span>
      <span className="sh-label" style={{ fontSize: 8 }}>HUDDLE</span>
    </div>
    <div style={{ background: G.gold, color: '#0a0a0a', borderRadius: '12px 12px 2px 12px', padding: '8px 10px', fontSize: 10, alignSelf: 'flex-end', maxWidth: '88%' }}>
      Just got to the bar — section 204 anyone? 🍺
    </div>
    <div style={{ fontSize: 10 }}><strong>Dan:</strong> I'm in 206! come thru at halftime 🏈</div>
    <div style={{ background: G.surface2, border: `1px solid ${G.gold}55`, borderRadius: 6, padding: 9 }}>
      <div style={{ display: 'flex', gap: 5 }}><BotBadge /><span style={{ fontSize: 8, padding: '1px 5px', background: 'rgba(61,107,34,.4)', color: '#7ec85f', borderRadius: 3, fontWeight: 700, letterSpacing: '0.05em' }}>PREDICTION</span></div>
      <div style={{ fontSize: 10, marginTop: 5 }}>Bears win Super Bowl LX?</div>
      <div style={{ height: 4, background: G.border, borderRadius: 2, marginTop: 5, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: '34%', background: '#3d6b22', borderRadius: 2 }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, marginTop: 4 }}>
        <span style={{ color: '#7ec85f' }}>Yes 34¢</span><span style={{ color: '#c0392b' }}>No 66¢</span>
      </div>
    </div>
    <div style={{ background: G.surface2, border: `1px solid ${G.gold}`, borderRadius: 6, padding: 9, marginTop: 2 }}>
      <div style={{ fontSize: 8, color: G.muted, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Sponsored · 1×/week</div>
      <div style={{ fontWeight: 700, fontSize: 10, marginTop: 4 }}>Game day at <YB size={10} /> — $2 off any pour</div>
      <div style={{ fontSize: 9, color: G.muted2, marginTop: 2 }}>Show this in the bar. Code: SH-BEARS</div>
    </div>
  </>);
}

// ─── Section 4: What You Get ──────────────────────────────────────────────────
function WhatYouGet() {
  const cards = [
    { icon: '⚡', title: 'Bot Attribution', body: 'Every team-bot message carries a "powered by" line. One sponsor per team — no competitors in your community. Ever.' },
    { icon: '🛡️', title: 'Team Feed Badge', body: '"Presented by" lockup at the top of your team\'s live feed. Visible to every fan in every session, all season.' },
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

// ─── Section 5: ROI ───────────────────────────────────────────────────────────
function ROISection() {
  return (
    <section className="sh-section" style={{ borderTop: `1px solid ${G.border}` }}>
      <div style={{ border: `1px solid ${G.gold}`, borderRadius: 8, padding: 'clamp(28px, 5vw, 56px)', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,2fr)', gap: 40, alignItems: 'center', background: `rgba(255,215,0,.03)` }}>
        <div>
          <div className="sh-label" style={{ marginBottom: 12 }}>FOUNDING RATE</div>
          <div style={{ fontFamily: FONT_H, fontWeight: 700, fontSize: 'clamp(80px, 11vw, 140px)', color: G.gold, lineHeight: 0.9, letterSpacing: '-0.02em' }}>$250</div>
          <div className="sh-label" style={{ color: G.muted, marginTop: 8 }}>per month · per team</div>
        </div>
        <div>
          <div className="sh-label" style={{ marginBottom: 16 }}>COMPARABLE VALUE</div>
          <p style={{ fontSize: 18, lineHeight: 1.65, color: '#ddd' }}>
            A single local radio spot runs <strong>$500–1,500/week</strong>. One local TV placement: <strong>$2,000–5,000</strong>. A Side Huddle founding sponsorship is <strong style={{ color: G.gold }}>$250/month</strong> — exclusive, always-on, inside the conversation when fans are most engaged.
          </p>
          <p style={{ fontSize: 18, lineHeight: 1.65, color: '#ddd', marginTop: 16 }}>
            Own the entire <strong style={{ color: G.white }}>SEC fanbase</strong> on Side Huddle for less than one radio ad per week.
          </p>
        </div>
      </div>
    </section>
  );
}

// ─── Section 6: Rate Card ─────────────────────────────────────────────────────
function RateCard({ free }: { free: number }) {
  const urgency = [
    { when: 'Start today',   detail: 'June, July & August FREE',   sub: '3 months · first charge Sep 1', active: free >= 3 },
    { when: 'Start in June', detail: 'July & August FREE',         sub: '2 months · first charge Sep 1', active: free === 2 },
    { when: 'Start in July', detail: 'August FREE',                sub: '1 month · first charge Sep 1',  active: free === 1 },
    { when: 'Start Sep 1+',  detail: 'No free months',            sub: 'Season live — charged immediately', active: free === 0 },
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

      {/* Urgency banner */}
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

      {/* DUAL highlight: single team + bundle side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 32 }}>
        <div style={{ border: `1px solid ${G.border}`, borderRadius: 8, padding: 24, background: G.surface }}>
          <div className="sh-label" style={{ color: G.muted }}>SINGLE TEAM</div>
          <div style={{ fontFamily: FONT_H, fontWeight: 700, fontSize: 'clamp(44px,6vw,72px)', color: G.white, lineHeight: 1, marginTop: 8 }}>$250<span style={{ fontSize: 18, color: G.muted, fontWeight: 400 }}>/mo</span></div>
          <div style={{ fontSize: 13, color: G.muted2, marginTop: 6 }}>1 team · $250/team</div>
          <div style={{ marginTop: 14, fontSize: 13, color: '#ccc', lineHeight: 1.5 }}>Own one team completely — exclusive placement, zero competitors in that community.</div>
        </div>
        <div style={{ border: `2px solid ${G.gold}`, borderRadius: 8, padding: 24, background: 'rgba(255,215,0,.04)', position: 'relative' }}>
          <div style={{ position: 'absolute', top: -12, left: 20, background: G.gold, color: '#000', fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 999, letterSpacing: '0.1em' }}>BEST VALUE</div>
          <div className="sh-label" style={{ color: G.gold }}>BUNDLE · 10+ TEAMS</div>
          <div style={{ fontFamily: FONT_H, fontWeight: 700, fontSize: 'clamp(44px,6vw,72px)', color: G.gold, lineHeight: 1, marginTop: 8 }}>$180<span style={{ fontSize: 18, color: G.muted, fontWeight: 400 }}>/team</span></div>
          <div style={{ fontSize: 13, color: G.muted2, marginTop: 6 }}>10+ teams · $1,800/mo total</div>
          <div style={{ marginTop: 14, fontSize: 13, color: '#ccc', lineHeight: 1.5 }}>Own your conference. Own your market. 28% cheaper per team than buying one at a time.</div>
        </div>
      </div>

      <p style={{ color: '#999', marginTop: 24, maxWidth: 720, lineHeight: 1.6, fontSize: 14 }}>Month to month. No annual contract. Pick any teams across any league. Founding rate locked through your first active season.</p>

      <div style={{ overflowX: 'auto', marginTop: 24 }}>
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, minWidth: 680 }}>
          <thead>
            <tr>
              {['Teams', 'Monthly (Founding)', 'Per Team', 'You Save vs. Standard'].map(h => (
                <th key={h} className="sh-label" style={{ padding: '14px 20px', borderBottom: `1px solid ${G.border}`, color: G.muted, textAlign: 'left' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { teams: '1 team',      monthly: '$250 / mo', perTeam: '$250',        savings: 'Up to $500/mo off standard',      highlight: false },
              { teams: '3 teams',     monthly: '$650 / mo', perTeam: '~$217/team',  savings: 'Save ~$100/team vs. 1 at a time', highlight: false },
              { teams: '6 teams',     monthly: '$1,200 / mo',perTeam: '$200/team',  savings: 'Save $50/team vs. 3-pack',        highlight: false },
              { teams: '10+ teams ⭐',monthly: '$1,800 / mo',perTeam: '$180/team · floor', savings: 'Best rate — won\'t go lower', highlight: true },
            ].map(t => (
              <tr key={t.teams} style={{ background: t.highlight ? 'rgba(255,215,0,.06)' : 'transparent' }}>
                <td style={{ padding: '18px 20px', borderBottom: `1px solid ${G.border}`, fontWeight: 700, color: t.highlight ? G.gold : G.white }}>{t.teams}</td>
                <td style={{ padding: '18px 20px', borderBottom: `1px solid ${G.border}`, fontWeight: 700, fontSize: 18 }}>{t.monthly}</td>
                <td style={{ padding: '18px 20px', borderBottom: `1px solid ${G.border}`, color: '#ccc' }}>{t.perTeam}</td>
                <td style={{ padding: '18px 20px', borderBottom: `1px solid ${G.border}`, color: t.highlight ? '#7ec85f' : G.muted2, fontSize: 13 }}>{t.savings}</td>
              </tr>
            ))}
          </tbody>
        </table>
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

// ─── Section 7: Team Picker ───────────────────────────────────────────────────
const LEAGUES: LeagueFilter[] = ['ALL', 'NCAA', 'NFL', 'NBA', 'MLB', 'NHL'];
const LEAGUE_DISPLAY: Record<LeagueFilter, string> = { ALL: 'ALL', NCAA: 'CFB', NFL: 'NFL', NBA: 'NBA', MLB: 'MLB', NHL: 'NHL' };

function TeamPicker({ teams, loading, search, setSearch, league, setLeague, free, onInquire, onBuy }: {
  teams: Team[]; loading: boolean; search: string; setSearch: (s: string) => void;
  league: LeagueFilter; setLeague: (l: LeagueFilter) => void; free: number;
  onInquire: (t: Team) => void; onBuy: (t: Team) => void;
}) {
  return (
    <section className="sh-section" style={{ borderTop: `1px solid ${G.border}` }}>
      <div className="sh-label">05 — CLAIM YOUR TEAM</div>
      <h2 style={{ fontFamily: FONT_H, fontWeight: 700, fontSize: 'clamp(44px,6vw,80px)', lineHeight: 0.95, marginTop: 16, textTransform: 'uppercase' }}>
        First in <span style={{ color: G.gold }}>owns the team.</span>
      </h2>
      <p style={{ color: '#aaa', marginTop: 16, maxWidth: 720, fontSize: 17, lineHeight: 1.6 }}>
        Available teams are open now. Once a team is claimed it's gone.
        {free > 0 && <> Start today — <strong style={{ color: G.gold }}>{freeLabel(free)}</strong>.</>}
      </p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 32, alignItems: 'center' }}>
        {LEAGUES.map(l => (
          <button key={l} onClick={() => setLeague(l)} className="sh-label"
            style={{ padding: '9px 18px', borderRadius: 4, border: `1px solid ${league === l ? G.gold : G.border}`, background: league === l ? 'rgba(255,215,0,.1)' : G.surface, color: league === l ? G.gold : G.muted, cursor: 'pointer' }}>
            {LEAGUE_DISPLAY[l]}
          </button>
        ))}
        <input className="sh-input" placeholder="Search teams…" value={search} onChange={e => setSearch(e.target.value)}
          style={{ marginLeft: 8, maxWidth: 280, height: 40 }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px,1fr))', gap: 12, marginTop: 32 }}>
        {loading && <div style={{ gridColumn: '1/-1', color: G.muted, padding: 48, textAlign: 'center' }}>Loading teams…</div>}
        {!loading && teams.length === 0 && <div style={{ gridColumn: '1/-1', color: G.muted, padding: 48, textAlign: 'center' }}>No teams match your search.</div>}
        {teams.map(t => <TeamCard key={t.id} team={t} onInquire={onInquire} onBuy={onBuy} />)}
      </div>
    </section>
  );
}

function TeamCard({ team, onInquire, onBuy }: { team: Team; onInquire: (t: Team) => void; onBuy: (t: Team) => void }) {
  const taken = team.sponsorStatus === 'confirmed';
  const fullName = team.city ? `${team.city} ${team.name}` : team.name;
  return (
    <div className={`team-card${taken ? ' taken' : ''}`}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {team.logo_url
          ? <img src={team.logo_url} alt={team.name} style={{ width: 40, height: 40, objectFit: 'contain', flexShrink: 0 }} />
          : <div style={{ width: 40, height: 40, borderRadius: '50%', background: G.surface2, border: `1px solid ${G.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>🏆</div>
        }
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>{fullName}</div>
          <span className="sh-label" style={{ fontSize: 9, color: G.muted }}>{displayLeague(team.league)}</span>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 14 }}>
        <span style={{ fontFamily: FONT_H, fontWeight: 700, fontSize: 26, color: G.gold }}>$250</span>
        <span style={{ fontSize: 12, color: G.muted }}>/mo</span>
      </div>
      {taken ? (
        <div className="sh-label" style={{ marginTop: 12, color: G.muted }}>● Claimed</div>
      ) : (
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button className="btn-outline" style={{ flex: 1, padding: '9px 10px', fontSize: 11 }} onClick={e => { e.stopPropagation(); onInquire(team); }}>Inquire →</button>
          <button className="btn-gold"    style={{ flex: 1, padding: '9px 10px', fontSize: 11 }} onClick={e => { e.stopPropagation(); onBuy(team);     }}>Buy now →</button>
        </div>
      )}
    </div>
  );
}

// ─── Inquire Modal ────────────────────────────────────────────────────────────
function InquireModal({ team, free, onClose }: { team: Team; free: number; onClose: () => void }) {
  const [f, setF] = useState({ brand: '', name: '', email: '', phone: '', other: '', message: '' });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const fullName = team.city ? `${team.city} ${team.name}` : team.name;
  async function submit() {
    if (!f.brand || !f.name || !f.email) { toast.error('Brand name, your name, and email are required.'); return; }
    setBusy(true);
    const { error } = await supabase.from('sponsor_inquiries' as any).insert({
      team_id: team.id, team_name: fullName, league: team.league || '', brand_name: f.brand,
      contact_name: f.name, email: f.email, phone: f.phone || null, other_teams: f.other || null,
      message: f.message || null, type: 'inquiry', free_months: free,
    });
    setBusy(false);
    if (error) { toast.error('Could not submit — try partnerships@sidehuddle.com'); return; }
    setDone(true);
  }
  return (
    <Overlay onClose={onClose}>
      {done ? (
        <ModalSuccess title="Got it." body={`We'll confirm your spot for ${fullName} within 24 hours. Your founding rate is locked.`} onClose={onClose} />
      ) : <>
        <ModalHeader logo={team.logo_url} name={fullName} league={displayLeague(team.league)} price="$250 / mo" onClose={onClose} />
        {free > 0 && <FreePill label={freeLabel(free)} />}
        <BundleHint />
        <form style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 20 }} onSubmit={e => { e.preventDefault(); submit(); }}>
          <FF label="Brand / Company *" value={f.brand} onChange={v => setF({ ...f, brand: v })} />
          <FF label="Your name *"       value={f.name}  onChange={v => setF({ ...f, name: v })} />
          <FF label="Email *"           value={f.email} onChange={v => setF({ ...f, email: v })} type="email" />
          <FF label="Phone (optional)"  value={f.phone} onChange={v => setF({ ...f, phone: v })} />
          <FF label="Other teams you want?" value={f.other} onChange={v => setF({ ...f, other: v })} />
          <FF label="Message (optional)"    value={f.message} onChange={v => setF({ ...f, message: v })} multiline />
          <button className="btn-gold" type="submit" style={{ marginTop: 8, width: '100%' }} disabled={busy}>{busy ? 'Sending…' : 'Send inquiry →'}</button>
        </form>
      </>}
    </Overlay>
  );
}

// ─── Buy Modal (with bundle + checkout summary) ───────────────────────────────
function BuyModal({ team, free, allTeams, onClose }: { team: Team; free: number; allTeams: Team[]; onClose: () => void }) {
  const [bundle, setBundle] = useState<Team[]>([team]);
  const [f, setF] = useState({ brand: '', name: '', email: '', phone: '' });
  const [step, setStep] = useState<'build' | 'contact' | 'review' | 'done'>('build');
  const [busy, setBusy] = useState(false);
  const fullName = (t: Team) => t.city ? `${t.city} ${t.name}` : t.name;

  const price = bundlePrice(bundle.length);
  const suggestions = useMemo(() =>
    allTeams.filter(t => t.sponsorStatus !== 'confirmed' && t.league === team.league && t.id !== team.id).slice(0, 9),
    [allTeams, team]
  );

  function toggle(t: Team) {
    setBundle(prev => prev.find(p => p.id === t.id) ? prev.filter(p => p.id !== t.id) : [...prev, t]);
  }

  async function submit() {
    setBusy(true);
    const rows = bundle.map(t => ({
      team_id: t.id, team_name: fullName(t), league: t.league || '',
      brand_name: f.brand, contact_name: f.name, email: f.email,
      phone: f.phone || null, type: 'purchase',
      bundle_size: bundle.length, monthly_total: price.total, free_months: free,
      other_teams: bundle.filter(b => b.id !== t.id).map(b => `${fullName(b)} (${displayLeague(b.league)})`).join(', ') || null,
    }));
    const { error } = await supabase.from('sponsor_inquiries' as any).insert(rows);
    setBusy(false);
    if (error) { toast.error('Could not submit — try partnerships@sidehuddle.com'); return; }
    setStep('done');
  }

  return (
    <Overlay onClose={onClose}>
      {step === 'done' ? (
        <ModalSuccess
          title="Your spot is held."
          body={`We'll send your Stripe payment link within 2 hours. ${bundle.length} team${bundle.length > 1 ? 's' : ''} reserved at $${price.total}/mo${free > 0 ? ` — first charge September 1` : ''}.`}
          onClose={onClose}
        />
      ) : <>
        {/* Progress */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 24 }}>
          {(['build','contact','review'] as const).map((s, i) => (
            <div key={s} style={{ flex: 1, height: 3, borderRadius: 2, background: ['build','contact','review'].indexOf(step) >= i ? G.gold : G.border, transition: 'background .2s' }} />
          ))}
        </div>

        <ModalHeader logo={team.logo_url} name={fullName(team)} league={displayLeague(team.league)} price={`$${price.total} / mo`} onClose={onClose} />
        {free > 0 && <FreePill label={`${freeLabel(free)} — first charge September 1`} />}

        {step === 'build' && <>
          {suggestions.length > 0 && <>
            <div className="sh-label" style={{ marginTop: 20, marginBottom: 10 }}>BUNDLE & SAVE — more teams, better rate</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px,1fr))', gap: 8 }}>
              {suggestions.map(s => {
                const on = !!bundle.find(b => b.id === s.id);
                return (
                  <button key={s.id} onClick={() => toggle(s)}
                    style={{ padding: '10px 12px', borderRadius: 6, border: `1px solid ${on ? G.gold : G.border}`, background: on ? 'rgba(255,215,0,.1)' : G.bg, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
                    {s.logo_url && <img src={s.logo_url} alt="" style={{ width: 24, height: 24, objectFit: 'contain' }} />}
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: on ? G.gold : G.white }}>{on ? '✓ ' : ''}{fullName(s)}</div>
                      <div className="sh-label" style={{ fontSize: 8, color: G.muted }}>{displayLeague(s.league)}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </>}
          <PriceSummary bundle={bundle} price={price} free={free} fullName={fullName} />
          <button className="btn-gold" style={{ marginTop: 20, width: '100%' }} onClick={() => setStep('contact')}>Continue to contact info →</button>
        </>}

        {step === 'contact' && <>
          <form style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 20 }} onSubmit={e => { e.preventDefault(); setStep('review'); }}>
            <FF label="Brand / Company *" value={f.brand} onChange={v => setF({ ...f, brand: v })} />
            <FF label="Your name *"       value={f.name}  onChange={v => setF({ ...f, name: v })} />
            <FF label="Email *"           value={f.email} onChange={v => setF({ ...f, email: v })} type="email" />
            <FF label="Phone (optional)"  value={f.phone} onChange={v => setF({ ...f, phone: v })} />
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button className="btn-outline" type="button" style={{ flex: 1 }} onClick={() => setStep('build')}>← Back</button>
              <button className="btn-gold"    type="submit" style={{ flex: 2 }}
                onClick={() => { if (!f.brand || !f.name || !f.email) toast.error('Brand, name, and email are required.'); }}>
                Review order →
              </button>
            </div>
          </form>
        </>}

        {step === 'review' && <>
          <div style={{ marginTop: 20, background: G.bg, border: `1px solid ${G.border}`, borderRadius: 8, padding: 20 }}>
            <div className="sh-label" style={{ marginBottom: 12 }}>ORDER SUMMARY</div>
            {bundle.map(t => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: `1px solid ${G.border}` }}>
                {t.logo_url && <img src={t.logo_url} alt="" style={{ width: 28, height: 28, objectFit: 'contain' }} />}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{fullName(t)}</div>
                  <div style={{ fontSize: 11, color: G.muted }}>{displayLeague(t.league)}</div>
                </div>
                <div style={{ fontSize: 12, color: G.muted }}>{price.label}</div>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 16 }}>
              <div className="sh-label">TOTAL / MONTH</div>
              <div style={{ fontFamily: FONT_H, fontWeight: 700, fontSize: 32, color: G.gold }}>${price.total}<span style={{ fontSize: 13, color: G.muted, fontWeight: 400 }}>/mo</span></div>
            </div>
            {free > 0 && <div style={{ marginTop: 8, fontSize: 13, color: '#7ec85f' }}>🎁 {freeLabel(free)} — first charge September 1</div>}
          </div>
          <div style={{ marginTop: 16, background: G.surface, border: `1px solid ${G.border}`, borderRadius: 8, padding: 16 }}>
            <div className="sh-label" style={{ marginBottom: 8 }}>CONTACT</div>
            <div style={{ fontSize: 14, color: '#ccc', lineHeight: 1.7 }}>
              <div><strong>Brand:</strong> {f.brand}</div>
              <div><strong>Contact:</strong> {f.name}</div>
              <div><strong>Email:</strong> {f.email}</div>
              {f.phone && <div><strong>Phone:</strong> {f.phone}</div>}
            </div>
          </div>
          <div style={{ marginTop: 16, padding: 14, border: `1px solid ${G.gold}55`, borderRadius: 6, background: 'rgba(255,215,0,.04)', fontSize: 13, color: '#ccc', lineHeight: 1.6 }}>
            <strong style={{ color: G.gold }}>No card charged today.</strong> We'll send a Stripe payment link to your email within 2 hours. Your spot is held as soon as you confirm.
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button className="btn-outline" style={{ flex: 1 }} onClick={() => setStep('contact')}>← Edit</button>
            <button className="btn-gold"    style={{ flex: 2 }} disabled={busy} onClick={submit}>{busy ? 'Holding spot…' : 'Confirm & hold my spot →'}</button>
          </div>
        </>}
      </>}
    </Overlay>
  );
}

function PriceSummary({ bundle, price, free, fullName }: { bundle: Team[]; price: { total: number; label: string }; free: number; fullName: (t: Team) => string }) {
  return (
    <div style={{ marginTop: 20, padding: 16, background: G.bg, border: `1px solid ${G.border}`, borderRadius: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span className="sh-label">{bundle.length} TEAM{bundle.length !== 1 ? 'S' : ''}</span>
        <span style={{ fontFamily: FONT_H, fontWeight: 700, fontSize: 28, color: G.gold }}>${price.total}<span style={{ fontSize: 12, color: G.muted, fontWeight: 400 }}>/mo</span></span>
      </div>
      <div style={{ fontSize: 12, color: G.muted, marginTop: 2 }}>{price.label}</div>
      {bundle.length >= 3 && <div style={{ fontSize: 12, color: '#7ec85f', marginTop: 6 }}>✓ Bundle discount applied</div>}
    </div>
  );
}

// ─── Shared modal pieces ──────────────────────────────────────────────────────
function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onClose]);
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>{children}</div>
    </div>
  );
}
function ModalHeader({ logo, name, league, price, onClose }: { logo?: string | null; name: string; league: string; price: string; onClose: () => void }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {logo && <img src={logo} alt={name} style={{ width: 48, height: 48, objectFit: 'contain', flexShrink: 0 }} />}
        <div>
          <div className="sh-label" style={{ color: G.muted }}>{league}</div>
          <div style={{ fontFamily: FONT_H, fontWeight: 700, fontSize: 22, textTransform: 'uppercase', marginTop: 2 }}>{name}</div>
          <div style={{ fontFamily: FONT_H, fontWeight: 700, fontSize: 20, color: G.gold }}>{price}<span style={{ fontSize: 12, color: G.muted, fontWeight: 400, fontFamily: FONT_B }}> founding rate</span></div>
        </div>
      </div>
      <button onClick={onClose} aria-label="Close" style={{ background: 'transparent', border: 'none', color: G.muted, fontSize: 22, cursor: 'pointer', lineHeight: 1, flexShrink: 0, padding: 4 }}>×</button>
    </div>
  );
}
function FreePill({ label }: { label: string }) {
  return (
    <div style={{ marginTop: 16, padding: '10px 14px', border: `1px solid ${G.gold}`, borderRadius: 6, background: 'rgba(255,215,0,.07)', fontSize: 13, color: G.gold, fontWeight: 600 }}>
      🎁 {label}
    </div>
  );
}
function BundleHint() {
  return (
    <p style={{ color: G.muted2, fontSize: 13, marginTop: 12 }}>
      Want more teams? <span style={{ color: G.white }}>3 = $650/mo · 6 = $1,200/mo · 10+ = $1,800/mo</span>
    </p>
  );
}
function ModalSuccess({ title, body, onClose }: { title: string; body: string; onClose: () => void }) {
  return (
    <div style={{ textAlign: 'center', padding: '16px 0' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🏆</div>
      <div style={{ fontFamily: FONT_H, fontWeight: 700, fontSize: 32, color: G.gold, textTransform: 'uppercase' }}>{title}</div>
      <p style={{ color: '#ccc', marginTop: 14, fontSize: 16, lineHeight: 1.65 }}>{body}</p>
      <button className="btn-gold" style={{ marginTop: 28 }} onClick={onClose}>Close</button>
    </div>
  );
}
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
          <div className="sh-label" style={{ color: G.muted }}>BUNDLE INQUIRIES · 10+ TEAMS</div>
          <a href="mailto:partnerships@sidehuddle.com" style={{ display: 'block', marginTop: 8, color: G.gold, fontWeight: 700, fontSize: 16, textDecoration: 'none' }}>
            partnerships@sidehuddle.com
          </a>
        </div>
      </div>
      <div style={{ borderTop: `1px solid ${G.border}`, padding: '16px 32px', textAlign: 'center', fontSize: 12, color: G.muted }}>
        © {new Date().getFullYear()} Side Huddle Sports · sponsors.sidehuddlesports.com
      </div>
    </footer>
  );
}

// ─── CSS ─────────────────────────────────────────────────────────────────────
const css = `
.sh-section { padding: 96px clamp(24px,6vw,96px); max-width: 1280px; margin: 0 auto; }
.sh-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.2em; font-weight: 700; color: ${G.gold}; font-family: ${FONT_B}; }
.btn-gold { background: ${G.gold}; color: #0a0a0a; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; padding: 14px 28px; border-radius: 4px; cursor: pointer; border: 1.5px solid ${G.gold}; transition: background .15s, border-color .15s; font-family: ${FONT_B}; font-size: 13px; }
.btn-gold:hover { background: #ffe74a; border-color: #ffe74a; }
.btn-gold:disabled { opacity: .6; cursor: not-allowed; }
.btn-outline { background: transparent; color: ${G.white}; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; padding: 14px 28px; border-radius: 4px; cursor: pointer; border: 1.5px solid ${G.border}; transition: border-color .15s, color .15s; font-family: ${FONT_B}; font-size: 13px; }
.btn-outline:hover { border-color: ${G.gold}; color: ${G.gold}; }
.sh-input { background: #080808; border: 1px solid ${G.border}; color: ${G.white}; padding: 11px 14px; border-radius: 4px; width: 100%; font-family: ${FONT_B}; font-size: 14px; outline: none; box-sizing: border-box; }
.sh-input:focus { border-color: ${G.gold}; }
.team-card { background: ${G.surface}; border: 1px solid ${G.border}; border-radius: 8px; padding: 18px; transition: border-color .15s, transform .15s; }
.team-card:hover { border-color: ${G.gold}44; transform: translateY(-2px); }
.team-card.taken { opacity: .3; pointer-events: none; }
.badge-dot { display: flex; align-items: center; gap: 6px; font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase; }
.pulse-dot { animation: pulseDot 2s ease-in-out infinite; }
.pulse-gold { animation: pulseGold 2.5s ease-in-out infinite; }
.bubble-in { animation: bubbleIn .55s ease-out backwards; position: absolute; }
.overlay { position: fixed; inset: 0; background: rgba(0,0,0,.88); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 16px; animation: fadeIn .18s ease-out; overflow-y: auto; }
.modal { background: ${G.surface}; border: 1px solid ${G.gold}55; border-radius: 10px; max-width: 560px; width: 100%; padding: 32px; position: relative; max-height: 90vh; overflow-y: auto; }
@keyframes pulseDot { 0%,100% { opacity: 1; box-shadow: 0 0 0 0 rgba(231,76,60,.4); } 50% { opacity: .7; box-shadow: 0 0 0 4px rgba(231,76,60,.1); } }
@keyframes pulseGold { 0%,100% { opacity: .8; } 50% { opacity: 1; } }
@keyframes bubbleIn { from { opacity: 0; transform: translate(-50%,-50%) scale(.88); } to { opacity: 1; transform: translate(-50%,-50%) scale(1); } }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@media (max-width: 700px) { .sh-section { padding: 64px 20px; } .modal { padding: 22px; } }
`;
