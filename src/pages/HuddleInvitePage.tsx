import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import shLogo from '@/assets/sh-logo-updated.png';

const APP_STORE_URL = '#';
const PLAY_STORE_URL = '#';
const SITE_URL = 'https://sidehuddlesports.com';

interface HuddleMember {
  display_name: string;
  avatar_url?: string;
  points?: number;
  rank?: number;
}

interface HuddleData {
  id: string;
  name: string;
  description?: string;
  member_count: number;
  sport?: string;
  is_private: boolean;
  members: HuddleMember[];
  invite_code?: string;
}

export default function HuddleInvitePage() {
  const { huddleId } = useParams<{ huddleId: string }>();
  const navigate = useNavigate();
  const [huddle, setHuddle] = useState<HuddleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!huddleId) { setNotFound(true); setLoading(false); return; }
    loadHuddle(huddleId);
  }, [huddleId]);

  const loadHuddle = async (id: string) => {
    try {
      // Try to load by invite code first, then by id
      const { data: huddleRow, error } = await supabase
        .from('huddles')
        .select('id, name, description, sport, is_private')
        .or(`id.eq.${id},invite_code.eq.${id}`)
        .single();

      if (error || !huddleRow) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      // Load member count
      const { count } = await supabase
        .from('huddle_members')
        .select('*', { count: 'exact', head: true })
        .eq('huddle_id', huddleRow.id);

      // Load top 5 members for leaderboard preview
      const { data: memberRows } = await supabase
        .from('huddle_members')
        .select('display_name, avatar_url, points')
        .eq('huddle_id', huddleRow.id)
        .order('points', { ascending: false })
        .limit(5);

      const members: HuddleMember[] = (memberRows || []).map((m, i) => ({
        display_name: m.display_name || 'Fan',
        avatar_url: m.avatar_url,
        points: m.points ?? 0,
        rank: i + 1,
      }));

      setHuddle({
        id: huddleRow.id,
        name: huddleRow.name,
        description: huddleRow.description,
        sport: huddleRow.sport,
        is_private: huddleRow.is_private,
        member_count: count ?? 0,
        members,
        invite_code: id,
      });
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  const inviteUrl = `${SITE_URL}/h/${huddleId}`;
  const ogTitle = huddle ? `Join "${huddle.name}" on Side Huddle Sports` : 'Join the Huddle — Side Huddle Sports';
  const ogDesc = huddle
    ? `${huddle.member_count} fans are live chatting${huddle.sport ? ` about ${huddle.sport}` : ''}. Download the app to join.`
    : 'Download Side Huddle Sports and join your crew.';

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-[#FFD700]/30 border-t-[#FFD700] animate-spin" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center px-6 text-center">
        <img src={shLogo} alt="Side Huddle" className="h-12 w-12 mb-6 opacity-40" />
        <h1 className="font-orbitron text-2xl font-bold mb-2 text-[#FFD700]">Huddle not found</h1>
        <p className="text-white/40 text-sm mb-8">This invite link may have expired or been removed.</p>
        <button
          onClick={() => navigate('/')}
          className="bg-[#FFD700] text-black font-semibold px-6 py-3 rounded-xl text-sm hover:bg-yellow-300 transition-colors"
        >
          Back to Side Huddle
        </button>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>{ogTitle}</title>
        <meta name="description" content={ogDesc} />
        {/* Open Graph — iMessage, WhatsApp, Slack */}
        <meta property="og:title" content={ogTitle} />
        <meta property="og:description" content={ogDesc} />
        <meta property="og:url" content={inviteUrl} />
        <meta property="og:type" content="website" />
        <meta property="og:image" content={`${SITE_URL}/og-invite.png`} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        {/* Twitter card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={ogTitle} />
        <meta name="twitter:description" content={ogDesc} />
        <meta name="twitter:image" content={`${SITE_URL}/og-invite.png`} />
        {/* Deep link for app — when app is installed it opens directly */}
        <meta name="apple-itunes-app" content={`app-id=YOURAPPID, app-argument=sidehuddle://huddle/${huddle?.id}`} />
      </Helmet>

      <div className="min-h-screen bg-[#0a0a0a] text-white overflow-x-hidden">

        {/* Nav */}
        <nav className="flex items-center justify-between px-6 py-4 max-w-2xl mx-auto">
          <div className="flex items-center gap-2">
            <img src={shLogo} alt="Side Huddle Sports" className="h-7 w-7 object-contain" />
            <span className="font-orbitron font-bold text-sm text-[#FFD700] tracking-wide">SIDE HUDDLE</span>
          </div>
        </nav>

        {/* Hero invite card */}
        <div className="max-w-lg mx-auto px-6 pt-8 pb-4">

          {/* Invite badge */}
          <div className="flex justify-center mb-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#FFD700]/30 bg-[#FFD700]/10 px-4 py-1.5">
              <span className="text-lg">👋</span>
              <span className="text-xs font-medium text-[#FFD700] tracking-widest uppercase">
                You've been invited
              </span>
            </div>
          </div>

          {/* Huddle card */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 mb-6">
            <div className="flex items-start gap-4 mb-5">
              {/* Huddle avatar — initials fallback */}
              <div className="flex-shrink-0 h-14 w-14 rounded-2xl bg-[#FFD700]/20 border border-[#FFD700]/30 flex items-center justify-center">
                <span className="font-orbitron text-lg font-bold text-[#FFD700]">
                  {huddle!.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="font-orbitron text-xl font-bold text-white leading-tight truncate">
                  {huddle!.name}
                </h1>
                {huddle!.description && (
                  <p className="text-white/50 text-sm mt-1 leading-relaxed line-clamp-2">
                    {huddle!.description}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-2">
                  {huddle!.sport && (
                    <span className="text-xs text-[#FFD700]/80 border border-[#FFD700]/20 bg-[#FFD700]/10 rounded-full px-2.5 py-0.5">
                      {huddle!.sport}
                    </span>
                  )}
                  <span className="text-xs text-white/40">
                    {huddle!.is_private ? '🔒 Private' : '🌐 Public'} · {huddle!.member_count} member{huddle!.member_count !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            </div>

            {/* Leaderboard preview */}
            {huddle!.members.length > 0 && (
              <div>
                <p className="text-xs text-white/30 uppercase tracking-widest font-medium mb-3">
                  🏆 Top Pickers
                </p>
                <div className="flex flex-col gap-2">
                  {huddle!.members.map((m) => (
                    <div key={m.rank} className="flex items-center gap-3">
                      {/* Rank */}
                      <span className={`w-5 text-xs font-bold text-center ${
                        m.rank === 1 ? 'text-[#FFD700]' :
                        m.rank === 2 ? 'text-white/60' :
                        m.rank === 3 ? 'text-amber-600' : 'text-white/30'
                      }`}>
                        {m.rank === 1 ? '🥇' : m.rank === 2 ? '🥈' : m.rank === 3 ? '🥉' : `#${m.rank}`}
                      </span>
                      {/* Avatar */}
                      <div className="h-7 w-7 rounded-full bg-white/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {m.avatar_url ? (
                          <img src={m.avatar_url} alt={m.display_name} className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-[10px] font-bold text-white/60">
                            {m.display_name.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      {/* Name */}
                      <span className="flex-1 text-sm text-white/80 truncate">{m.display_name}</span>
                      {/* Points */}
                      <span className="text-xs font-semibold text-[#FFD700]">{(m.points ?? 0).toLocaleString()} pts</span>
                    </div>
                  ))}
                </div>
                {huddle!.member_count > 5 && (
                  <p className="text-xs text-white/30 mt-3 text-center">
                    +{huddle!.member_count - 5} more members
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Download CTAs */}
          <div className="flex flex-col gap-3">
            <p className="text-center text-sm text-white/50 mb-1">
              Download the app to join this huddle
            </p>
            <a
              href={APP_STORE_URL}
              onClick={APP_STORE_URL === '#' ? e => e.preventDefault() : undefined}
              className={`flex items-center justify-center gap-3 rounded-2xl py-4 font-semibold text-base transition-all
                ${APP_STORE_URL === '#'
                  ? 'bg-white/5 border border-white/10 text-white/40 cursor-not-allowed'
                  : 'bg-[#FFD700] text-black hover:bg-yellow-300'
                }`}
            >
              <AppleIcon />
              <span>Download on the App Store</span>
              {APP_STORE_URL === '#' && <span className="text-xs bg-[#FFD700]/20 text-[#FFD700] px-2 py-0.5 rounded-full ml-1">Soon</span>}
            </a>
            <a
              href={PLAY_STORE_URL}
              onClick={PLAY_STORE_URL === '#' ? e => e.preventDefault() : undefined}
              className={`flex items-center justify-center gap-3 rounded-2xl py-4 font-semibold text-base border transition-all
                ${PLAY_STORE_URL === '#'
                  ? 'border-white/10 bg-white/[0.03] text-white/40 cursor-not-allowed'
                  : 'border-[#FFD700]/40 bg-[#FFD700]/10 text-[#FFD700] hover:bg-[#FFD700]/20'
                }`}
            >
              <PlayIcon />
              <span>Get it on Google Play</span>
              {PLAY_STORE_URL === '#' && <span className="text-xs bg-[#FFD700]/20 text-[#FFD700] px-2 py-0.5 rounded-full ml-1">Soon</span>}
            </a>
          </div>

          {/* Share this invite */}
          <div className="mt-6 p-4 rounded-xl border border-white/5 bg-white/[0.02]">
            <p className="text-xs text-white/30 text-center mb-3">Share this invite</p>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={inviteUrl}
                className="flex-1 bg-transparent text-xs text-white/40 border border-white/10 rounded-lg px-3 py-2 focus:outline-none truncate"
              />
              <button
                onClick={() => { navigator.clipboard.writeText(inviteUrl); }}
                className="flex-shrink-0 bg-[#FFD700]/10 border border-[#FFD700]/20 text-[#FFD700] text-xs font-semibold px-3 py-2 rounded-lg hover:bg-[#FFD700]/20 transition-colors"
              >
                Copy
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-12 border-t border-white/5 px-6 py-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <img src={shLogo} alt="Side Huddle" className="h-4 w-4 object-contain opacity-40" />
            <span className="text-xs text-white/20 font-orbitron">SIDE HUDDLE SPORTS</span>
          </div>
          <div className="flex items-center justify-center gap-4 text-xs text-white/20">
            <a href="/" className="hover:text-white/40 transition-colors">Home</a>
            <a href="#" className="hover:text-white/40 transition-colors">Privacy</a>
            <a href="#" className="hover:text-white/40 transition-colors">Terms</a>
          </div>
        </footer>
      </div>
    </>
  );
}

function AppleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M3.18 23.5a2 2 0 0 1-.98-.27 2 2 0 0 1-1-1.73V2.5a2 2 0 0 1 1-1.73 2 2 0 0 1 2 0l18 10a2 2 0 0 1 0 3.46l-18 10a2 2 0 0 1-1.02.27z" />
    </svg>
  );
}
