import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Heart, Flame, Share } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { MediaViewer } from "@/components/MediaViewer";

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

// Twitter Embed Component
export const TwitterEmbed = ({ embedCode }: { embedCode: string }) => {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadTwitterWidgets = async () => {
      try {
        // Check if script is already loaded
        if (window.twttr) {
          window.twttr.widgets.load();
          setIsLoading(false);
          return;
        }

        // Load script only once per page
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
        } else {
          // Script exists, wait for it to load
          const checkTwitter = setInterval(() => {
            if (window.twttr) {
              window.twttr.widgets.load();
              setIsLoading(false);
              clearInterval(checkTwitter);
            }
          }, 100);
          
          // Timeout after 5 seconds
          setTimeout(() => {
            clearInterval(checkTwitter);
            setIsLoading(false);
          }, 5000);
        }
      } catch (error) {
        console.error('Error loading Twitter widgets:', error);
        setIsLoading(false);
      }
    };

    loadTwitterWidgets();
  }, []);

  // Check if it's a Twitter/X URL and convert to embed
  if (embedCode.includes('twitter.com') || embedCode.includes('x.com')) {
    const urlMatch = embedCode.match(/https?:\/\/(?:twitter\.com|x\.com)\/\w+\/status\/\d+/);
    if (urlMatch) {
      const tweetUrl = urlMatch[0];
      return (
        <div className="twitter-embed min-h-[200px] relative">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/50 rounded">
              <div className="text-sm text-muted-foreground">Loading tweet...</div>
            </div>
          )}
          <blockquote className="twitter-tweet" data-conversation="none">
            <a href={tweetUrl}></a>
          </blockquote>
        </div>
      );
    }
  }

  // For other embeds, use dangerouslySetInnerHTML as fallback
  return <div dangerouslySetInnerHTML={{ __html: embedCode }} />;
};

interface PostCardProps {
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
}

