import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Eye, CheckCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ReportedPost {
  id: string;
  post_id: string;
  user_id: string;
  reason: string;
  status: string;
  created_at: string;
  posts: {
    id: string;
    content: string;
    media_url?: string;
    created_at: string;
    team: {
      name: string;
      logo_url?: string;
    };
  };
  profiles: {
    display_name?: string;
    username?: string;
  };
}

export const ModerationPanel = () => {
  const { toast } = useToast();
  const [reports, setReports] = useState<ReportedPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      // First get reports
      const { data: reportsData, error: reportsError } = await supabase
        .from('spotlight_reports')
        .select(`
          id,
          post_id,
          user_id,
          reason,
          status,
          created_at
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (reportsError) throw reportsError;

      // Then get related data for each report
      const reportsWithData = await Promise.all(
        (reportsData || []).map(async (report) => {
          const [postResult, profileResult] = await Promise.all([
            supabase
              .from('posts')
              .select(`
                id,
                content,
                media_url,
                created_at,
                team:teams!team_id(name, logo_url)
              `)
              .eq('id', report.post_id)
              .single(),
            supabase.rpc('get_public_profile', { target_user_id: report.user_id })
          ]);

          return {
            ...report,
            posts: postResult.data || { id: '', content: '', created_at: '', team: { name: '', logo_url: '' } },
            profiles: profileResult.data?.[0] || { display_name: '', username: '' }
          };
        })
      );

      setReports(reportsWithData);
    } catch (error) {
      console.error("Error fetching reports:", error);
      toast({
        title: "Error",
        description: "Failed to load reports",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePost = async (reportId: string, postId: string) => {
    try {
      // Delete the post
      const { error: deleteError } = await supabase
        .from('posts')
        .delete()
        .eq('id', postId);

      if (deleteError) throw deleteError;

      // Mark report as reviewed
      const { error: updateError } = await supabase
        .from('spotlight_reports')
        .update({ 
          status: 'reviewed',
          reviewed_at: new Date().toISOString()
        })
        .eq('id', reportId);

      if (updateError) throw updateError;

      toast({
        title: "Post deleted",
        description: "The reported post has been removed"
      });

      // Refresh reports
      fetchReports();
    } catch (error) {
      console.error("Error deleting post:", error);
      toast({
        title: "Error",
        description: "Failed to delete post",
        variant: "destructive"
      });
    }
  };

  const handleDismissReport = async (reportId: string) => {
    try {
      const { error } = await supabase
        .from('spotlight_reports')
        .update({ 
          status: 'dismissed',
          reviewed_at: new Date().toISOString()
        })
        .eq('id', reportId);

      if (error) throw error;

      toast({
        title: "Report dismissed",
        description: "The report has been marked as reviewed"
      });

      // Refresh reports
      fetchReports();
    } catch (error) {
      console.error("Error dismissing report:", error);
      toast({
        title: "Error",
        description: "Failed to dismiss report",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Loading reports...</div>
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="text-center p-8">
        <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">No pending reports</h3>
        <p className="text-muted-foreground">All reports have been reviewed!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Content Moderation</h2>
        <Badge variant="destructive" className="text-sm">
          {reports.length} pending report{reports.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      <div className="space-y-4">
        {reports.map((report) => (
          <Card key={report.id} className="p-6">
            <div className="space-y-4">
              {/* Report Header */}
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-semibold text-red-600">
                    Reported by {report.profiles?.display_name || report.profiles?.username || 'Anonymous'}
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(report.created_at), { addSuffix: true })}
                  </p>
                  <Badge variant="outline" className="mt-1">
                    {report.reason.replace(/_/g, ' ')}
                  </Badge>
                </div>
              </div>

              {/* Reported Post */}
              <div className="border rounded-lg p-4 bg-muted/30">
                <div className="flex items-center gap-2 mb-2">
                  {report.posts.team.logo_url && (
                    <img 
                      src={report.posts.team.logo_url} 
                      alt={report.posts.team.name}
                      className="w-6 h-6 rounded-full"
                    />
                  )}
                  <span className="font-medium">{report.posts.team.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(report.posts.created_at), { addSuffix: true })}
                  </span>
                </div>
                
                <p className="text-foreground mb-2">{report.posts.content}</p>
                
                {report.posts.media_url && (
                  <div className="mt-2">
                    <img 
                      src={report.posts.media_url} 
                      alt="Post media"
                      className="max-w-xs rounded-lg"
                    />
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => handleDismissReport(report.id)}
                  className="text-muted-foreground"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Dismiss Report
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => handleDeletePost(report.id, report.posts.id)}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Post
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};