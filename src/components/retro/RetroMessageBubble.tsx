import React, { memo, useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { formatDistanceToNow } from 'date-fns';
import { Megaphone, Copy, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { XPostEmbed } from '@/components/embeds/XPostEmbed';
import { isXEmbed } from '@/utils/embedUtils';
import { MediaViewer } from '@/components/MediaViewer';
import DOMPurify from 'dompurify';
import { FoundingBadge, FoundingCheckmark } from '@/components/founding';

interface RetroMessageBubbleProps {
  message: {
    id: string;
    content: string;
    created_at: string;
    user_id: string;
    is_bot_message?: boolean;
    is_team_agent_message?: boolean;
    origin_team_id?: string;
  origin_teams?: {
      id: string;
      name: string;
      city?: string;
      logo_url?: string;
      sponsor?: string;
      sponsor_url?: string;
    };
    media_url?: string;
    media_type?: string;
    embed_code?: string;
    message_type?: string;
    poll_data?: {
      question: string;
      options: Array<{
        text: string;
        votes: number;
      }>;
    };
    embeds?: Array<{
      commentary: string;
      embed_code: string;
      embed_type: 'x' | 'iframe' | 'youtube';
    }>;
    reply_to_id?: string;
  };
  user: {
    id: string;
    display_name: string;
    avatar_url?: string;
    username?: string;
    is_founding_member?: boolean;
    founding_tier?: 'charter' | 'founding' | null;
  } | null;
  currentUserId?: string;
  isAdmin?: boolean;
  isGrouped?: boolean;
  onMegaphone?: (messageId: string) => void;
  onHighlight?: (messageId: string) => void;
  onCopyCallout?: (messageId: string, content: string) => void;
  onReply?: (message: any) => void;
  onPollVote?: (messageId: string, optionIndex: number) => void;
  onOpenFades?: () => void;
  replies?: any[];
  className?: string;
}

// Simplified reactions - only 3 static emojis for mobile-first
const SIMPLE_REACTIONS = ['👍', '❤️', '😂'];

export const RetroMessageBubble = memo<RetroMessageBubbleProps>(({
  message,
  user,
  currentUserId,
  isAdmin = false,
  isGrouped = false,
  onMegaphone,
  onHighlight,
  onCopyCallout,
  onReply,
  onPollVote,
  onOpenFades,
  replies = [],
  className
}) => {
  const { user: currentUser } = useAuth();
  const [showActions, setShowActions] = useState(false);
  const [broadcastPopoverOpen, setBroadcastPopoverOpen] = useState(false);
  const [reactions, setReactions] = useState<{ emoji: string; count: number }[]>([]);
  const [showReactions, setShowReactions] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const [heatCount, setHeatCount] = useState(0);
  const [hasGivenHeat, setHasGivenHeat] = useState(false);
  const [isGivingHeat, setIsGivingHeat] = useState(false);
  const [socialBuzzVideoFailed, setSocialBuzzVideoFailed] = useState(false);
  const { toast } = useToast();
  
  // Poll voting state
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [userVote, setUserVote] = useState<number | null>(null);
  const [isVoting, setIsVoting] = useState(false);
  const [voteCounts, setVoteCounts] = useState<Map<number, number>>(new Map());
  
  // Fetch existing poll votes for this message
  useEffect(() => {
    if (!message.poll_data || !currentUser) return;
    
    const fetchPollVotes = async () => {
      // Get current user's vote
      const { data: userVoteData } = await supabase
        .from('poll_votes')
        .select('option_id')
        .eq('message_id', message.id)
        .eq('user_id', currentUser.id)
        .maybeSingle();
      
      if (userVoteData) {
        setUserVote(userVoteData.option_id);
      }
      
      // Get all vote counts
      const { data: allVotes } = await supabase
        .from('poll_votes')
        .select('option_id')
        .eq('message_id', message.id);
      
      if (allVotes) {
        const counts = new Map<number, number>();
        allVotes.forEach(v => {
          counts.set(v.option_id, (counts.get(v.option_id) || 0) + 1);
        });
        setVoteCounts(counts);
      }
    };
    
    fetchPollVotes();
    
    // Subscribe to poll vote changes
    const channel = supabase
      .channel(`poll-votes-${message.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'poll_votes',
          filter: `message_id=eq.${message.id}`
        },
        () => {
          fetchPollVotes();
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [message.id, message.poll_data, currentUser]);
  
  // Handle poll vote submission
  const handleSubmitVote = useCallback(async () => {
    if (!currentUser || selectedOption === null || isVoting || userVote !== null) return;
    
    setIsVoting(true);
    try {
      const { error } = await supabase
        .from('poll_votes')
        .upsert({
          message_id: message.id,
          user_id: currentUser.id,
          option_id: selectedOption,
          post_id: message.id // Use message.id as post_id for compatibility
        }, {
          onConflict: 'message_id,user_id'
        });
      
      if (error) throw error;
      
      setUserVote(selectedOption);
      toast({
        title: "Vote submitted!",
        description: "Your vote has been recorded",
      });
      
      // Call parent handler if provided
      onPollVote?.(message.id, selectedOption);
    } catch (error) {
      console.error('Error submitting vote:', error);
      toast({
        title: "Error",
        description: "Failed to submit vote. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsVoting(false);
    }
  }, [currentUser, selectedOption, isVoting, userVote, message.id, toast, onPollVote]);

  const isBot = message.is_bot_message || message.is_team_agent_message;

  useEffect(() => {
    const fetchHeatData = async () => {
      if (!currentUser) return;
      
      // Get heat count
      const { count } = await supabase
        .from('message_heat_reactions')
        .select('*', { count: 'exact', head: true })
        .eq('message_id', message.id);
      
      setHeatCount(count || 0);
      
      // Check if current user has given heat
      const { data: userHeat } = await supabase
        .from('message_heat_reactions')
        .select('id')
        .eq('message_id', message.id)
        .eq('user_id', currentUser.id)
        .maybeSingle();
      
      setHasGivenHeat(!!userHeat);
    };
    
    fetchHeatData();
    
    // Real-time subscription for heat updates
    const channel = supabase
      .channel(`message-heat-${message.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'message_heat_reactions',
          filter: `message_id=eq.${message.id}`
        },
        () => {
          fetchHeatData();
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [message.id, currentUser]);

  const formattedTime = useMemo(() => {
    return formatDistanceToNow(new Date(message.created_at), { addSuffix: true });
  }, [message.created_at]);

  const displayName = useMemo(() => {
    if (isBot) return 'Game Bot';
    return user?.display_name || user?.username || `User ${message.user_id.slice(0, 8)}`;
  }, [isBot, user, message.user_id]);

  const isSocialBuzz = message.message_type === 'social_buzz';

  const renderSocialBuzzContent = useCallback((content: string) => {
    const lines = String(content || '').split('\n');

    return lines
      .map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return { kind: 'br' as const };

        // Hide any raw URL-only lines
        if (/^\(?https?:\/\/\S+\)?$/i.test(trimmed)) return null;

        // Convert markdown links like "🔗 [Source](https://...)" to a clean hyperlink.
        const md = trimmed.match(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/);
        if (md) {
          const url = md[2];
          const hasIcon = trimmed.includes('🔗');
          return {
            kind: 'link' as const,
            key: `l-${idx}`,
            url,
            prefix: hasIcon ? '🔗 ' : ''
          };
        }

        return { kind: 'text' as const, key: `t-${idx}`, text: line };
      })
      .filter(Boolean);
  }, []);

  const socialBuzzParts = useMemo(() => {
    return isSocialBuzz ? renderSocialBuzzContent(message.content) : null;
  }, [isSocialBuzz, message.content, renderSocialBuzzContent]);

  const handleCopy = useCallback(async () => {
    try {
      // Build complete copy with text, media, and embeds
      let copyContent = message.content;
      
      // Add media URLs
      if (message.media_url) {
        copyContent += `\n\n${message.media_url}`;
      }
      
      // Add embedded tweet URLs
      if (message.embed_code) {
        // Extract URL from embed code
        const urlMatch = message.embed_code.match(/https?:\/\/(twitter\.com|x\.com)\/[^\s"<]+/i);
        if (urlMatch) {
          copyContent += `\n\n${urlMatch[0]}`;
        }
      }
      
      // Add embeds array URLs
      if (message.embeds && Array.isArray(message.embeds)) {
        message.embeds.forEach((embed: any) => {
          if (embed.embed_code) {
            const urlMatch = embed.embed_code.match(/https?:\/\/(twitter\.com|x\.com)\/[^\s"<]+/i);
            if (urlMatch) {
              copyContent += `\n\n${urlMatch[0]}`;
            }
          }
        });
      }
      
      await navigator.clipboard.writeText(copyContent);
      toast({
        title: "Copied!",
        description: "Message copied to clipboard",
      });
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }, [message.content, message.media_url, message.embed_code, message.embeds, toast]);

  const handleCallout = useCallback(() => {
    onCopyCallout?.(message.id, message.content);
    toast({
      title: "Saved to Highlights!",
      description: "Message added to highlights sidebar",
    });
  }, [message.id, message.content, onCopyCallout, toast]);

  const handleBroadcast = useCallback(() => {
    onMegaphone?.(message.id);
    toast({
      title: "Broadcasted!",
      description: "Message sent to Spotlight Feed",
    });
    setBroadcastPopoverOpen(false);
  }, [message.id, onMegaphone, toast]);

  const handleReaction = useCallback((emoji: string) => {
    setReactions(prev => {
      const existing = prev.find(r => r.emoji === emoji);
      if (existing) {
        return prev.map(r => r.emoji === emoji ? { ...r, count: r.count + 1 } : r);
      }
      return [...prev, { emoji, count: 1 }];
    });
    toast({
      title: "Reacted!",
      description: `Added ${emoji} reaction`,
    });
  }, [toast]);

  const handleGiveHeat = useCallback(async () => {
    if (!currentUser || isGivingHeat || message.user_id === currentUser.id) return;
    
    setIsGivingHeat(true);
    try {
      if (hasGivenHeat) {
        // Remove heat
        await supabase
          .from('message_heat_reactions')
          .delete()
          .eq('message_id', message.id)
          .eq('user_id', currentUser.id);
      } else {
        // Give heat
        await supabase
          .from('message_heat_reactions')
          .insert({
            message_id: message.id,
            user_id: currentUser.id
          });
        
        toast({
          title: "Heat given! ⚡",
          description: "You gave this message some heat",
        });
      }
    } catch (error) {
      console.error('Failed to toggle heat:', error);
      toast({
        title: "Error",
        description: "Failed to give heat. Try again.",
        variant: "destructive"
      });
    } finally {
      setIsGivingHeat(false);
    }
  }, [currentUser, message.id, message.user_id, hasGivenHeat, isGivingHeat, toast]);

  // Bot messages = full-width updates with solid text
  if (isBot) {
    return (
      <div className="w-full px-2 py-1">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="retro-megaphone p-3 sm:p-4 rounded-lg border-2 border-yellow-600/60 bg-gradient-to-r from-yellow-400 to-amber-500 shadow-lg"
        >
          {/* Header - Bot name on first line */}
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-black animate-pulse" />
            <span className="font-bold text-xs tracking-wider uppercase text-black">
              {message.message_type === 'coach_response' 
                ? '🤖 Coach' 
                : message.is_team_agent_message && message.origin_teams?.name
                  ? `${message.origin_teams.name} Bot`
                  : 'Live Update'}
            </span>
          </div>
          {/* Timestamp + SPONSORED on second line */}
          <div className="flex items-center gap-2 text-xs text-gray-600 mb-2">
            <span>{formattedTime}</span>
            {message.origin_teams?.sponsor && (
              <>
                <span>•</span>
                <span className="font-semibold text-gray-700">SPONSORED</span>
              </>
            )}
          </div>
          
          {/* Media first for Reddit social buzz - full-width mobile like X embeds */}
          {isSocialBuzz && message.media_url && (
            <div className="w-full max-w-full my-3">
              {message.media_type === 'video' ? (
                <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-team-primary/30 bg-black">
                  {socialBuzzVideoFailed ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center">
                      <p className="text-sm font-semibold text-foreground">Video couldn’t load.</p>
                      <div className="flex items-center gap-2">
                        {socialBuzzParts?.find((p: any) => p?.kind === 'link')?.url ? (
                          <Button asChild size="sm" variant="secondary">
                            <a
                              href={socialBuzzParts.find((p: any) => p?.kind === 'link')?.url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Watch on Reddit
                            </a>
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <video
                      src={message.media_url}
                      className="absolute inset-0 w-full h-full object-contain"
                      controls
                      playsInline
                      preload="metadata"
                      onError={() => setSocialBuzzVideoFailed(true)}
                    />
                  )}
                </div>
              ) : (
                <div className="rounded-lg overflow-hidden border border-team-primary/30 bg-black/10">
                  <MediaViewer
                    mediaUrl={message.media_url}
                    mediaType="image"
                    showLightbox={true}
                  />
                </div>
              )}
            </div>
          )}

          {/* Fixed: Solid background instead of gradient for better readability */}
          <div className="mt-3 px-3 py-1.5 rounded-lg bg-background border border-team-primary/30 overflow-hidden">
            {isSocialBuzz && socialBuzzParts ? (
              <p
                className="text-sm text-foreground uppercase tracking-wide whitespace-pre-wrap break-words"
                style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800 }}
              >
                {socialBuzzParts.map((part: any, i: number) => {
                  if (!part) return null;
                  if (part.kind === 'br') return <br key={`br-${i}`} />;
                  if (part.kind === 'link') {
                    return (
                      <span key={part.key} className="inline-flex items-center gap-1">
                        {part.prefix}
                        <a
                          href={part.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs underline underline-offset-4 opacity-80 hover:opacity-100"
                        >
                          Source
                        </a>
                      </span>
                    );
                  }
                  return (
                    <span key={part.key}>
                      {part.text}
                      {i < socialBuzzParts.length - 1 ? <br /> : null}
                    </span>
                  );
                })}
              </p>
            ) : (
              <p
                className="text-sm text-foreground uppercase tracking-wide whitespace-pre-wrap break-words"
                style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800 }}
              >
                {message.content}
              </p>
            )}
          </div>
          
          {/* New embeds - handle both array and object formats */}
          {message.embeds && (
            <div className="mt-3 space-y-2">
              {Array.isArray(message.embeds) ? (
                // Array format (old style)
                message.embeds.map((embed, idx) => (
                  <div key={idx}>
                    {embed.embed_type === 'x' && embed.embed_code && (
                      <XPostEmbed embedCode={embed.embed_code} />
                    )}
                  </div>
                ))
              ) : (message.embeds as any).type === 'video' && (message.embeds as any).url ? (
                // Object format (highlights from fetch-highlights) - use proxy for ESPN videos
                <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-team-primary/30 bg-black">
                  <iframe
                    src={`https://dejuwyeypiggvlyfliap.supabase.co/functions/v1/video-proxy?url=${encodeURIComponent((message.embeds as any).url)}`}
                    className="absolute inset-0 w-full h-full"
                    allowFullScreen
                    sandbox="allow-scripts allow-same-origin"
                    title="Game Highlight"
                    style={{ border: 'none' }}
                  />
                </div>
              ) : null}
            </div>
          )}
          
          {/* Legacy embed_code format */}
          {!message.embeds && message.embed_code && (
            <div className="mt-3">
              {isXEmbed(message.embed_code) ? (
                <XPostEmbed embedCode={message.embed_code} />
              ) : message.message_type === 'highlight' && message.embed_code.match(/\.(mp4|mov|webm)(\?|$)/i) ? (
                <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-team-primary/30 bg-black">
                  <iframe
                    src={`https://dejuwyeypiggvlyfliap.supabase.co/functions/v1/video-proxy?url=${encodeURIComponent(message.embed_code)}`}
                    className="absolute inset-0 w-full h-full"
                    allowFullScreen
                    sandbox="allow-scripts allow-same-origin"
                    title="Game Highlight"
                    style={{ border: 'none' }}
                  />
                </div>
              ) : message.message_type === 'highlight' && (message.embed_code.includes('youtube.com') || message.embed_code.includes('youtu.be')) ? (
                <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-team-primary/30">
                  <iframe
                    src={message.embed_code}
                    className="absolute inset-0 w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              ) : (
                <div 
                  className="retro-embed"
                  dangerouslySetInnerHTML={{ 
                    __html: DOMPurify.sanitize(message.embed_code, {
                      ALLOWED_TAGS: ['iframe', 'video', 'source', 'img'],
                      ALLOWED_ATTR: ['src', 'width', 'height', 'frameborder', 'allowfullscreen', 'controls'],
                      ADD_ATTR: ['allowfullscreen']
                    })
                  }}
                />
              )}
            </div>
          )}

          {/* Polls and embeds render here - sponsor moved to above action buttons */}

          {/* Interactive Poll options for bot messages - Fix 4: Dark backgrounds for visibility */}
          {message.poll_data && (
            <div className="mt-3 p-3 rounded-lg border border-zinc-700 bg-zinc-900/95">
              <div className="text-sm font-semibold mb-3 text-white">
                {message.poll_data.question}
              </div>
              <div className="space-y-2">
                {message.poll_data.options?.map((option: any, idx: number) => {
                  const dbVoteCount = voteCounts.get(idx) || 0;
                  const totalDbVotes = Array.from(voteCounts.values()).reduce((sum, count) => sum + count, 0);
                  const voteCount = dbVoteCount || option.votes || 0;
                  const totalVotes = totalDbVotes || message.poll_data.options.reduce((sum: number, opt: any) => sum + (opt.votes || 0), 0);
                  const percentage = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
                  const isSelected = selectedOption === idx;
                  const isUserVote = userVote === idx;
                  
                  return (
                    <Button
                      key={idx}
                      variant="outline"
                      className={cn(
                        "w-full justify-between h-auto p-3 text-left border-zinc-600",
                        // Default: dark background with white text for visibility
                        !isUserVote && !isSelected && "bg-zinc-800 text-white hover:bg-zinc-700 hover:text-white",
                        // Selected (before voting): yellow border
                        isSelected && !isUserVote && "border-yellow-400 border-2 bg-zinc-800 text-white",
                        // User's voted option: yellow background
                        isUserVote && "bg-yellow-400 hover:bg-yellow-500 text-black border-yellow-400"
                      )}
                      onClick={() => userVote === null ? setSelectedOption(idx) : undefined}
                      disabled={userVote !== null || isVoting}
                    >
                      <span className="font-medium">{option.text}</span>
                      <span className="text-sm opacity-75">{voteCount} ({percentage}%)</span>
                    </Button>
                  );
                })}
              </div>
              {userVote === null && selectedOption !== null && (
                <Button 
                  onClick={handleSubmitVote}
                  disabled={isVoting}
                  className="w-full mt-3 bg-yellow-400 hover:bg-yellow-500 text-black font-semibold"
                >
                  {isVoting ? 'Submitting...' : 'SUBMIT VOTE'}
                </Button>
              )}
              <div className="mt-2 text-xs text-zinc-400 text-center">
                {userVote !== null ? '✓ You voted' : 'Tap an option to vote'} • Total: {Array.from(voteCounts.values()).reduce((sum, count) => sum + count, 0) || message.poll_data.options?.reduce((sum: number, opt: any) => sum + (opt.votes || 0), 0) || 0}
              </div>
            </div>
          )}

          {/* Sponsored by link - Fix 2: Single placement above action buttons */}
          {message.origin_teams?.sponsor && (
            <p className="text-xs text-gray-600 mt-3 text-right">
              Sponsored by{' '}
              {message.origin_teams.sponsor_url ? (
                <a 
                  href={message.origin_teams.sponsor_url.startsWith('http') ? message.origin_teams.sponsor_url : `https://${message.origin_teams.sponsor_url}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-gray-700 font-medium hover:underline"
                >
                  {message.origin_teams.sponsor}
                </a>
              ) : (
                <span className="font-medium text-gray-700">{message.origin_teams.sponsor}</span>
              )}
            </p>
          )}

          {/* Bot message actions */}
          <div className="flex items-center gap-2 mt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="h-7 px-2 text-xs hover:bg-black/10 text-gray-700 rounded-lg"
            >
              <Copy className="h-3 w-3 mr-1" />
              Copy
            </Button>
            {/* Reply button for bot messages */}
            {onReply && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onReply(message)}
                className="h-7 px-2 text-xs hover:bg-black/10 text-gray-700 rounded-lg"
              >
                Reply
              </Button>
            )}
            {/* View Fades button for fade notifications */}
            {message.message_type === 'fade_notification' && onOpenFades && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onOpenFades}
                className="h-7 px-2 text-xs bg-yellow-400/20 hover:bg-yellow-400/40 text-yellow-600 font-semibold rounded-lg"
              >
                <Zap className="h-3 w-3 mr-1" />
                View Fades
              </Button>
            )}
          </div>

          {/* Fix 3: Render replies for bot messages (one level deep only) */}
          {replies.length > 0 && (
            <div className="ml-4 mt-3 space-y-1 border-l-2 border-black/20 pl-2">
              {replies.map((reply) => (
                <div key={reply.id} className="flex gap-2 p-1.5 rounded bg-black/10">
                  <Avatar className="h-5 w-5 shrink-0">
                    <AvatarImage src={reply.profile?.avatar_url} />
                    <AvatarFallback className="bg-black/20 text-black text-xs">
                      {(reply.profile?.display_name || 'U').slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-black truncate">
                        {reply.profile?.display_name || 'User'}
                      </span>
                      <span className="text-xs text-gray-600">
                        {formatDistanceToNow(new Date(reply.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-xs text-black">{reply.content}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  // Regular user messages - mobile-first design
  const handleLongPressStart = () => {
    longPressTimer.current = setTimeout(() => {
      setShowReactions(true);
    }, 500);
  };

  const handleLongPressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  return (
    <motion.div
      id={`message-${message.id}`}
      className={cn(
        "group flex gap-2 sm:gap-3 hover:bg-team-primary/5 p-1 sm:p-2 rounded-lg transition-colors",
        "relative touch-manipulation"
      )}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      onTouchStart={handleLongPressStart}
      onTouchEnd={handleLongPressEnd}
    >
      {/* Avatar - hidden if grouped */}
      {!isGrouped && (
        <FoundingBadge tier={user?.founding_tier} size="sm">
          <Avatar className="h-7 w-7 sm:h-8 sm:w-8 ring-2 ring-team-primary/30 shrink-0">
            <AvatarImage src={user?.avatar_url} />
            <AvatarFallback className="bg-team-primary/20 text-team-primary text-xs">
              {displayName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </FoundingBadge>
      )}
      {isGrouped && <div className="h-7 w-7 sm:h-8 sm:w-8 shrink-0" />}

      {/* Content - full width on mobile */}
      <div className="flex-1 min-w-0">
        {/* Header - hidden if grouped */}
        {!isGrouped && (
          <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
            <span className="font-semibold text-team-primary text-xs sm:text-sm truncate">
              {displayName}
            </span>
            {user?.is_founding_member && <FoundingCheckmark size="sm" />}
            <span className="text-xs text-muted-foreground/60 shrink-0">
              {formattedTime}
            </span>
          </div>
        )}

        {/* Message content - mobile optimized padding */}
        <div className="retro-bubble p-2 rounded-lg border border-team-primary/30 bg-gradient-to-br from-background/80 to-team-primary/5 backdrop-blur-sm relative">
          {/* Interactive Poll for user messages */}
          {message.poll_data && (
            <div className="mb-3 p-3 rounded-lg border border-team-primary/30 bg-team-primary/5">
              <div className="text-sm font-semibold mb-3 text-foreground">
                {message.poll_data.question}
              </div>
              <div className="space-y-2">
                {message.poll_data.options?.map((option: any, idx: number) => {
                  const dbVoteCount = voteCounts.get(idx) || 0;
                  const totalDbVotes = Array.from(voteCounts.values()).reduce((sum, count) => sum + count, 0);
                  const voteCount = dbVoteCount || option.votes || 0;
                  const totalVotes = totalDbVotes || message.poll_data.options.reduce((sum: number, opt: any) => sum + (opt.votes || 0), 0);
                  const percentage = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
                  const isSelected = selectedOption === idx;
                  const isUserVote = userVote === idx;
                  
                  return (
                    <Button
                      key={idx}
                      variant={isUserVote ? "default" : isSelected ? "secondary" : "outline"}
                      className={cn(
                        "w-full justify-between h-auto p-3 text-left",
                        isUserVote && "bg-yellow-400 hover:bg-yellow-500 text-black",
                        isSelected && !isUserVote && "border-yellow-400 border-2"
                      )}
                      onClick={() => userVote === null ? setSelectedOption(idx) : undefined}
                      disabled={userVote !== null || isVoting}
                    >
                      <span className="font-medium">{option.text}</span>
                      <span className="text-sm opacity-75">{voteCount} ({percentage}%)</span>
                    </Button>
                  );
                })}
              </div>
              {userVote === null && selectedOption !== null && (
                <Button 
                  onClick={handleSubmitVote}
                  disabled={isVoting}
                  className="w-full mt-3 bg-yellow-400 hover:bg-yellow-500 text-black font-semibold"
                >
                  {isVoting ? 'Submitting...' : 'SUBMIT VOTE'}
                </Button>
              )}
              <div className="mt-2 text-xs text-muted-foreground text-center">
                {userVote !== null ? '✓ You voted' : 'Tap an option to vote'} • Total: {Array.from(voteCounts.values()).reduce((sum, count) => sum + count, 0) || message.poll_data.options?.reduce((sum: number, opt: any) => sum + (opt.votes || 0), 0) || 0}
              </div>
            </div>
          )}

          <p className="text-sm sm:text-base text-foreground whitespace-pre-wrap break-words">
            {message.content}
          </p>

          {/* Media - responsive sizing */}
          {message.media_url && (
            <div className="mt-2 rounded-lg overflow-hidden border border-team-primary/20">
              {message.media_type === 'image' ? (
                <img 
                  src={message.media_url} 
                  alt="Shared media" 
                  className="w-full h-auto max-h-60 sm:max-h-96 object-contain bg-black/20"
                />
              ) : (
                <video 
                  src={message.media_url} 
                  controls 
                  className="w-full h-auto max-h-60 sm:max-h-96 bg-black/20"
                />
              )}
            </div>
          )}

          {/* Embeds - handle both array and object formats */}
          {message.embeds && (
            <div className="mt-2 space-y-2">
              {Array.isArray(message.embeds) ? (
                // Array format (old style)
                message.embeds.map((embed, idx) => (
                  <div key={idx}>
                    {embed.embed_type === 'x' && embed.embed_code && (
                      <XPostEmbed embedCode={embed.embed_code} />
                    )}
                  </div>
                ))
              ) : (message.embeds as any).type === 'video' && (message.embeds as any).url ? (
                // Object format (highlights from fetch-highlights) - use proxy for ESPN videos
                <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-team-primary/30 bg-black">
                  <iframe
                    src={`https://dejuwyeypiggvlyfliap.supabase.co/functions/v1/video-proxy?url=${encodeURIComponent((message.embeds as any).url)}`}
                    className="absolute inset-0 w-full h-full"
                    allowFullScreen
                    sandbox="allow-scripts allow-same-origin"
                    title="Game Highlight"
                    style={{ border: 'none' }}
                  />
                </div>
              ) : null}
            </div>
          )}
          
          {/* Legacy embed_code format */}
          {!message.embeds && message.embed_code && (
            <div className="mt-2">
              {isXEmbed(message.embed_code) ? (
                <XPostEmbed embedCode={message.embed_code} />
              ) : message.message_type === 'highlight' && message.embed_code.match(/\.(mp4|mov|webm)(\?|$)/i) ? (
                <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-team-primary/30 bg-black">
                  <iframe
                    src={`https://dejuwyeypiggvlyfliap.supabase.co/functions/v1/video-proxy?url=${encodeURIComponent(message.embed_code)}`}
                    className="absolute inset-0 w-full h-full"
                    allowFullScreen
                    sandbox="allow-scripts allow-same-origin"
                    title="Game Highlight"
                    style={{ border: 'none' }}
                  />
                </div>
              ) : message.message_type === 'highlight' && (message.embed_code.includes('youtube.com') || message.embed_code.includes('youtu.be')) ? (
                <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-team-primary/30">
                  <iframe
                    src={message.embed_code}
                    className="absolute inset-0 w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              ) : (
                <div 
                  className="retro-embed"
                  dangerouslySetInnerHTML={{ 
                    __html: DOMPurify.sanitize(message.embed_code, {
                      ALLOWED_TAGS: ['iframe', 'video', 'source', 'img'],
                      ALLOWED_ATTR: ['src', 'width', 'height', 'frameborder', 'allowfullscreen', 'controls'],
                      ADD_ATTR: ['allowfullscreen']
                    })
                  }}
                />
              )}
            </div>
          )}
        </div>

        {/* Reactions - mobile-friendly touch targets */}
        {reactions.length > 0 && (
          <motion.div 
            className="flex gap-1.5 mt-2 flex-wrap"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
          >
            {reactions.map((reaction, idx) => (
              <motion.div
                key={idx}
                className="px-2.5 py-1 rounded-full bg-team-primary/20 border border-team-primary/30 text-xs flex items-center gap-1 min-h-[28px] touch-manipulation"
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: idx * 0.05, type: "spring" }}
              >
                <span className="text-base">{reaction.emoji}</span>
                <span className="text-team-primary font-medium">{reaction.count}</span>
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Action buttons - simplified mobile-friendly */}
        <AnimatePresence>
          {showActions && (
            <motion.div
              className="flex items-center gap-1 sm:gap-1.5 mt-2 flex-wrap"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {/* Simple static reactions - desktop only */}
              <div className="hidden sm:flex items-center gap-1">
                {SIMPLE_REACTIONS.map((emoji) => (
                  <Button
                    key={emoji}
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 sm:h-9 sm:w-9 p-0 text-lg sm:text-xl hover:bg-team-primary/20 hover:scale-110 transition-all rounded-full touch-manipulation"
                    onClick={() => handleReaction(emoji)}
                  >
                    {emoji}
                  </Button>
                ))}
              </div>

              {/* Copy */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="h-8 px-2 sm:px-3 text-xs hover:bg-team-primary/20 text-muted-foreground rounded-full touch-manipulation"
              >
                <Copy className="h-3 w-3 sm:mr-1" />
                <span className="hidden sm:inline">Copy</span>
              </Button>

              {/* Reply button */}
              {onReply && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onReply(message)}
                  className="h-8 px-2 sm:px-3 text-xs hover:bg-team-primary/20 text-muted-foreground rounded-full touch-manipulation"
                >
                  <span>Reply</span>
                </Button>
              )}

              {/* Lightning Heat Button - Only show if not own message */}
              {message.user_id !== currentUser?.id && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleGiveHeat}
                  disabled={isGivingHeat}
                  className={cn(
                    "h-8 px-2 text-xs hover:bg-yellow-500/20 rounded-full touch-manipulation transition-all",
                    hasGivenHeat && "text-yellow-500"
                  )}
                >
                  <Zap className={cn("h-3 w-3 sm:mr-1", hasGivenHeat && "fill-current")} />
                  <span className="hidden sm:inline">Heat</span>
                  {heatCount > 0 && (
                    <span className="ml-1 text-xs font-pixel">{heatCount}</span>
                  )}
                </Button>
              )}
              
              {/* Show heat count even on own messages */}
              {message.user_id === currentUser?.id && heatCount > 0 && (
                <div className="flex items-center gap-1 px-2 py-1 bg-yellow-500/10 border border-yellow-500/30 rounded-full text-xs">
                  <Zap className="h-3 w-3 text-yellow-500 fill-current" />
                  <span className="font-pixel text-yellow-500">{heatCount}</span>
                </div>
              )}

              {/* Admin broadcast - Only show on own messages */}
              {isAdmin && message.user_id === currentUserId && (
                <Popover open={broadcastPopoverOpen} onOpenChange={setBroadcastPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 sm:px-3 text-xs hover:bg-destructive/20 text-destructive rounded-full touch-manipulation"
                    >
                      <Megaphone className="h-3 w-3 sm:mr-1" />
                      <span className="hidden sm:inline">Broadcast</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-3 bg-background/95 backdrop-blur-sm border-team-primary/30" align="end">
                    <div className="space-y-3">
                      <Button
                        onClick={() => {
                          handleBroadcast();
                          setBroadcastPopoverOpen(false);
                        }}
                        className="w-full bg-destructive hover:bg-destructive/90 touch-manipulation min-h-[44px]"
                        size="sm"
                      >
                        <Megaphone className="h-3 w-3 mr-2" />
                        Confirm Broadcast
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Render replies (one level deep only) */}
        {replies.length > 0 && (
          <div className="ml-8 sm:ml-10 mt-2 space-y-1 border-l-2 border-team-primary/30 pl-2">
            {replies.map((reply) => (
              <div key={reply.id} className="flex gap-2 p-1.5 rounded bg-team-primary/5">
                <Avatar className="h-5 w-5 shrink-0">
                  <AvatarImage src={reply.profile?.avatar_url} />
                  <AvatarFallback className="bg-team-primary/20 text-team-primary text-xs">
                    {(reply.profile?.display_name || 'U').slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-team-primary truncate">
                      {reply.profile?.display_name || 'User'}
                    </span>
                    <span className="text-xs text-muted-foreground/60">
                      {formatDistanceToNow(new Date(reply.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-xs text-foreground">{reply.content}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
});

RetroMessageBubble.displayName = 'RetroMessageBubble';