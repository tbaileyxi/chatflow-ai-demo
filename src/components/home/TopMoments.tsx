import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, MessageSquare, Twitter, Globe, Bot } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

// State-change keywords for ranking
const STATE_CHANGE_KEYWORDS = [
  'OUT', 'IN', 'QUESTIONABLE', 'DOUBTFUL', 'CONFIRMED', 'FINAL', 
  'TRADE', 'SIGNED', 'STARTING', 'RULED', 'SUSPENDED', 'ANNOUNCED',
  'BREAKING', 'INJURY', 'UPDATE', 'REPORT'
];

interface TopMoment {
  id: string;
  content: string;
  created_at: string;
  huddle_id: string;
  huddle_name: string;
  team_logo_url: string | null;
  source: 'bot' | 'x' | 'reddit' | 'user' | 'coach';
  is_bot_message: boolean;
  score: number;
  isCoachFallback?: boolean;
}

interface RawMessage {
  id: string;
  content: string;
  created_at: string;
  huddle_id: string;
  is_bot_message: boolean | null;
  pulse_source: string | null;
  huddles: {
    id: string;
    name: string;
    is_private: boolean | null;
    is_official_team_huddle: boolean | null;
    teams: {
      name: string;
      logo_url: string | null;
    } | null;
  } | null;
}

// Calculate importance score for a message
function calculateScore(msg: RawMessage): number {
  let score = 0;
  const content = msg.content?.toUpperCase() || '';
  const createdAt = new Date(msg.created_at);
  const now = new Date();
  const minutesAgo = (now.getTime() - createdAt.getTime()) / (1000 * 60);

  // Pool A: Sourced messages (best)
  if (msg.pulse_source === 'x' || msg.pulse_source === 'reddit') {
    score += 5;
  }

  // Contains URL
  if (msg.content?.includes('http://') || msg.content?.includes('https://')) {
    score += 4;
  }

  // Contains state-change keyword
  const hasStateChange = STATE_CHANGE_KEYWORDS.some(kw => content.includes(kw));
  if (hasStateChange) {
    score += 4;
  }

  // Bot message
  if (msg.is_bot_message) {
    score += 3;
  }

  // Freshness bonus
  if (minutesAgo < 30) {
    score += 2;
  } else if (minutesAgo < 120) {
    score += 1;
  }

  return score;
}

// Generate Coach fallback cards
function generateCoachCards(
  huddles: { id: string; name: string; logo_url: string | null }[],
  existingCount: number
): TopMoment[] {
  const needed = 3 - existingCount;
  if (needed <= 0 || huddles.length === 0) return [];

  const coachPrompts = [
    (team: string) => `Coach: 3 things to know today for ${team} fans...`,
    (team: string) => `Coach: The debate ${team} fans can't stop having...`,
    (team: string) => `Coach: Here's what's trending in ${team} nation...`,
  ];

  const cards: TopMoment[] = [];
  for (let i = 0; i < needed && i < huddles.length; i++) {
    const huddle = huddles[i % huddles.length];
    const promptFn = coachPrompts[i % coachPrompts.length];
    cards.push({
      id: `coach-${huddle.id}-${i}`,
      content: promptFn(huddle.name),
      created_at: new Date().toISOString(),
      huddle_id: huddle.id,
      huddle_name: huddle.name,
      team_logo_url: huddle.logo_url,
      source: 'coach',
      is_bot_message: true,
      score: 0,
      isCoachFallback: true,
    });
  }
  return cards;
}

