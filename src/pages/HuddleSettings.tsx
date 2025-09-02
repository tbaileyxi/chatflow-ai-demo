import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MobileLayout } from '@/components/mobile/MobileLayout';
import { GlassHeader } from '@/components/mobile/GlassHeader';
import { HuddleManagement } from '@/components/HuddleManagement';
import { HuddleMembersManager } from '@/components/HuddleMembersManager';
import { HuddleVerificationDialog } from '@/components/HuddleVerificationDialog';
import { HuddleRequestsManager } from '@/components/HuddleRequestsManager';
import { PickEmSettingsCard } from '@/components/PickEmSettingsCard';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useHuddleSubscription } from '@/hooks/useHuddleSubscription';
import { useJoinRequestNotifications } from '@/hooks/useJoinRequestNotifications';
import { useToast } from '@/hooks/use-toast';

interface HuddleData {
  id: string;
  name: string;
  owner_id: string;
  team: {
    name: string;
    logo_url?: string;
  };
}

export const HuddleSettings = () => {
  const { huddleId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [huddle, setHuddle] = useState<HuddleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  
  // Subscription status for verification
  const { subscriptionStatus, refreshSubscriptionStatus } = useHuddleSubscription(huddleId || '');
  const { toast } = useToast();
  const isOwner = user?.id === huddle?.owner_id;
  
  // Enable join request notifications for huddle owners
  useJoinRequestNotifications();

  useEffect(() => {
    if (!huddleId) return;

    const fetchHuddle = async () => {
      try {
        const { data, error } = await supabase
          .from('huddles')
          .select(`
            id,
            name,
            owner_id,
            team:teams(name, logo_url)
          `)
          .eq('id', huddleId)
          .single();

        if (error) throw error;
        setHuddle(data);

        // Check if user is admin
        if (user) {
          const { data: roleData } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', user.id)
            .eq('role', 'admin')
            .single();
          
          setIsAdmin(!!roleData);
        }

        // Fetch pending requests count for owner
        if (user?.id === data.owner_id) {
          const { data: requestsData } = await supabase
            .from('huddle_join_requests')
            .select('id')
            .eq('huddle_id', huddleId)
            .eq('status', 'pending');
          
          setPendingRequestsCount(requestsData?.length || 0);
        }
      } catch (error) {
        console.error('Error fetching huddle:', error);
        navigate('/app');
      } finally {
        setLoading(false);
      }
    };

    fetchHuddle();
  }, [huddleId, navigate, user]);

  // Real-time updates for pending requests count
  useEffect(() => {
    if (!user || !isOwner) return;

    const channel = supabase
      .channel('pending-requests-count')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'huddle_join_requests',
          filter: `huddle_id=eq.${huddleId}`
        },
        async () => {
          // Refetch pending requests count
          const { data: requestsData } = await supabase
            .from('huddle_join_requests')
            .select('id')
            .eq('huddle_id', huddleId)
            .eq('status', 'pending');
          
          setPendingRequestsCount(requestsData?.length || 0);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [huddleId, user, isOwner]);

  // Check for verification success/failure on URL parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const verificationStatus = urlParams.get('verified');
    const sessionId = urlParams.get('session_id');

    if (verificationStatus === 'success' && sessionId && isOwner) {
      // Call check-huddle-subscription to verify the payment
      const verifySubscription = async () => {
        try {
          const { error } = await supabase.functions.invoke('check-huddle-subscription', {
            body: { sessionId }
          });

          if (error) throw error;

          // Refresh subscription status
          refreshSubscriptionStatus();
          
          toast({
            title: "Huddle Verified!",
            description: "Your huddle is now officially verified.",
          });
        } catch (error: any) {
          console.error('Verification error:', error);
          toast({
            title: "Verification Error",
            description: error.message || "Failed to verify subscription",
            variant: "destructive",
          });
        }
      };

      verifySubscription();
      
      // Clean up URL parameters
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    } else if (verificationStatus === 'cancelled') {
      toast({
        title: "Payment Cancelled",
        description: "Huddle verification was cancelled.",
      });
      
      // Clean up URL parameters
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }
  }, [isOwner, refreshSubscriptionStatus, toast]);

  if (loading) {
    return (
      <MobileLayout hasBottomNav={false}>
        <GlassHeader title="Loading..." />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-pulse text-muted-foreground">Loading huddle settings...</div>
        </div>
      </MobileLayout>
    );
  }

  if (!huddle) {
    return (
      <MobileLayout hasBottomNav={false}>
        <GlassHeader title="Huddle not found" />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">This huddle could not be found.</p>
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout hasBottomNav={false}>
      <GlassHeader
        title="Huddle Settings"
        subtitle={huddle.name}
        teamLogo={huddle.team?.logo_url}
      />
      
      <div className="flex-1 p-4">
        <div className="space-y-6">
          {/* Verification Section - Only for owners */}
          {isOwner && (
            <div className="bg-card/50 backdrop-blur-sm border border-white/10 rounded-xl p-4">
              <h3 className="text-lg font-semibold mb-4 text-foreground">Huddle Verification</h3>
              <HuddleVerificationDialog
                huddleId={huddle.id}
                isVerified={subscriptionStatus?.is_verified || false}
                trigger={
                  <div className="w-full">
                    {subscriptionStatus?.is_verified ? (
                      <div className="flex items-center gap-2 text-verified-primary">
                        <div className="w-2 h-2 bg-verified-primary rounded-full"></div>
                        <span className="text-sm font-medium">This huddle is verified</span>
                      </div>
                    ) : null}
                  </div>
                }
              />
            </div>
          )}

          {/* Join Requests Management - Only for verified huddle owners */}
          {isOwner && subscriptionStatus?.is_verified && (
            <div className="relative">
              {pendingRequestsCount > 0 && (
                <div className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold z-10">
                  {pendingRequestsCount}
                </div>
              )}
              <HuddleRequestsManager huddleId={huddle.id} isOwner={isOwner} />
            </div>
          )}

          {/* Pick 'Em Settings */}
          <PickEmSettingsCard huddleId={huddle.id} isOwner={isOwner} />

          <div className="bg-card/50 backdrop-blur-sm border border-white/10 rounded-xl p-4">
            <h3 className="text-lg font-semibold mb-4 text-foreground">Huddle Management</h3>
            <HuddleManagement 
              huddleId={huddle.id} 
              ownerId={huddle.owner_id} 
              huddle={huddle} 
            />
          </div>
          
          {(user?.id === huddle.owner_id || isAdmin) && (
            <HuddleMembersManager
              huddleId={huddle.id}
              ownerId={huddle.owner_id}
              isOwner={user?.id === huddle.owner_id}
              isAdmin={isAdmin}
            />
          )}
        </div>
      </div>
    </MobileLayout>
  );
};