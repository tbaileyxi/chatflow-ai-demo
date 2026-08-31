import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import shLogo from '@/assets/sh-logo-updated.png';
import { APP_STORE_URL, appStoreUrl, STORE_CAMPAIGN } from '@/lib/appStore';

const SITE_URL = 'https://sidehuddlesports.com';

interface PickData {
  id: string;
  question: string;
  position: string;
  chips_risked: number;
  chips_won: number | null;
  is_settled: boolean;
  won: boolean | null;
  placed_at: string;
  display_name: string;
  username: string | null;
  avatar_url: string | null;
  huddle_id: string | null;
}

export default function PickSharePage() {
  const { betId } = useParams<{ betId: string }>();
  const navigate = useNavigate();
  const [pick, setPick] = useState<PickData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!betId) { setNotFound(true); setLoading(false); return; }
    loadPick(betId);
  }, [betId]);

  const loadPick = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('shadow_bets')
        .select(`
          id, position, chips_risked, chips_won, is_settled, won, placed_at, user_id,
          kalshi_markets (question)
        `)
        .eq('id', id)
        .single();

      if (error || !data) { setNotFound(true); setLoading(false); return; }

      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name, username, avatar_url')
        .eq('user_id', (data as any).user_id)
        .single();

      const { data: huddleMember } = await supabase
        .from('huddle_members')
        .select('huddle_id')
        .eq('user_id', (data as any).user_id)
        .limit(1)
        .single();

      setPick({
        id: data.id,
        question: (data as any).kalshi_markets?.question ?? 'Unknown prediction',
        position: data.position,
        chips_risked: data.chips_risked,
        chips_won: data.chips_won,
        is_settled: data.is_settled ?? false,
        won: data.won,
        placed_at: data.placed_at ?? new Date().toISOString(),
        display_name: profile?.display_name ?? profile?.username ?? 'A Fan',
        username: profile?.username ?? null,
        avatar_url: profile?.avatar_url ?? null,
        huddle_id: huddleMember?.huddle_id ?? null,
      });
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  const pickUrl = `${SITE_URL}/picks/${betId}`;
  const resultText = pick?.is_settled
    ? pick.won ? `Won ${pick.chips_won?.toLocaleString()} chips` : 'Lost'
    : `${pick?.chips_risked?.toLocaleString()} chips on ${pick?.position}`;

  const ogTitle = pick
    ? `${pick.display_name} picked: ${pick.position}`
    : 'Side Huddle Sports — Prediction';
  const ogDesc = pick
    ? `"${pick.question}" — ${resultText}. Can you beat them?`
    : 'Make your predictions on Side Huddle Sports.';

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
        <img src={shLogo} alt="Side Huddle" className="h-12 w-12 rounded-full mb-6 opacity-40" />
        <h1 className="font-orbitron text-2xl font-bold mb-2 text-[#FFD700]">Pick not found</h1>
        <p className="text-white/40 text-sm mb-8">This prediction may have been removed.</p>
        <button onClick={() => navigate('/')}
          className="bg-[#FFD700] text-black font-semibold px-6 py-3 rounded-xl text-sm">
          Back to Side Huddle
        </button>
      </div>
    );
  }

  const isWin = pick!.is_settled && pick!.won;
  const isLoss = pick!.is_settled && pick!.won === false;
  const isPending = !pick!.is_settled;

  return (
    <>
      <Helmet>
        <title>{ogTitle}</title>
        <meta name="description" content={ogDesc} />
        <meta property="og:title" content={ogTitle} />
        <meta property="og:description" content={ogDesc} />
        <meta property="og:url" content={pickUrl} />
        <meta property="og:type" content="website" />
        <meta property="og:image" content={`${SITE_URL}/og-pick.svg`} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={ogTitle} />
        <meta name="twitter:description" content={ogDesc} />
        <meta name="twitter:image" content={`${SITE_URL}/og-pick.svg`} />
      </Helmet>

      <div className="min-h-screen bg-[#0a0a0a] text-white overflow-x-hidden">

        {/* Nav */}
        <nav className="flex items-center justify-between px-6 py-4 max-w-lg mx-auto">
          <div className="flex items-center gap-2">
            <img src={shLogo} alt="Side Huddle Sports" className="h-7 w-7 rounded-full object-contain" />
            <span className="font-orbitron font-bold text-sm text-[#FFD700] tracking-wide">SIDE HUDDLE</span>
          </div>
        </nav>

        <div className="max-w-lg mx-auto px-6 pt-6 pb-12">

          {/* The Card */}
          <div className={`relative rounded-3xl border overflow-hidden mb-6 ${
            isWin ? 'border-emerald-500/30' :
            isLoss ? 'border-red-500/20' :
            'border-[#FFD700]/20'
          }`}>

            {/* Card gradient background */}
            <div className={`absolute inset-0 ${
              isWin ? 'bg-gradient-to-br from-emerald-500/10 to-[#0a0a0a]' :
              isLoss ? 'bg-gradient-to-br from-red-500/5 to-[#0a0a0a]' :
              'bg-gradient-to-br from-[#FFD700]/8 to-[#0a0a0a]'
            }`} />

            <div className="relative p-6">

              {/* Result badge */}
              {isWin && (
                <div className="inline-flex items-center gap-1.5 mb-4 bg-emerald-500/20 border border-emerald-500/30 rounded-full px-3 py-1">
                  <span className="text-emerald-400 text-xs font-bold uppercase tracking-widest">🏆 Called it!</span>
                </div>
              )}
              {isLoss && (
                <div className="inline-flex items-center gap-1.5 mb-4 bg-red-500/10 border border-red-500/20 rounded-full px-3 py-1">
                  <span className="text-red-400 text-xs font-bold uppercase tracking-widest">Miss</span>
                </div>
              )}
              {isPending && (
                <div className="inline-flex items-center gap-2 mb-4 bg-[#FFD700]/10 border border-[#FFD700]/20 rounded-full px-3 py-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#FFD700] animate-pulse" />
                  <span className="text-[#FFD700] text-xs font-bold uppercase tracking-widest">Live Pick</span>
                </div>
              )}

              {/* User */}
              <div className="flex items-center gap-3 mb-5">
                <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {pick!.avatar_url ? (
                    <img src={pick!.avatar_url} alt={pick!.display_name} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-sm font-bold text-white/60">
                      {pick!.display_name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div>
                  <div className="font-semibold text-white text-sm">{pick!.display_name}</div>
                  {pick!.username && <div className="text-xs text-white/40">@{pick!.username}</div>}
                </div>
              </div>

              {/* Question */}
              <p className="text-white/50 text-sm mb-3 leading-relaxed">
                {pick!.question}
              </p>

              {/* Big position */}
              <div className={`text-3xl font-orbitron font-extrabold mb-4 ${
                isWin ? 'text-emerald-400' : isLoss ? 'text-red-400' : 'text-[#FFD700]'
              }`}>
                {pick!.position.toUpperCase()}
              </div>

              {/* Chips row */}
              <div className="flex items-center gap-4">
                <div className="flex flex-col">
                  <span className="text-[10px] text-white/30 uppercase tracking-wider">Risked</span>
                  <span className="text-sm font-bold text-white">{pick!.chips_risked.toLocaleString()} chips</span>
                </div>
                {pick!.is_settled && pick!.chips_won != null && (
                  <>
                    <span className="text-white/20">→</span>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-white/30 uppercase tracking-wider">
                        {isWin ? 'Won' : 'Lost'}
                      </span>
                      <span className={`text-sm font-bold ${isWin ? 'text-emerald-400' : 'text-red-400'}`}>
                        {isWin ? '+' : ''}{pick!.chips_won.toLocaleString()} chips
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Branding strip */}
              <div className="mt-5 pt-4 border-t border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <img src={shLogo} alt="" className="h-4 w-4 rounded-full opacity-40" />
                  <span className="text-[10px] text-white/20 font-orbitron tracking-wider">SIDE HUDDLE SPORTS</span>
                </div>
                <span className="text-[10px] text-white/20">
                  {new Date(pick!.placed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              </div>
            </div>
          </div>

          {/* Challenge CTA */}
          <div className="text-center mb-6">
            <p className="text-sm text-white/50 mb-1">
              {isWin ? 'Think you can match that? 👀' : isPending ? 'Think you know better?' : 'Do you agree?'}
            </p>
            <p className="text-xs text-white/30">Download Side Huddle Sports to make your pick</p>
          </div>

          {/* Download buttons */}
          <div className="flex flex-col gap-3">
            <a href={appStoreUrl(STORE_CAMPAIGN.pickShare)}
              onClick={APP_STORE_URL === '#' ? e => e.preventDefault() : undefined}
              className={`flex items-center justify-center gap-3 rounded-2xl py-4 font-semibold text-base transition-all
                ${APP_STORE_URL === '#'
                  ? 'bg-white/5 border border-white/10 text-white/40 cursor-not-allowed'
                  : 'bg-[#FFD700] text-black hover:bg-yellow-300'}`}>
              <AppleIcon />
              <span>Download on the App Store</span>
              {APP_STORE_URL === '#' && <span className="text-xs bg-[#FFD700]/20 text-[#FFD700] px-2 py-0.5 rounded-full ml-1">Soon</span>}
            </a>
            
          </div>

          {/* Share link copy */}
          {pick!.huddle_id && (
            <div className="mt-4 text-center">
              <a href={`/h/${pick!.huddle_id}`} className="text-xs text-[#FFD700]/60 hover:text-[#FFD700] transition-colors">
                Join their huddle →
              </a>
            </div>
          )}
        </div>
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

