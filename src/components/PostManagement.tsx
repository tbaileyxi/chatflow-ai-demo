import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, Calendar, Eye, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { format } from 'date-fns';

interface Post {
  id: string;
  content: string;
  created_at: string;
  scheduled_at?: string;
  message_type: string;
  target_audience: string[];
  is_spotlight: boolean;
  delivery_status: string;
  teams?: { name: string };
}

export function PostManagement() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select(`
          id,
          content,
          created_at,
          scheduled_at,
          message_type,
          target_audience,
          is_spotlight,
          delivery_status,
          teams:teams!team_id(name)
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setPosts(data || []);
    } catch (error) {
      console.error('Error fetching posts:', error);
      toast({
        title: "Error",
        description: "Failed to fetch posts",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePost = async (postId: string) => {
    setDeleting(postId);
    try {
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', postId);

      if (error) throw error;

      setPosts(posts.filter(post => post.id !== postId));
      toast({
        title: "Success",
        description: "Post deleted successfully"
      });
    } catch (error) {
      console.error('Error deleting post:', error);
      toast({
        title: "Error",
        description: "Failed to delete post",
        variant: "destructive"
      });
    } finally {
      setDeleting(null);
    }
  };

  const getStatusBadge = (post: Post) => {
    if (post.scheduled_at && new Date(post.scheduled_at) > new Date()) {
      return <Badge variant="outline" className="flex items-center gap-1"><Clock className="w-3 h-3" />Scheduled</Badge>;
    }
    if (post.delivery_status === 'sent') {
      return <Badge variant="default">Published</Badge>;
    }
    if (post.delivery_status === 'failed') {
      return <Badge variant="destructive">Failed</Badge>;
    }
    return <Badge variant="secondary">Draft</Badge>;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="text-muted-foreground">Loading posts...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="w-5 h-5" />
          Post Management
        </CardTitle>
      </CardHeader>
      <CardContent>
        {posts.length === 0 ? (
          <Alert>
            <AlertDescription>No posts found.</AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <div key={post.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="text-sm font-medium line-clamp-2">{post.content}</p>
                    <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                      <span>Type: {post.message_type}</span>
                      <span>•</span>
                      <span>Created: {format(new Date(post.created_at), 'MMM d, yyyy HH:mm')}</span>
                      {post.scheduled_at && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(post.scheduled_at), 'MMM d, yyyy HH:mm')}
                          </span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      {getStatusBadge(post)}
                      {post.is_spotlight && <Badge variant="secondary">Spotlight</Badge>}
                      {post.target_audience.map((audience) => (
                        <Badge key={audience} variant="outline" className="text-xs">
                          {audience.replace('_', ' ')}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="sm"
                        disabled={deleting === post.id}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Post</AlertDialogTitle>
                        <AlertDialogDescription>
                          <div className="space-y-2">
                            <p>Are you sure you want to delete this post? This action cannot be undone.</p>
                            <div className="p-3 bg-muted rounded-lg">
                              <p className="text-sm font-medium">Post Preview:</p>
                              <p className="text-sm mt-1 line-clamp-3">{post.content}</p>
                              <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                                <span>Created: {new Date(post.created_at).toLocaleDateString()}</span>
                                <span>Type: {post.message_type}</span>
                                <span>Status: {post.delivery_status}</span>
                              </div>
                            </div>
                          </div>
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDeletePost(post.id)}>
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}