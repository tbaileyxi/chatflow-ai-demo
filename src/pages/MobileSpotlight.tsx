import React, { useState, useEffect } from 'react';
import { MobileLayout } from '@/components/mobile/MobileLayout';
import { GlassHeader } from '@/components/mobile/GlassHeader';
import { BottomNav } from '@/components/mobile/BottomNav';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Heart, MessageCircle, Share, Flame, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface SpotlightPost {
  id: string;
  content: string;
  created_at: string;
  author: {
    display_name: string;
    avatar_url?: string;
  };
  team_name?: string;
  team_logo_url?: string;
  media_url?: string;
  media_type?: 'image' | 'video';
  likes_count: number;
  comments_count: number;
  is_trending?: boolean;
  is_bot_post?: boolean;
}

export const MobileSpotlight = () => {
  const [posts, setPosts] = useState<SpotlightPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Mock data for demo
    const mockPosts: SpotlightPost[] = [
      {
        id: '1',
        content: '🔥 LeBron James drops 35 points in the clutch! This man is absolutely unstoppable at 39 years old. Greatest of all time? 👑',
        created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        author: {
          display_name: 'Lakers Bot',
          avatar_url: '/lovable-uploads/4520766b-9c2a-467d-a68c-44031ab9f4ba.png'
        },
        team_name: 'Los Angeles Lakers',
        team_logo_url: '/lovable-uploads/4520766b-9c2a-467d-a68c-44031ab9f4ba.png',
        media_url: '/lovable-uploads/89d98004-873f-423c-983e-8f49264b77cf.png',
        media_type: 'image',
        likes_count: 1247,
        comments_count: 89,
        is_trending: true,
        is_bot_post: true
      },
      {
        id: '2',
        content: 'Anyone else think this trade deadline is going to be absolutely insane? So many teams need to make moves! 🏀',
        created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        author: {
          display_name: 'SportsGuy23',
          avatar_url: undefined
        },
        likes_count: 156,
        comments_count: 34,
        is_trending: false,
        is_bot_post: false
      },
      {
        id: '3',
        content: '🚨 BREAKING: Major injury update that could change everything for the playoffs. This is huge for championship odds!',
        created_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
        author: {
          display_name: 'NBA News Bot',
          avatar_url: undefined
        },
        team_name: 'NBA',
        likes_count: 892,
        comments_count: 127,
        is_trending: true,
        is_bot_post: true
      }
    ];

    setTimeout(() => {
      setPosts(mockPosts);
      setLoading(false);
    }, 500);
  }, []);

  const handleLike = (postId: string) => {
    setPosts(prev => prev.map(post => 
      post.id === postId 
        ? { ...post, likes_count: post.likes_count + 1 }
        : post
    ));
  };

  if (loading) {
    return (
      <MobileLayout>
        <GlassHeader title="Spotlight" showBack={false} />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-pulse text-muted-foreground">Loading spotlight...</div>
        </div>
        <BottomNav />
      </MobileLayout>
    );
  }

  return (
    <MobileLayout>
      <GlassHeader 
        title="Spotlight" 
        subtitle="Trending sports moments"
        showBack={false} 
      />
      
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-1">
          {posts.map((post) => (
            <article key={post.id} className="bg-card border-b border-white/5 p-4">
              {/* Post header */}
              <div className="flex items-start gap-3 mb-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={post.author.avatar_url || post.team_logo_url} alt={post.author.display_name} />
                  <AvatarFallback className="bg-muted text-xs">
                    {post.author.display_name.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-foreground text-sm">
                      {post.author.display_name}
                    </span>
                    {post.is_bot_post && (
                      <Badge variant="secondary" className="text-xs h-5 bg-accent/20 text-accent border-accent/30">
                        Bot
                      </Badge>
                    )}
                    {post.is_trending && (
                      <div className="flex items-center gap-1">
                        <Flame className="h-3 w-3 text-red-500" />
                        <span className="text-xs text-red-500 font-medium">Trending</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {post.team_name && (
                      <>
                        <span>{post.team_name}</span>
                        <span>•</span>
                      </>
                    )}
                    <span>{formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</span>
                  </div>
                </div>
              </div>

              {/* Post content */}
              <div className="space-y-3">
                <p className="text-foreground leading-relaxed">
                  {post.content}
                </p>

                {/* Media */}
                {post.media_url && (
                  <div className="relative rounded-xl overflow-hidden bg-muted/10">
                    {post.media_type === 'image' ? (
                      <img
                        src={post.media_url}
                        alt="Post media"
                        className="w-full h-auto"
                        loading="lazy"
                      />
                    ) : (
                      <div className="relative aspect-video bg-black/20 flex items-center justify-center">
                        <Button variant="ghost" size="lg" className="rounded-full bg-black/50 hover:bg-black/70">
                          <Play className="h-8 w-8 text-white fill-white" />
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleLike(post.id)}
                      className="flex items-center gap-2 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 p-2"
                    >
                      <Heart className="h-4 w-4" />
                      <span className="text-sm">{post.likes_count}</span>
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex items-center gap-2 text-muted-foreground hover:text-blue-500 hover:bg-blue-500/10 p-2"
                    >
                      <MessageCircle className="h-4 w-4" />
                      <span className="text-sm">{post.comments_count}</span>
                    </Button>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-foreground p-2"
                  >
                    <Share className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
      
      <BottomNav />
    </MobileLayout>
  );
};