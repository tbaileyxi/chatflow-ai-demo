import { useState, useEffect } from "react";
import { Heart, Flame, Share, MessageCircle, Play } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ModernCard } from "@/components/ui/modern-card";
import { AnimatedButton } from "@/components/modern/AnimatedButton";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { MediaViewer } from "@/components/MediaViewer";
import { linkifyTeamNames } from "@/utils/teamLinking";
import { cn } from "@/lib/utils";

// Twitter global type
declare global {
  interface Window {
    twttr?: {
      widgets: {
        load: () => void;
      };
    };
  }
}

// Enhanced Twitter Embed Component with lazy loading
export const EnhancedTwitterEmbed = ({ embedCode }: { embedCode: string }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    const element = document.getElementById(`twitter-embed-${embedCode.slice(0, 10)}`);
    if (element) observer.observe(element);

    return () => observer.disconnect();
  }, [embedCode]);

  useEffect(() => {
    if (!isVisible) return;

    const loadTwitterWidgets = async () => {
      try {
        if (window.twttr) {
          window.twttr.widgets.load();
          setIsLoading(false);
          return;
        }

        if (!document.querySelector('script[src*="platform.twitter.com"]')) {
          const script = document.createElement('script');
          script.src = 'https://platform.twitter.com/widgets.js';
          script.async = true;
          script.onload = () => {
            if (window.twttr) {
              window.twttr.widgets.load();
              setIsLoading(false);
            }
          };
          script.onerror = () => setIsLoading(false);
          document.head.appendChild(script);
        }
      } catch (error) {
        console.error('Error loading Twitter widgets:', error);
        setIsLoading(false);
      }
    };

    loadTwitterWidgets();
  }, [isVisible]);

  if (embedCode.includes('twitter.com') || embedCode.includes('x.com')) {
    const urlMatch = embedCode.match(/https?:\/\/(?:twitter\.com|x\.com)\/\w+\/status\/\d+/);
    if (urlMatch) {
      const tweetUrl = urlMatch[0];
      return (
        <div 
          id={`twitter-embed-${embedCode.slice(0, 10)}`}
          className="relative min-h-[200px] rounded-xl overflow-hidden"
        >
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-muted/50 to-muted/30 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                <span className="text-sm">Loading tweet...</span>
              </div>
            </div>
          )}
          {isVisible && (
            <blockquote className="twitter-tweet" data-conversation="none" data-theme="dark">
              <a href={tweetUrl}></a>
            </blockquote>
          )}
        </div>
      );
    }
  }

  return <div dangerouslySetInnerHTML={{ __html: embedCode }} />;
};

interface ModernPostCardProps {
  post: {
    id: string;
    content: string;
    media_url?: string;
    embed_code?: string;
    message_type?: string;
    poll_data?: any;
    created_at: string;
    author_id?: string;
    is_team_agent_message?: boolean;
    is_agent_post?: boolean;
    team: {
      id: string;
      name: string;
      logo_url?: string;
      sponsor?: string;
      sponsor_url?: string;
    };
    origin_teams?: {
      name: string;
      logo_url?: string;
    };
    author?: {
      display_name?: string;
      username?: string;
      avatar_url?: string;
    };
    post_reactions: Array<{
      reaction_type: string;
    }>;
  };
  isSpotlight?: boolean;
  index?: number;
  disableReply?: boolean;
}

