import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PostCard } from "@/components/PostCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ChevronUp, ChevronDown, Flag, Share } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow, format, isToday, isYesterday, startOfDay } from "date-fns";

interface SpotlightPost {
  id: string;
  content: string;
  media_url?: string;
  poll_data?: any;
  created_at: string;
  team: {
    id: string;
    name: string;
    logo_url?: string;
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

  useEffect(() => {
    fetchSpotlightPosts();
  }, [user]);

  const fetchSpotlightPosts = async () => {
    try {
      const { data: posts, error } = await supabase
        .from("posts")
        .select(`
          id,
          content,
          media_url,
          poll_data,
          created_at,
          team:teams(id, name, logo_url),
          post_reactions(reaction_type)
        `)
        .contains('target_audience', ['spotlight'])
        .eq("delivery_status", "sent")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      // Fetch vote scores and user votes for each post
      const postsWithVotes = await Promise.all(
        (posts || []).map(async (post) => {
          const [voteScoreResult, userVoteResult, reportResult] = await Promise.all([
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
              .single() : Promise.resolve({ data: null })
          ]);

          return {
            ...post,
            vote_score: voteScoreResult.data || 0,
            user_vote: userVoteResult.data?.vote_type || null,
            has_reported: !!reportResult.data
          };
        })
      );

      // Group posts by date
      const grouped = groupPostsByDate(postsWithVotes);
      setPosts(postsWithVotes);
      setGroupedPosts(grouped);
      
      // Set active tab to first available date
      const dates = Object.keys(grouped);
      if (dates.length > 0) {
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

    try {
      const currentPost = posts.find(p => p.id === postId);
      const currentVote = currentPost?.user_vote;

      if (currentVote === voteType) {
        // Remove vote
        await supabase
          .from('spotlight_votes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id);
      } else {
        // Add or update vote
        await supabase
          .from('spotlight_votes')
          .upsert({
            post_id: postId,
            user_id: user.id,
            vote_type: voteType
          });
      }

      // Refresh posts to get updated vote scores
      await fetchSpotlightPosts();
    } catch (error) {
      console.error("Error voting:", error);
      toast({
        title: "Error",
        description: "Failed to submit vote",
        variant: "destructive"
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
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${post.team.name} on Side Huddle`,
          text: post.content,
          url: window.location.origin
        });
      } catch (error) {
        console.log("Share cancelled");
      }
    } else {
      // Fallback - copy to clipboard
      const shareText = `${post.team.name}: ${post.content}\n\nJoin the conversation on Side Huddle: ${window.location.origin}`;
      navigator.clipboard.writeText(shareText);
      toast({
        title: "Copied to clipboard",
        description: "Share link copied to your clipboard"
      });
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
  
  if (dates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6">
        <h3 className="text-xl font-semibold mb-2">No spotlight content yet</h3>
        <p className="text-muted-foreground">Spotlight posts will appear here!</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-auto bg-card border-b border-border rounded-none">
          {dates.slice(0, 5).map((date) => (
            <TabsTrigger 
              key={date}
              value={date} 
              className="text-sm font-medium data-[state=active]:bg-spotlight data-[state=active]:text-primary-foreground"
            >
              {getDateLabel(date)}
            </TabsTrigger>
          ))}
        </TabsList>
        
        {dates.map((date) => (
          <TabsContent key={date} value={date} className="flex-1 mt-0 overflow-y-auto">
            <div className="space-y-1">
              {groupedPosts[date]?.map((post) => (
                <div key={post.id} className="relative">
                  <PostCard post={post} isSpotlight />
                  
                  {/* Voting and Actions Overlay */}
                  <div className="absolute top-4 right-4 flex flex-col gap-2">
                    {/* Vote Score Display */}
                    <div className="bg-background/90 backdrop-blur-sm border rounded-lg p-2 flex flex-col items-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleVote(post.id, 'up')}
                        className={`p-1 h-auto ${post.user_vote === 'up' ? 'text-green-600' : 'text-muted-foreground hover:text-green-600'}`}
                      >
                        <ChevronUp className="w-4 h-4" />
                      </Button>
                      
                      <span className="text-sm font-semibold py-1">
                        {post.vote_score || 0}
                      </span>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleVote(post.id, 'down')}
                        className={`p-1 h-auto ${post.user_vote === 'down' ? 'text-red-600' : 'text-muted-foreground hover:text-red-600'}`}
                      >
                        <ChevronDown className="w-4 h-4" />
                      </Button>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="bg-background/90 backdrop-blur-sm border rounded-lg p-1 flex flex-col gap-1">
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