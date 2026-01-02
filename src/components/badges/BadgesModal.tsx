import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Check, Sparkles, Star, Crown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Team {
  id: string;
  name: string;
  city: string;
  logo_url?: string;
  league?: string;
}

interface UserBadge {
  id: string;
  team_id: string;
  tier: 'basic' | 'superfan';
  is_active: boolean;
  team_name?: string;
  team_logo_url?: string;
}

interface BadgesModalProps {
  open: boolean;
  onClose: () => void;
  team1?: Team | null;
  team2?: Team | null;
  currentTeamId?: string;
}

const BADGE_PRODUCTS = {
  basic: {
    name: 'Fan Badge',
    price: 4.99,
    description: 'Show your team pride',
    icon: Star,
    color: 'text-blue-400'
  },
  superfan: {
    name: 'Superfan Badge',
    price: 24.99,
    description: 'Premium badge with glow effect',
    icon: Crown,
    color: 'text-yellow-400'
  }
};

export function BadgesModal({ open, onClose, team1, team2, currentTeamId }: BadgesModalProps) {
  const { user } = useAuth();
  const [userBadges, setUserBadges] = useState<UserBadge[]>([]);
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(team1 || team2 ? 'event' : 'all');

  // Fetch user's badges
  const fetchUserBadges = useCallback(async () => {
    if (!user?.id) return;
    
    const { data, error } = await supabase
      .from('user_badges')
      .select(`
        id,
        team_id,
        tier,
        is_active,
        teams:team_id (name, logo_url)
      `)
      .eq('user_id', user.id);
    
    if (!error && data) {
      setUserBadges(data.map((b: any) => ({
        id: b.id,
        team_id: b.team_id,
        tier: b.tier,
        is_active: b.is_active,
        team_name: b.teams?.name,
        team_logo_url: b.teams?.logo_url
      })));
    }
  }, [user?.id]);

  // Fetch all teams for "All Teams" tab
  const fetchAllTeams = useCallback(async () => {
    const { data } = await supabase
      .from('teams')
      .select('id, name, city, logo_url, league')
      .eq('status', 'active')
      .order('league')
      .order('city');
    
    if (data) setAllTeams(data);
  }, []);

  useEffect(() => {
    if (open) {
      fetchUserBadges();
      fetchAllTeams();
    }
  }, [open, fetchUserBadges, fetchAllTeams]);

  // Handle badge purchase
  const handlePurchase = async (teamId: string, tier: 'basic' | 'superfan') => {
    if (!user?.id) {
      toast.error('Please sign in first');
      return;
    }

    setCheckoutLoading(`${teamId}-${tier}`);
    try {
      const { data, error } = await supabase.functions.invoke('create-badge-checkout', {
        body: { teamId, tier, userId: user.id }
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (err: any) {
      console.error('Badge checkout error:', err);
      toast.error(err.message || 'Failed to start checkout');
    } finally {
      setCheckoutLoading(null);
    }
  };

  // Handle setting active badge
  const handleSetActive = async (badgeId: string) => {
    if (!user?.id) return;

    setLoading(true);
    try {
      // Deactivate all badges first
      await supabase
        .from('user_badges')
        .update({ is_active: false })
        .eq('user_id', user.id);

      // Activate selected badge
      await supabase
        .from('user_badges')
        .update({ is_active: true })
        .eq('id', badgeId);

      toast.success('Badge activated!');
      fetchUserBadges();
    } catch (err) {
      toast.error('Failed to set active badge');
    } finally {
      setLoading(false);
    }
  };

  // Check if user has badge for team
  const getUserBadgeForTeam = (teamId: string) => {
    return userBadges.find(b => b.team_id === teamId);
  };

  // Render team badge card
  const TeamBadgeCard = ({ team, highlight = false }: { team: Team; highlight?: boolean }) => {
    const userBadge = getUserBadgeForTeam(team.id);
    
    return (
      <Card className={cn(
        "p-4 transition-all",
        highlight && "ring-2 ring-primary",
        userBadge && "bg-muted/50"
      )}>
        <CardContent className="p-0 space-y-4">
          {/* Team Header */}
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarImage src={team.logo_url} alt={team.name} />
              <AvatarFallback>{team.name.slice(0, 2)}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold">{team.city} {team.name}</p>
              <p className="text-xs text-muted-foreground">{team.league}</p>
            </div>
          </div>

          {/* User's Badge Status */}
          {userBadge ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-green-500" />
                <span>You own the {BADGE_PRODUCTS[userBadge.tier].name}</span>
                {userBadge.tier === 'superfan' && (
                  <Sparkles className="h-4 w-4 text-yellow-400" />
                )}
              </div>
              
              <Button
                size="sm"
                variant={userBadge.is_active ? "secondary" : "outline"}
                onClick={() => handleSetActive(userBadge.id)}
                disabled={loading || userBadge.is_active}
                className="w-full"
              >
                {userBadge.is_active ? (
                  <>
                    <Check className="h-4 w-4 mr-1" />
                    Active Badge
                  </>
                ) : (
                  'Set as Active'
                )}
              </Button>

              {/* Upgrade option for basic badge owners */}
              {userBadge.tier === 'basic' && (
                <Button
                  size="sm"
                  onClick={() => handlePurchase(team.id, 'superfan')}
                  disabled={checkoutLoading !== null}
                  className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 text-black hover:opacity-90"
                >
                  {checkoutLoading === `${team.id}-superfan` ? 'Loading...' : (
                    <>
                      <Crown className="h-4 w-4 mr-1" />
                      Upgrade to Superfan – ${BADGE_PRODUCTS.superfan.price}
                    </>
                  )}
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handlePurchase(team.id, 'basic')}
                disabled={checkoutLoading !== null}
                className="w-full"
              >
                {checkoutLoading === `${team.id}-basic` ? 'Loading...' : (
                  <>
                    <Star className="h-4 w-4 mr-1" />
                    Fan Badge – ${BADGE_PRODUCTS.basic.price}
                  </>
                )}
              </Button>
              
              <Button
                size="sm"
                onClick={() => handlePurchase(team.id, 'superfan')}
                disabled={checkoutLoading !== null}
                className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 text-black hover:opacity-90"
              >
                {checkoutLoading === `${team.id}-superfan` ? 'Loading...' : (
                  <>
                    <Crown className="h-4 w-4 mr-1" />
                    Superfan – ${BADGE_PRODUCTS.superfan.price}
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-yellow-400" />
            Team Badges
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid grid-cols-2 mb-4">
            {(team1 || team2) && (
              <TabsTrigger value="event">Pick Your Side</TabsTrigger>
            )}
            <TabsTrigger value="all">All Teams</TabsTrigger>
            <TabsTrigger value="my">My Badges</TabsTrigger>
          </TabsList>

          {/* Event Teams Tab */}
          {(team1 || team2) && (
            <TabsContent value="event" className="flex-1 overflow-y-auto space-y-4">
              <p className="text-sm text-muted-foreground">
                Pick your side! Get a badge to show next to your name in chat.
              </p>
              
              <div className="grid gap-4">
                {team1 && <TeamBadgeCard team={team1} highlight />}
                {team2 && <TeamBadgeCard team={team2} highlight />}
              </div>
            </TabsContent>
          )}

          {/* All Teams Tab */}
          <TabsContent value="all" className="flex-1 overflow-y-auto">
            <div className="grid gap-3">
              {allTeams.map(team => (
                <TeamBadgeCard key={team.id} team={team} />
              ))}
            </div>
          </TabsContent>

          {/* My Badges Tab */}
          <TabsContent value="my" className="flex-1 overflow-y-auto">
            {userBadges.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Crown className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p>You don't have any badges yet.</p>
                <p className="text-sm">Get a badge to show your team pride!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {userBadges.map(badge => (
                  <Card key={badge.id} className={cn(
                    "p-4",
                    badge.is_active && "ring-2 ring-primary bg-primary/5"
                  )}>
                    <CardContent className="p-0 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={badge.team_logo_url} />
                          <AvatarFallback>{badge.team_name?.slice(0, 2)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{badge.team_name}</p>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            {badge.tier === 'superfan' ? (
                              <>
                                <Crown className="h-3 w-3 text-yellow-400" />
                                <span>Superfan</span>
                              </>
                            ) : (
                              <>
                                <Star className="h-3 w-3 text-blue-400" />
                                <span>Fan</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <Button
                        size="sm"
                        variant={badge.is_active ? "secondary" : "outline"}
                        onClick={() => handleSetActive(badge.id)}
                        disabled={loading || badge.is_active}
                      >
                        {badge.is_active ? 'Active' : 'Set Active'}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