export const TopMoments = () => {
  const navigate = useNavigate();
  const [moments, setMoments] = useState<TopMoment[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeHuddles, setActiveHuddles] = useState<{ id: string; name: string; logo_url: string | null }[]>([]);

  const fetchTopMoments = useCallback(async () => {
    try {
      const isDev = import.meta.env.DEV;
      
      // Step 1: First fetch official public huddle IDs
      const { data: officialHuddles, error: huddlesError } = await supabase
        .from('huddles')
        .select('id, name, is_private, is_official_team_huddle, teams!team_id(name, logo_url)')
        .eq('is_official_team_huddle', true)
        .eq('is_private', false)
        .limit(50);

      if (huddlesError) {
        if (isDev) console.error('[TopMoments] Huddles query error:', huddlesError);
        throw huddlesError;
      }

      const officialHuddleIds = (officialHuddles || []).map(h => h.id);
      if (isDev) console.log('[TopMoments] Found official huddles:', officialHuddleIds.length);

      if (officialHuddleIds.length === 0) {
        if (isDev) console.log('[TopMoments] No official huddles found');
        setLoading(false);
        return;
      }

      // Step 2: Fetch recent messages from these huddles
      const { data: messages, error } = await supabase
        .from('huddle_messages')
        .select('id, content, created_at, huddle_id, is_bot_message, pulse_source')
        .in('huddle_id', officialHuddleIds)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        if (isDev) console.error('[TopMoments] Messages query error:', error);
        throw error;
      }

      // Build a map of huddle data for enrichment
      const huddleMap = new Map(officialHuddles.map(h => [h.id, h]));
      
      // Transform messages to include huddle data
      const rawMessages: RawMessage[] = (messages || []).map(msg => {
        const huddle = huddleMap.get(msg.huddle_id);
        return {
          ...msg,
          huddles: huddle ? {
            id: huddle.id,
            name: huddle.name,
            is_private: huddle.is_private,
            is_official_team_huddle: huddle.is_official_team_huddle,
            teams: huddle.teams
          } : null
        };
      });

      if (isDev) console.log('[TopMoments] Fetched messages:', rawMessages.length);

      // rawMessages already defined above

      // Build candidate pools
      const poolA: RawMessage[] = []; // Sourced (X, Reddit, URL)
      const poolB: RawMessage[] = []; // State-change bot messages
      const poolC: RawMessage[] = []; // Recent bot messages (last 24h)

      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      rawMessages.forEach(msg => {
        const content = msg.content?.toUpperCase() || '';
        const hasSource = msg.pulse_source === 'x' || msg.pulse_source === 'reddit' || 
                          msg.content?.includes('http://') || msg.content?.includes('https://');
        const hasStateChange = STATE_CHANGE_KEYWORDS.some(kw => content.includes(kw));
        const isRecent = new Date(msg.created_at) > twentyFourHoursAgo;

        if (hasSource) {
          poolA.push(msg);
        } else if (msg.is_bot_message && hasStateChange) {
          poolB.push(msg);
        } else if (msg.is_bot_message && isRecent) {
          poolC.push(msg);
        }
      });

      if (isDev) {
        console.log('[TopMoments] Pool A (sourced):', poolA.length);
        console.log('[TopMoments] Pool B (state-change):', poolB.length);
        console.log('[TopMoments] Pool C (recent bot):', poolC.length);
      }

      // Combine and deduplicate by huddle_id
      const allCandidates = [...poolA, ...poolB, ...poolC];
      const scored = allCandidates.map(msg => ({
        msg,
        score: calculateScore(msg),
      }));

      // Sort by score desc, then by created_at desc
      scored.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return new Date(b.msg.created_at).getTime() - new Date(a.msg.created_at).getTime();
      });

      // Deduplicate: max 1 per huddle
      const seenHuddles = new Set<string>();
      const deduplicated: typeof scored = [];
      for (const item of scored) {
        if (!seenHuddles.has(item.msg.huddle_id)) {
          seenHuddles.add(item.msg.huddle_id);
          deduplicated.push(item);
        }
        if (deduplicated.length >= 6) break; // Get up to 6 for rotation buffer
      }

      // Transform to TopMoment format
      const realMoments: TopMoment[] = deduplicated.map(({ msg, score }) => {
        let source: TopMoment['source'] = 'bot';
        if (msg.pulse_source === 'x') source = 'x';
        else if (msg.pulse_source === 'reddit') source = 'reddit';
        else if (!msg.is_bot_message) source = 'user';

        return {
          id: msg.id,
          content: msg.content,
          created_at: msg.created_at,
          huddle_id: msg.huddle_id,
          huddle_name: msg.huddles?.teams?.name || msg.huddles?.name || 'Huddle',
          team_logo_url: msg.huddles?.teams?.logo_url || null,
          source,
          is_bot_message: msg.is_bot_message || false,
          score,
        };
      });

      if (isDev) console.log('[TopMoments] Real moments:', realMoments.length);

      // Use existing huddleMap from above - convert for activeHuddles state
      const activeHuddlesList = Array.from(huddleMap.values()).slice(0, 5).map(h => ({
        id: h.id,
        name: h.teams?.name || h.name,
        logo_url: h.teams?.logo_url || null,
      }));
      setActiveHuddles(activeHuddlesList);

      // If we have fewer than 3, add Coach fallback cards
      let finalMoments = [...realMoments];
      if (finalMoments.length < 3) {
        // Get huddles not already in moments
        const usedHuddleIds = new Set(finalMoments.map(m => m.huddle_id));
        const huddlesForFallback = activeHuddlesList.filter(h => !usedHuddleIds.has(h.id));
        
        // If still not enough available, reuse existing
        const huddlesToUse = huddlesForFallback.length > 0 ? huddlesForFallback : activeHuddlesList;
        const coachCards = generateCoachCards(huddlesToUse, finalMoments.length);
        finalMoments = [...finalMoments, ...coachCards];
        
        if (isDev) console.log('[TopMoments] Added Coach fallback cards:', coachCards.length);
      }

      if (isDev) console.log('[TopMoments] Final moment count:', finalMoments.length, 'sources:', finalMoments.map(m => m.source));

      setMoments(finalMoments.slice(0, 6)); // Keep up to 6 for rotation
      setActiveIndex(0); // Reset to show newest first
    } catch (error) {
      console.error('[TopMoments] Error fetching:', error);
      
      // Even on error, try to show Coach fallback cards if we have huddle data
      if (activeHuddles.length > 0) {
        const coachCards = generateCoachCards(activeHuddles, 0);
        setMoments(coachCards);
      }
    } finally {
      setLoading(false);
    }
  }, [activeHuddles]);

  useEffect(() => {
    fetchTopMoments();
    // Refresh every 2 minutes
    const interval = setInterval(() => {
      fetchTopMoments();
    }, 120000);
    return () => clearInterval(interval);
  }, []);

  // Auto-rotate every 7 seconds
  useEffect(() => {
    if (moments.length <= 1) return;
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % Math.min(moments.length, 3));
    }, 7000);
    return () => clearInterval(interval);
  }, [moments.length]);

  const handleMomentClick = (moment: TopMoment) => {
    if (moment.isCoachFallback) {
      // Coach cards navigate to huddle without scrollTo
      navigate(`/huddle/${moment.huddle_id}`);
    } else {
      // Real messages scroll to the specific message
      navigate(`/huddle/${moment.huddle_id}?scrollTo=${moment.id}`);
    }
  };

  const getSourceIcon = (source: TopMoment['source']) => {
    switch (source) {
      case 'x':
        return <Twitter className="h-3 w-3" />;
      case 'reddit':
        return <Globe className="h-3 w-3" />;
      case 'coach':
        return <Bot className="h-3 w-3" />;
      default:
        return <MessageSquare className="h-3 w-3" />;
    }
  };

  const getSourceLabel = (source: TopMoment['source']) => {
    switch (source) {
      case 'x':
        return 'X';
      case 'reddit':
        return 'Reddit';
      case 'coach':
        return 'Coach';
      case 'bot':
        return 'Bot';
      default:
        return 'Fan';
    }
  };

  // Always show 3 skeleton cards while loading
  if (loading) {
    return (
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold">Top Moments</h2>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      </section>
    );
  }

  // Show exactly 3 cards (guaranteed by Coach fallback)
  const visibleMoments = moments.slice(0, 3);

  // If still somehow empty after all fallbacks (edge case), show minimal state
  if (visibleMoments.length === 0) {
    return (
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold">Top Moments</h2>
        </div>
        <div className="text-center text-muted-foreground py-6">
          Loading the latest moments...
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-bold">Top Moments</h2>
      </div>

      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {visibleMoments.map((moment, index) => (
            <motion.button
              key={moment.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ 
                opacity: 1, 
                y: 0,
                scale: index === activeIndex ? 1 : 0.98
              }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              onClick={() => handleMomentClick(moment)}
              className={cn(
                "w-full text-left rounded-xl p-4 border transition-all",
                index === activeIndex 
                  ? "bg-primary/10 border-primary/30 shadow-lg" 
                  : "bg-card border-border/50 hover:border-primary/30"
              )}
            >
              <div className="flex gap-3">
                {/* Team Avatar */}
                <Avatar className="h-10 w-10 ring-2 ring-border/30 flex-shrink-0">
                  <AvatarImage src={moment.team_logo_url || undefined} alt={moment.huddle_name} />
                  <AvatarFallback className="text-xs bg-muted">
                    {moment.huddle_name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0 space-y-1">
                  {/* Header: Team + Source + Time */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm truncate">{moment.huddle_name}</span>
                    <Badge 
                      variant="secondary" 
                      className={cn(
                        "h-5 px-1.5 text-[10px] gap-1",
                        moment.source === 'coach' && "bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-600 dark:text-cyan-400"
                      )}
                    >
                      {getSourceIcon(moment.source)}
                      {getSourceLabel(moment.source)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(moment.created_at), { addSuffix: true })}
                    </span>
                  </div>

                  {/* Message Preview - chat bubble style */}
                  <div className={cn(
                    "rounded-lg px-3 py-2 text-sm",
                    (moment.is_bot_message || moment.source === 'coach')
                      ? "bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-foreground" 
                      : "bg-muted/50 text-foreground"
                  )}>
                    <p className="line-clamp-2">{moment.content}</p>
                  </div>
                </div>
              </div>
            </motion.button>
          ))}
        </AnimatePresence>
      </div>

      {/* Rotation indicators */}
      <div className="flex justify-center gap-1.5 pt-1">
        {visibleMoments.map((_, index) => (
          <button
            key={index}
            onClick={() => setActiveIndex(index)}
            className={cn(
              "h-1.5 rounded-full transition-all",
              index === activeIndex 
                ? "w-4 bg-primary" 
                : "w-1.5 bg-muted-foreground/30"
            )}
          />
        ))}
      </div>
    </section>
  );
};