export const PostCard = ({ post, isSpotlight = false }: PostCardProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [reactions, setReactions] = useState(post.post_reactions);
  const [pollVotes, setPollVotes] = useState<any[]>([]);
  const [userVote, setUserVote] = useState<number | null>(null);

  const likeCount = reactions.filter(r => r.reaction_type === 'like').length;
  const fireCount = reactions.filter(r => r.reaction_type === 'fire').length;

  // Fetch poll votes if this is a poll
  useEffect(() => {
    if (post.poll_data) {
      fetchPollVotes();
    }
  }, [post.id, post.poll_data]);

  const fetchPollVotes = async () => {
    try {
      const { data: votes, error } = await supabase
        .from('poll_votes')
        .select('*')
        .eq('post_id', post.id);

      if (error) throw error;
      setPollVotes(votes || []);
      
      // Check if current user has voted
      if (user) {
        const userVoteRecord = votes?.find(v => v.user_id === user.id);
        setUserVote(userVoteRecord?.option_id || null);
      }
    } catch (error) {
      console.error('Error fetching poll votes:', error);
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

    try {
      // Check if user already reacted with this type
      const existingReaction = reactions.find(r => r.reaction_type === type);
      
      if (existingReaction) {
        // Remove reaction
        const { error } = await supabase
          .from('post_reactions')
          .delete()
          .eq('post_id', post.id)
          .eq('user_id', user.id)
          .eq('reaction_type', type);

        if (error) throw error;
        
        setReactions(prev => prev.filter(r => !(r.reaction_type === type)));
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
      }
    } catch (error) {
      console.error('Error handling reaction:', error);
      toast({
        title: "Error",
        description: "Failed to update reaction",
        variant: "destructive"
      });
    }
  };

  const handlePollVote = async (optionId: number) => {
    if (!user?.id) {
      toast({
        title: "Please sign in",
        description: "You need to be logged in to vote",
        variant: "destructive"
      });
      return;
    }

    try {
      if (userVote === optionId) {
        // Remove vote
        const { error } = await supabase
          .from('poll_votes')
          .delete()
          .eq('post_id', post.id)
          .eq('user_id', user.id);

        if (error) throw error;
        setUserVote(null);
      } else {
        // Add or update vote
        const { error } = await supabase
          .from('poll_votes')
          .upsert({
            post_id: post.id,
            user_id: user.id,
            option_id: optionId
          });

        if (error) throw error;
        setUserVote(optionId);
      }
      
      // Refresh poll votes
      await fetchPollVotes();
    } catch (error) {
      console.error('Error voting:', error);
      toast({
        title: "Error",
        description: "Failed to submit vote",
        variant: "destructive"
      });
    }
  };

  const handleShare = async () => {
    // Create deep link to specific post if it's a spotlight post
    const baseUrl = window.location.origin;
    const postUrl = isSpotlight ? `${baseUrl}/spotlight/${post.id}` : window.location.href;
    
    const shareData = {
      title: isSpotlight ? 
        `${post.author?.display_name || post.team?.name} on Side Huddle` : 
        `${post.team?.name} Post`,
      text: post.content,
      url: postUrl
    };

    // Add media to share data if available and supported
    if (post.media_url && navigator.share) {
      try {
        // For native sharing with media, we need to fetch the media as a file
        const response = await fetch(post.media_url);
        const blob = await response.blob();
        const file = new File([blob], 'shared-media', { type: blob.type });
        
        const shareDataWithMedia = {
          ...shareData,
          files: [file]
        };
        
        if (navigator.canShare && navigator.canShare(shareDataWithMedia)) {
          await navigator.share(shareDataWithMedia);
          return;
        }
      } catch (error) {
        console.log('Media sharing not supported, falling back to text');
      }
    }

    try {
      if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData);
      } else {
        // Fallback: copy to clipboard with enhanced format
        const shareText = post.media_url ? 
          `${post.content}\n\n📸 View media: ${postUrl}` :
          `${post.content}\n\n${postUrl}`;
          
        await navigator.clipboard.writeText(shareText);
        toast({
          title: "Link copied!",
          description: "Post link copied to clipboard"
        });
      }
    } catch (error) {
      console.error('Error sharing:', error);
      // Fallback: copy to clipboard
      try {
        const shareText = post.media_url ? 
          `${post.content}\n\n📸 View media: ${postUrl}` :
          `${post.content}\n\n${postUrl}`;
          
        await navigator.clipboard.writeText(shareText);
        toast({
          title: "Link copied!",
          description: "Post link copied to clipboard"
        });
      } catch (clipboardError) {
        toast({
          title: "Share failed",
          description: "Unable to share or copy link",
          variant: "destructive"
        });
      }
    }
  };

  return (
    <Card className={`p-4 border-0 border-b border-border rounded-none ${isSpotlight ? 'bg-gradient-to-r from-spotlight/10 to-transparent' : ''}`}>
      {/* Team Header */}
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
          {(post.is_team_agent_message || post.is_agent_post || !post.author) ? (
            // For team agent posts, show team logo
            post.team.logo_url ? (
              <img src={post.team.logo_url} alt={post.team.name} className="w-8 h-8 rounded-full" />
            ) : (
              <span className="text-primary font-bold text-sm">
                {post.team.name.substring(0, 2).toUpperCase()}
              </span>
            )
          ) : (
            // For user posts, show user avatar
            post.author?.avatar_url ? (
              <img src={post.author.avatar_url} alt="Author" className="w-8 h-8 rounded-full" />
            ) : (
              <span className="text-primary font-bold text-sm">
                {post.author?.display_name ? 
                  post.author.display_name.substring(0, 2).toUpperCase() :
                  post.team.name.substring(0, 2).toUpperCase()
                }
              </span>
            )
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-foreground">
              {(post.is_team_agent_message || post.is_agent_post || !post.author) ? 
                `${post.team.name} Agent` : 
                (post.author?.display_name || post.author?.username || post.team.name)
              }
            </h3>
            {(post.is_team_agent_message || post.is_agent_post || !post.author) && !isSpotlight && post.team.sponsor && (
              <span className="text-xs text-muted-foreground font-light">
                sponsored by: {post.team.sponsor}
              </span>
            )}
            {post.author && !post.is_team_agent_message && !post.is_agent_post && !isSpotlight && (
              <span className="text-xs text-muted-foreground">via {post.team.name}</span>
            )}
            {isSpotlight && (
              <span className="text-xs bg-spotlight text-primary-foreground px-2 py-1 rounded-full font-medium">
                SPOTLIGHT
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
          </p>
        </div>
      </div>

      {/* Post Content */}
      <div className="mb-3">
        <p className="text-foreground leading-relaxed">{post.content}</p>
        
        {/* Embed Code Display */}
        {post.embed_code && (
          <div className="mt-3 rounded-lg overflow-hidden">
            <TwitterEmbed embedCode={post.embed_code} />
          </div>
        )}

        {/* Media Display */}
        {post.media_url && !post.embed_code && (
          <div className="mt-3 rounded-lg overflow-hidden">
            {/* Check if it's a direct media file for MediaViewer */}
            {(post.media_url.includes('.jpg') || post.media_url.includes('.jpeg') || 
              post.media_url.includes('.png') || post.media_url.includes('.gif') || 
              post.media_url.includes('.webp')) ? (
              <MediaViewer
                mediaUrl={post.media_url}
                mediaType="image"
                className="w-full"
              />
            ) : (post.media_url.includes('.mp4') || post.media_url.includes('.webm') || 
                   post.media_url.includes('.ogg') || post.media_url.includes('.mov')) ? (
              <MediaViewer
                mediaUrl={post.media_url}
                mediaType="video"
                className="w-full"
              />
            ) : /* Handle YouTube URLs */
            (post.media_url.includes('youtube.com') || post.media_url.includes('youtu.be')) ? (
              <div className="aspect-video">
                <iframe
                  src={post.media_url.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/')}
                  className="w-full h-full"
                  frameBorder="0"
                  allowFullScreen
                  title="Video content"
                />
              </div>
            ) : /* Handle embed URLs */
            post.media_url.includes('embed') || post.media_url.includes('iframe') ? (
              <div className="aspect-video">
                <iframe
                  src={post.media_url}
                  className="w-full h-full"
                  frameBorder="0"
                  allowFullScreen
                  title="Embedded content"
                />
              </div>
            ) : /* Fallback - try as image first, then iframe */
            (
              <div>
                <img 
                  src={post.media_url} 
                  alt="Post media" 
                  className="w-full h-auto"
                  onError={(e) => {
                    // If image fails, try as iframe
                    const target = e.target as HTMLImageElement;
                    const parent = target.parentElement;
                    if (parent) {
                      parent.innerHTML = `<div class="aspect-video"><iframe src="${post.media_url}" class="w-full h-full" frameborder="0" title="Embedded content"></iframe></div>`;
                    }
                  }}
                />
              </div>
            )}
          </div>
        )}
        
        {/* Poll Display */}
        {post.poll_data && (
          <div className="mt-3 space-y-2">
            <div className="space-y-2">
              {post.poll_data.options?.map((option: any) => {
                const optionVotes = pollVotes.filter(v => v.option_id === option.id).length;
                const totalVotes = pollVotes.length;
                const percentage = totalVotes > 0 ? (optionVotes / totalVotes) * 100 : 0;
                const isSelected = userVote === option.id;
                
                return (
                  <Button
                    key={option.id}
                    variant={isSelected ? "default" : "outline"}
                    className="w-full justify-between h-auto p-3 relative overflow-hidden"
                    onClick={() => handlePollVote(option.id)}
                  >
                    <div 
                      className="absolute inset-0 bg-primary/10 transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                    <span className="relative z-10">{option.text}</span>
                    <span className="relative z-10 text-sm text-muted-foreground">
                      {optionVotes} ({Math.round(percentage)}%)
                    </span>
                  </Button>
                );
              })}
              <p className="text-xs text-muted-foreground text-center">
                {pollVotes.length} total votes
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Reaction Buttons - Only show for non-spotlight posts */}
      {!isSpotlight && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleReaction('like')}
              className="flex items-center gap-2 text-like-button hover:text-like-button hover:bg-like-button/10"
            >
              <Heart className="w-4 h-4" />
              <span className="text-sm">{likeCount}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleReaction('fire')}
              className="flex items-center gap-2 text-fire-button hover:text-fire-button hover:bg-fire-button/10"
            >
              <Flame className="w-4 h-4" />
              <span className="text-sm">{fireCount}</span>
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleShare}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
          >
            <Share className="w-4 h-4" />
          </Button>
        </div>
      )}
    </Card>
  );
};