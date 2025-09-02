import { useEffect } from 'react';
import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

export const useJoinRequestNotifications = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;

    // Listen for new join requests for huddles owned by current user
    const channel = supabase
      .channel('join-request-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'huddle_join_requests',
          filter: `status=eq.pending`
        },
        async (payload) => {
          // Check if this request is for a huddle owned by current user
          const { data: huddle } = await supabase
            .from('huddles')
            .select('id, name, owner_id')
            .eq('id', payload.new.huddle_id)
            .eq('owner_id', user.id)
            .single();

          if (huddle) {
            // Get requester profile
            const { data: profile } = await supabase
              .from('profiles')
              .select('display_name, username')
              .eq('user_id', payload.new.user_id)
              .single();

            const requesterName = profile?.display_name || profile?.username || 'Someone';

            toast({
              title: "New Join Request",
              description: `${requesterName} wants to join "${huddle.name}"`,
              action: (
                <ToastAction 
                  onClick={() => navigate(`/huddle/${huddle.id}/settings`)}
                  altText="Review request"
                >
                  Review
                </ToastAction>
              ),
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, toast, navigate]);
};