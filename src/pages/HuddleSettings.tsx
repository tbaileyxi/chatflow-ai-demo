import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MobileLayout } from '@/components/mobile/MobileLayout';
import { GlassHeader } from '@/components/mobile/GlassHeader';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { HuddleManagement } from '@/components/HuddleManagement';
import { HuddleMembersManager } from '@/components/HuddleMembersManager';
import { HuddleVerificationDialog } from '@/components/HuddleVerificationDialog';
import { HuddleRequestsManager } from '@/components/HuddleRequestsManager';
import { PickEmSettingsCard } from '@/components/PickEmSettingsCard';
import { HuddleMembershipPricing } from '@/components/HuddleMembershipPricing';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useHuddleSubscription } from '@/hooks/useHuddleSubscription';
import { useJoinRequestNotifications } from '@/hooks/useJoinRequestNotifications';
import { useToast } from '@/hooks/use-toast';
import { Shield, RefreshCw, Save } from 'lucide-react';

interface HuddleData {
  id: string;
  name: string;
  owner_id: string;
  bio?: string;
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
  const [bio, setBio] = useState('');
  const [bioSaving, setBioSaving] = useState(false);
  
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
            bio,
            team:teams!team_id(name, logo_url)
          `)
          .eq('id', huddleId)
          .single();

        if (error) throw error;
        setHuddle(data);
        setBio(data.bio || '');

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

  const handleSaveBio = async () => {
    if (!isOwner || !huddleId) return;
    
    setBioSaving(true);
    try {
      const { error } = await supabase
        .from('huddles')
        .update({ bio: bio.trim() || null })
        .eq('id', huddleId);

      if (error) throw error;

      toast({
        title: "Bio Updated",
        description: "Your huddle bio has been saved successfully.",
      });
    } catch (error: any) {
      console.error('Error updating bio:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update bio",
        variant: "destructive",
      });
    } finally {
      setBioSaving(false);
    }
  };

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
        onBack={() => navigate(`/huddle/${huddleId}`)}
      />
      
      <div className="flex-1 p-4">
        <div className="space-y-6">
          {/* Huddle Information - Only for owners */}
          {isOwner && (
            <div className="bg-card/50 backdrop-blur-sm border border-white/10 rounded-xl p-4">
              <h3 className="text-lg font-semibold text-foreground mb-4">Huddle Information</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">
                    Bio ({bio.length}/280)
                  </label>
                  <Textarea
                    value={bio}
                    onChange={(e) => {
                      if (e.target.value.length <= 280) {
                        setBio(e.target.value);
                      }
                    }}
                    placeholder="Describe your huddle to attract new members..."
                    className="min-h-[100px] resize-none"
                    maxLength={280}
                  />
                </div>
                <Button 
                  onClick={handleSaveBio}
                  disabled={bioSaving}
                  size="sm"
                  className="w-full"
                >
                  {bioSaving ? (
                    <>
                      <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Verification Section - Only for owners */}
          {isOwner && (
            <div className="bg-card/50 backdrop-blur-sm border border-white/10 rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-foreground">Huddle Verification</h3>
                {!subscriptionStatus?.is_verified && (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => refreshSubscriptionStatus()}
                    className="text-xs"
                  >
                    <RefreshCw className="w-3 h-3 mr-1" />
                    Refresh
                  </Button>
                )}
              </div>
              {subscriptionStatus?.is_verified ? (
                <div className="flex items-center gap-3 p-3 bg-verified-background border border-verified-border rounded-lg">
                  <Shield className="w-5 h-5 text-verified-primary shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium text-verified-primary">Verified Huddle</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Status: Active | Expires: {subscriptionStatus.expires_at ? new Date(subscriptionStatus.expires_at).toLocaleDateString() : 'N/A'}
                    </p>
                  </div>
                </div>
              ) : (
                <HuddleVerificationDialog
                  huddleId={huddle.id}
                  isVerified={false}
                />
              )}
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

          {/* Membership Pricing - Only for verified huddle owners */}
          {isOwner && subscriptionStatus?.is_verified && (
            <HuddleMembershipPricing huddleId={huddle.id} isOwner={isOwner} />
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