export const ModernPostCard = ({ post, isSpotlight = false, index = 0, disableReply = false }: ModernPostCardProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [reactions, setReactions] = useState(post.post_reactions);
  const [hasLiked, setHasLiked] = useState(false);
  const [hasFired, setHasFired] = useState(false);
  const [isInteracting, setIsInteracting] = useState(false);

  const likeCount = reactions.filter(r => r.reaction_type === 'like').length;
  const fireCount = reactions.filter(r => r.reaction_type === 'fire').length;
  
  const extractTags = (content: string) => {
    const tagRegex = /#[\w]+/g;
    return content.match(tagRegex) || [];
  };
  
  const tags = extractTags(post.content);
  const contentWithoutTags = post.content.replace(/#[\w]+/g, '').trim();

  useEffect(() => {
    // Check if user has already reacted
    if (user) {
      checkUserReactions();
    }
  }, [user, post.id]);

  const checkUserReactions = async () => {
    if (!user?.id) return;
    
    try {
      const { data: userReactions } = await supabase
        .from('post_reactions')
        .select('reaction_type')
        .eq('post_id', post.id)
        .eq('user_id', user.id);

      setHasLiked(userReactions?.some(r => r.reaction_type === 'like') || false);
      setHasFired(userReactions?.some(r => r.reaction_type === 'fire') || false);
    } catch (error) {
      console.error('Error checking user reactions:', error);
    }
  };

  const handleReaction = async (type: 'like' | 'fire') => {
    if (!user?.id) {
      toast({
        title: "Please sign in",
        description: "You need to be logged in to react to posts",
        variant: "destructive"
      });
      return;
    }

    setIsInteracting(true);
    const isCurrentlyReacted = type === 'like' ? hasLiked : hasFired;

    try {
      if (isCurrentlyReacted) {
        // Remove reaction
        const { error } = await supabase
          .from('post_reactions')
          .delete()
          .eq('post_id', post.id)
          .eq('user_id', user.id)
          .eq('reaction_type', type);

        if (error) throw error;
        
        setReactions(prev => prev.filter(r => !(r.reaction_type === type)));
        if (type === 'like') setHasLiked(false);
        if (type === 'fire') setHasFired(false);
      } else {
        // Add reaction
        const { error } = await supabase
          .from('post_reactions')
          .insert({
            post_id: post.id,
            user_id: user.id,
            reaction_type: type
          });

        if (error) throw error;
        
        setReactions(prev => [...prev, { reaction_type: type }]);
        if (type === 'like') setHasLiked(true);
        if (type === 'fire') setHasFired(true);
      }
    } catch (error) {
      console.error('Error handling reaction:', error);
      toast({
        title: "Error",
        description: "Failed to update reaction",
        variant: "destructive"
      });
    } finally {
      setIsInteracting(false);
    }
  };

  const handleShare = async () => {
    const baseUrl = window.location.origin;
    const postUrl = isSpotlight ? `${baseUrl}/spotlight/${post.id}` : window.location.href;
    
    const shareData = {
      title: isSpotlight ? 
        `${post.author?.display_name || post.team?.name} on Side Huddle` : 
        `${post.team?.name} Post`,
      text: post.content,
      url: postUrl
    };

    try {
      if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${post.content}\n\n${postUrl}`);
        toast({
          title: "Link copied!",
          description: "Post link copied to clipboard"
        });
      }
    } catch (error) {
      console.error('Error sharing:', error);
      toast({
        title: "Share failed",
        description: "Unable to share or copy link",
        variant: "destructive"
      });
    }
  };

  return (
    <ModernCard 
      variant="feed"
      className={cn(
        "mb-4 transition-all duration-500 ease-out",
        isSpotlight && "border-l-4 border-l-spotlight bg-gradient-to-r from-spotlight/5 to-transparent",
        "animate-fade-in"
      )}
      style={{ animationDelay: `${index * 100}ms` }}
    >
      {/* Enhanced Header */}
      <div className="flex items-start gap-3 mb-4">
        <Avatar className="w-12 h-12 ring-2 ring-border/20 transition-all duration-300 hover:ring-primary/30">
          <AvatarImage 
            src={(post.is_team_agent_message || post.is_agent_post || !post.author) 
              ? (post.origin_teams?.logo_url || post.team.logo_url) 
              : post.author?.avatar_url
            } 
            alt="Avatar"
          />
          <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary font-bold">
            {(post.is_team_agent_message || post.is_agent_post || !post.author) 
              ? (post.origin_teams?.name || post.team.name).substring(0, 2).toUpperCase()
              : (post.author?.display_name || post.team.name).substring(0, 2).toUpperCase()
            }
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-foreground truncate">
              {(post.is_team_agent_message || post.is_agent_post || !post.author) 
                ? `${post.origin_teams?.name || post.team.name} Agent` 
                : (post.author?.display_name || post.author?.username || post.team.name)
              }
            </h3>
            
            {isSpotlight && (
              <Badge variant="secondary" className="bg-spotlight text-spotlight-foreground px-2 py-0.5 text-xs font-medium">
                SPOTLIGHT
              </Badge>
            )}
            
            {(post.is_team_agent_message || post.is_agent_post) && (
              <Badge variant="outline" className="text-xs border-primary/30 text-primary">
                BOT
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</span>
            {post.author && !post.is_team_agent_message && !post.is_agent_post && !isSpotlight && (
              <>
                <span>•</span>
                <span>via {post.team.name}</span>
              </>
            )}
          </div>
        </div>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {tags.slice(0, 2).map((tag, index) => (
              <Badge key={index} variant="secondary" className="text-xs opacity-70">
                {tag}
              </Badge>
            ))}
            {tags.length > 2 && (
              <Badge variant="secondary" className="text-xs opacity-50">
                +{tags.length - 2}
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="mb-4">
        <div 
          className="text-foreground leading-relaxed whitespace-pre-wrap" 
          dangerouslySetInnerHTML={{ __html: linkifyTeamNames(contentWithoutTags) }}
        />
      </div>

      {/* Enhanced Media Display */}
      {post.embed_code && (
        <div className="mb-4 rounded-xl overflow-hidden border border-border/20">
          <EnhancedTwitterEmbed embedCode={post.embed_code} />
        </div>
      )}

      {post.media_url && !post.embed_code && (
        <div className="mb-4 rounded-xl overflow-hidden border border-border/20 group">
          {(post.media_url.includes('.mp4') || post.media_url.includes('.webm') || 
            post.media_url.includes('.ogg') || post.media_url.includes('.mov')) ? (
            <div className="relative">
              <MediaViewer
                mediaUrl={post.media_url}
                mediaType="video"
                className="w-full transition-transform duration-300 group-hover:scale-[1.02]"
              />
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                <Play className="w-12 h-12 text-white/80" />
              </div>
            </div>
          ) : (
            <MediaViewer
              mediaUrl={post.media_url}
              mediaType="image"
              className="w-full transition-transform duration-300 group-hover:scale-[1.02]"
            />
          )}
        </div>
      )}

      {/* Enhanced Action Bar */}
      <div className="flex items-center justify-between pt-3 border-t border-border/20">
        <div className="flex items-center gap-1">
          <AnimatedButton
            variant="ghost"
            size="sm"
            animation="scale"
            onClick={() => handleReaction('like')}
            disabled={isInteracting}
            className={cn(
              "h-9 px-3 gap-2 rounded-full transition-all duration-300",
              hasLiked 
                ? "bg-like-button/20 text-like-button hover:bg-like-button/30 border border-like-button/30" 
                : "hover:bg-like-button/10 hover:text-like-button"
            )}
          >
            <Heart className={cn("w-4 h-4 transition-all duration-300", hasLiked && "fill-current")} />
            <span className="text-sm font-medium">{likeCount}</span>
          </AnimatedButton>

          <AnimatedButton
            variant="ghost"
            size="sm"
            animation="scale"
            onClick={() => handleReaction('fire')}
            disabled={isInteracting}
            className={cn(
              "h-9 px-3 gap-2 rounded-full transition-all duration-300",
              hasFired 
                ? "bg-fire-button/20 text-fire-button hover:bg-fire-button/30 border border-fire-button/30" 
                : "hover:bg-fire-button/10 hover:text-fire-button"
            )}
          >
            <Flame className={cn("w-4 h-4 transition-all duration-300", hasFired && "fill-current")} />
            <span className="text-sm font-medium">{fireCount}</span>
          </AnimatedButton>

          {!disableReply && (
            <AnimatedButton
              variant="ghost"
              size="sm"
              animation="scale"
              className="h-9 px-3 gap-2 rounded-full hover:bg-muted/50"
            >
              <MessageCircle className="w-4 h-4" />
              <span className="text-sm font-medium">Reply</span>
            </AnimatedButton>
          )}
        </div>

        <AnimatedButton
          variant="ghost"
          size="sm"
          animation="scale"
          onClick={handleShare}
          className="h-9 px-3 rounded-full hover:bg-muted/50"
        >
          <Share className="w-4 h-4" />
        </AnimatedButton>
      </div>
    </ModernCard>
  );
};