import React, { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PostCard } from "@/components/PostCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ChevronUp, ChevronDown, Flag, Share, Plus, CalendarDays } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow, format, isToday, isYesterday, startOfDay } from "date-fns";

interface SpotlightPost {
  id: string;
  content: string;
  media_url?: string;
  poll_data?: any;
  created_at: string;
  author_id?: string;
  is_agent_post?: boolean;
  is_team_agent_message?: boolean;
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
  vote_score?: number;
  user_vote?: 'up' | 'down' | null;
  has_reported?: boolean;
}

interface GroupedPosts {
  [date: string]: SpotlightPost[];
}

export const EnhancedSpotlightFeed = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [posts, setPosts] = useState<SpotlightPost[]>([]);
  const [groupedPosts, setGroupedPosts] = useState<GroupedPosts>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("today");
  const [showAllDates, setShowAllDates] = useState(false);
  const tabsListRef = useRef<HTMLDivElement>(null);
  const [pendingVotes, setPendingVotes] = useState<Record<string, boolean>>({});

  // All hooks must be called before any conditional returns
  useEffect(() => {
    fetchSpotlightPosts();
  }, [user]);

  // Auto-scroll to center today's date when component mounts or activeTab changes
  useEffect(() => {
    if (tabsListRef.current && activeTab) {
      const activeTrigger = tabsListRef.current.querySelector(`[data-state="active"]`) as HTMLElement;
      if (activeTrigger) {
        const container = tabsListRef.current;
        const containerWidth = container.offsetWidth;
        const triggerLeft = activeTrigger.offsetLeft;
        const triggerWidth = activeTrigger.offsetWidth;
        const scrollPosition = triggerLeft - (containerWidth / 2) + (triggerWidth / 2);
        
        container.scrollTo({
          left: scrollPosition,
          behavior: 'smooth'
        });
      }
    }
  }, [activeTab, groupedPosts]);

  const fetchSpotlightPosts = async () => {
    try {
      const { data: posts, error } = await supabase
        .from("posts")
        .select(`
          id,
          content,
          media_url,
          embed_code,
          poll_data,
          created_at,
          author_id,
          is_agent_post,
          is_team_agent_message,
          team:teams(id, name, logo_url, sponsor),
          post_reactions(reaction_type)
        `)
        .contains('target_audience', ['spotlight'])
        .eq("delivery_status", "sent")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      // Fetch vote scores, user votes, and author profiles for each post
      const postsWithVotes = await Promise.all(
        (posts || []).map(async (post) => {
          const [voteScoreResult, userVoteResult, reportResult, authorResult] = await Promise.all([
            supabase.rpc('calculate_post_vote_score', { post_uuid: post.id }),
            user ? supabase
              .from('spotlight_votes')
              .select('vote_type')
              .eq('post_id', post.id)
              .eq('user_id', user.id)
              .single() : Promise.resolve({ data: null }),
            user ? supabase
              .from('spotlight_reports')
              .select('id')
              .eq('post_id', post.id)
              .eq('user_id', user.id)
              .single() : Promise.resolve({ data: null }),
            post.author_id ? supabase
              .from('profiles')
              .select('display_name, username, avatar_url')
              .eq('user_id', post.author_id)
              .single() : Promise.resolve({ data: null })
          ]);

          return {
            ...post,
            vote_score: voteScoreResult.data || 0,
            user_vote: userVoteResult.data?.vote_type || null,
            has_reported: !!reportResult.data,
            author: authorResult.data
          };
        })
      );

      // Group posts by date
      const grouped = groupPostsByDate(postsWithVotes);
      setPosts(postsWithVotes);
      setGroupedPosts(grouped);
      
      // Set active tab to "today" if it exists, otherwise first available date
      const dates = Object.keys(grouped);
      const todayKey = getDateKey(new Date());
      if (dates.includes(todayKey)) {
        setActiveTab(todayKey);
      } else if (dates.length > 0) {
        setActiveTab(dates[0]);
      }
    } catch (error) {
      console.error("Error fetching spotlight posts:", error);
    } finally {
      setLoading(false);
    }
  };

  const groupPostsByDate = (posts: SpotlightPost[]): GroupedPosts => {
    const grouped: GroupedPosts = {};
    
    posts.forEach(post => {
      const postDate = new Date(post.created_at);
      const dateKey = getDateKey(postDate);
      
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(post);
    });

    // Sort posts within each date by vote score
    Object.keys(grouped).forEach(date => {
      grouped[date].sort((a, b) => (b.vote_score || 0) - (a.vote_score || 0));
    });

    return grouped;
  };

  const getDateKey = (date: Date): string => {
    if (isToday(date)) return "today";
    if (isYesterday(date)) return "yesterday";
    return format(date, "MMM d");
  };

  const getDateLabel = (dateKey: string): string => {
    if (dateKey === "today") return "Today";
    if (dateKey === "yesterday") return "Yesterday";
    return dateKey;
  };

  const handleVote = async (postId: string, voteType: 'up' | 'down') => {
    if (!user) {
      toast({
        title: "Please sign in",
        description: "You need to be logged in to vote",
        variant: "destructive"
      });
      return;
    }

    if (pendingVotes[postId]) return;

    const currentPost = posts.find(p => p.id === postId);
    const currentVote = currentPost?.user_vote ?? null;
    const prevScore = currentPost?.vote_score || 0;

    let nextVote: 'up' | 'down' | null;
    let delta = 0;
    if (currentVote === voteType) {
      nextVote = null;
      delta = voteType === 'up' ? -1 : +1;
    } else if (currentVote === null) {
      nextVote = voteType;
      delta = voteType === 'up' ? +1 : -1;
    } else {
      nextVote = voteType;
      delta = voteType === 'up' ? +2 : -2;
    }

    // Optimistic update for instant UI feedback
    setPendingVotes(prev => ({ ...prev, [postId]: true }));
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, user_vote: nextVote, vote_score: (p.vote_score || 0) + delta } : p));

    if (currentPost) {
      const dateKey = getDateKey(new Date(currentPost.created_at));
      setGroupedPosts(prev => {
        const group = { ...prev };
        const list = (group[dateKey] || []).map(p => p.id === postId ? { ...p, user_vote: nextVote, vote_score: (p.vote_score || 0) + delta } : p);
        list.sort((a, b) => (b.vote_score || 0) - (a.vote_score || 0));
        return { ...group, [dateKey]: list };
      });
    }

    try {
      if (currentVote === voteType) {
        // Remove vote
        const { error } = await supabase
          .from('spotlight_votes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id);
        if (error) throw error;
      } else {
        // Add or update vote
        const { error } = await supabase
          .from('spotlight_votes')
          .upsert({
            post_id: postId,
            user_id: user.id,
            vote_type: voteType
          }, {
            onConflict: 'post_id,user_id'
          });
        if (error) throw error;
      }

      // Background verify server score for accuracy (doesn't block UI)
      const { data: serverScore } = await supabase.rpc('calculate_post_vote_score', { post_uuid: postId });
      if (typeof serverScore === 'number') {
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, vote_score: serverScore } : p));
        if (currentPost) {
          const dateKey = getDateKey(new Date(currentPost.created_at));
          setGroupedPosts(prev => {
            const group = { ...prev };
            const list = (group[dateKey] || []).map(p => p.id === postId ? { ...p, vote_score: serverScore } : p);
            list.sort((a, b) => (b.vote_score || 0) - (a.vote_score || 0));
            return { ...group, [dateKey]: list };
          });
        }
      }
    } catch (error) {
      console.error("Error voting:", error);
      // Revert optimistic update on error
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, user_vote: currentVote, vote_score: prevScore } : p));
      if (currentPost) {
        const dateKey = getDateKey(new Date(currentPost.created_at));
        setGroupedPosts(prev => {
          const group = { ...prev };
          const list = (group[dateKey] || []).map(p => p.id === postId ? { ...p, user_vote: currentVote, vote_score: prevScore } : p);
          list.sort((a, b) => (b.vote_score || 0) - (a.vote_score || 0));
          return { ...group, [dateKey]: list };
        });
      }
      toast({
        title: "Error",
        description: "Failed to submit vote",
        variant: "destructive"
      });
    } finally {
      setPendingVotes(prev => {
        const { [postId]: _, ...rest } = prev;
        return rest;
      });
    }
  };

  const handleReport = async (postId: string, reason: string) => {
    if (!user) {
      toast({
        title: "Please sign in",
        description: "You need to be logged in to report posts",
        variant: "destructive"
      });
      return;
    }

    try {
      await supabase
        .from('spotlight_reports')
        .insert({
          post_id: postId,
          user_id: user.id,
          reason: reason
        });

      toast({
        title: "Report submitted",
        description: "Thank you for helping keep our community safe"
      });

      // Update the post to show it's been reported
      setPosts(prev => prev.map(p => 
        p.id === postId ? { ...p, has_reported: true } : p
      ));
    } catch (error) {
      console.error("Error reporting post:", error);
      toast({
        title: "Error",
        description: "Failed to submit report",
        variant: "destructive"
      });
    }
  };

  const handleShare = async (post: SpotlightPost) => {
    const deepLink = `${window.location.origin}/spotlight/${post.id}`;
    const authorName = post.author?.display_name || post.team.name;
    const mediaIndicator = post.media_url ? ` (${post.media_url.includes('video') ? 'video' : 'image'})` : '';
    
    // Single text format that works best across platforms
    const shareText = `"${post.content}" by ${authorName} on Side Huddle${mediaIndicator}\n\nView post: ${deepLink}`;
    
    try {
      if (navigator.share) {
        await navigator.share({
          text: shareText
        });
      } else {
        await navigator.clipboard.writeText(shareText);
        toast({
          title: "Link copied!",
          description: "Post link copied to clipboard"
        });
      }
    } catch (error) {
      console.error('Share error:', error);
      try {
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading spotlight...</div>
      </div>
    );
  }

  const dates = Object.keys(groupedPosts);
  const visibleDates = showAllDates ? dates : dates.slice(0, 7);
  const todayKey = getDateKey(new Date());
  
  if (dates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6">
        <CalendarDays className="w-12 h-12 text-muted-foreground mb-4" />
        <h3 className="text-xl font-semibold mb-2">No spotlight content yet</h3>
        <p className="text-muted-foreground">Spotlight posts will appear here!</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        {/* Enhanced Date Navigation */}
        <div className="bg-card border-b border-border">
          <div className="relative">
            <TabsList 
              ref={tabsListRef}
              className="flex w-full bg-transparent border-0 rounded-none overflow-x-auto overflow-y-hidden scrollbar-none scroll-smooth px-4 py-2"
              style={{ 
                scrollSnapType: 'x mandatory',
                WebkitOverflowScrolling: 'touch'
              }}
            >
              {/* Left padding for proper centering */}
              <div className="flex-shrink-0 w-16"></div>
              
              {visibleDates.map((date) => {
                const isToday = date === todayKey;
                const isActive = activeTab === date;
                
                return (
                  <TabsTrigger 
                    key={date}
                    value={date}
                    className={`
                      text-sm font-medium whitespace-nowrap px-4 py-2.5 min-w-fit flex-shrink-0 mx-1
                      transition-all duration-200 rounded-full
                      ${isToday ? 'ring-2 ring-spotlight/30' : ''}
                      ${isActive ? 'bg-spotlight text-white shadow-lg' : 'hover:bg-muted'}
                      data-[state=active]:bg-spotlight data-[state=active]:text-white
                      data-[state=active]:shadow-lg
                      scroll-snap-align: center
                    `}
                    style={{ scrollSnapAlign: 'center' }}
                  >
                    <span className={isToday ? 'font-bold' : ''}>
                      {getDateLabel(date)}
                    </span>
                    {isToday && (
                      <span className="ml-1 w-2 h-2 bg-white rounded-full inline-block opacity-80"></span>
                    )}
                  </TabsTrigger>
                );
              })}
              
              {/* Right padding for proper centering */}
              <div className="flex-shrink-0 w-16"></div>
            </TabsList>
            
            {/* Plus Button for showing more dates */}
            {dates.length > 7 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAllDates(!showAllDates)}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 p-0 bg-card border border-border shadow-sm hover:bg-muted rounded-full"
                title={showAllDates ? "Show fewer dates" : "Show all dates"}
              >
                <Plus className={`w-4 h-4 transition-transform duration-200 ${showAllDates ? 'rotate-45' : ''}`} />
              </Button>
            )}
            
            {/* Date count indicator */}
            {!showAllDates && dates.length > 7 && (
              <div className="absolute right-12 top-1/2 -translate-y-1/2 text-xs text-muted-foreground bg-card border border-border rounded-full px-2 py-1 shadow-sm">
                +{dates.length - 7}
              </div>
            )}
          </div>
        </div>
        
        {dates.map((date) => (
          <TabsContent key={date} value={date} className="flex-1 mt-0 overflow-y-auto">
            <div className="space-y-4">
              {groupedPosts[date]?.map((post) => (
                <div key={post.id} className="bg-card rounded-lg border overflow-hidden">
                  <PostCard post={post} isSpotlight />
                  
                  {/* Bottom Action Bar */}
                  <div className="border-t bg-card/50 p-3 flex items-center justify-between">
                    {/* Voting Section */}
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleVote(post.id, 'up')}
                          disabled={!!pendingVotes[post.id]}
                          aria-busy={pendingVotes[post.id] ? true : undefined}
                          className={`p-2 h-auto ${post.user_vote === 'up' ? 'text-green-600 bg-green-50' : 'text-muted-foreground hover:text-green-600'}`}
                        >
                          <ChevronUp className="w-4 h-4" />
                        </Button>
                        
                        <span className="text-sm font-semibold min-w-[2rem] text-center">
                          {post.vote_score || 0}
                        </span>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleVote(post.id, 'down')}
                          disabled={!!pendingVotes[post.id]}
                          aria-busy={pendingVotes[post.id] ? true : undefined}
                          className={`p-2 h-auto ${post.user_vote === 'down' ? 'text-red-600 bg-red-50' : 'text-muted-foreground hover:text-red-600'}`}
                        >
                          <ChevronDown className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleShare(post)}
                        className="p-2 h-auto text-muted-foreground hover:text-primary"
                        title="Share"
                      >
                        <Share className="w-4 h-4" />
                      </Button>
                      
                      {!post.has_reported && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleReport(post.id, 'inappropriate_content')}
                          className="p-2 h-auto text-muted-foreground hover:text-red-600"
                          title="Report"
                        >
                          <Flag className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};