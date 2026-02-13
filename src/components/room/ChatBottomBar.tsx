import React, { memo, useCallback, useState } from 'react';
import { Receipt, UserPlus, Award, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Plus, Users, Trophy } from 'lucide-react';

interface Team {
  id: string;
  name: string;
  city: string;
  league: string;
  logo_url?: string;
}

interface ChatBottomBarProps {
  huddleId: string;
  huddleName?: string;
  teamId?: string;
  eventId?: string;
  onOpenFades?: () => void;
  onOpenBadgesModal?: () => void;
  onOpenLedger?: () => void;
  className?: string;
}

export const ChatBottomBar = memo(function ChatBottomBar({
  huddleId,
  huddleName,
  teamId,
  eventId,
  onOpenFades,
  onOpenBadgesModal,
  onOpenLedger,
  className
}: ChatBottomBarProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showPrivateDialog, setShowPrivateDialog] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamsLoaded, setTeamsLoaded] = useState(false);
  const [formData, setFormData] = useState({ name: '', team_id: teamId || '' });
  const [submitLoading, setSubmitLoading] = useState(false);

  // Handle invite - copies invite link to clipboard
  const handleInvite = useCallback(async () => {
    const inviteUrl = `${window.location.origin}/join-huddle/${huddleId}`;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      toast.success('Invite link copied!');
    } catch {
      toast.info(`Invite link: ${inviteUrl}`);
    }
  }, [huddleId]);

  // Handle ledger - navigate to ledger page
  const handleLedger = useCallback(() => {
    if (onOpenLedger) {
      onOpenLedger();
    } else {
      const params = new URLSearchParams();
      if (teamId) params.set('teamId', teamId);
      if (huddleId) params.set('huddleId', huddleId);
      navigate(`/ledger${params.toString() ? '?' + params.toString() : ''}`);
    }
  }, [onOpenLedger, navigate, teamId, huddleId]);

  // Handle badges
  const handleBadges = useCallback(() => {
    if (onOpenBadgesModal) {
      onOpenBadgesModal();
    } else {
      toast.info('Get team badges!');
    }
  }, [onOpenBadgesModal]);

  // Handle private - opens create side huddle dialog
  const handlePrivate = useCallback(async () => {
    if (!user) {
      toast.info('Please sign in to create a private huddle');
      return;
    }
    setShowPrivateDialog(true);
    
    // Fetch teams if not loaded
    if (!teamsLoaded) {
      const { data, error } = await supabase
        .from('teams')
        .select('id, name, city, league, logo_url')
        .eq('status', 'active')
        .order('league', { ascending: true })
        .order('city', { ascending: true });
      
      if (!error && data) {
        setTeams(data);
        setTeamsLoaded(true);
      }
    }
    
    // Pre-fill team if we have one
    if (teamId) {
      setFormData(prev => ({ ...prev, team_id: teamId }));
    }
  }, [user, teamsLoaded, teamId]);

  const handleCreateHuddle = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error('Please enter a huddle name');
      return;
    }
    if (!formData.team_id) {
      toast.error('Please select a team');
      return;
    }
    if (!user?.id) {
      toast.error('You must be logged in');
      return;
    }

    setSubmitLoading(true);
    try {
      const selectedTeam = teams.find(t => t.id === formData.team_id);
      
      const { data: huddle, error } = await supabase
        .from('huddles')
        .insert({
          name: formData.name.trim(),
          owner_id: user.id,
          team_id: formData.team_id,
          is_private: true,
          member_count: 1,
          parent_team_id: teamId || null,
          is_official_team_huddle: false
        })
        .select()
        .single();

      if (error) throw error;

      // Trigger backfill
      if (huddle?.id && selectedTeam) {
        supabase.functions.invoke('huddle-backfill', {
          body: {
            huddle_id: huddle.id,
            team_id: formData.team_id,
            team_name: `${selectedTeam.city} ${selectedTeam.name}`,
            is_new_huddle: true
          }
        });
      }

      toast.success(`Created "${formData.name}" huddle!`);
      setFormData({ name: '', team_id: '' });
      setShowPrivateDialog(false);
      
      if (huddle?.id) {
        navigate(`/huddle/${huddle.id}`);
      }
    } catch (error) {
      console.error('Error creating huddle:', error);
      toast.error('Failed to create huddle');
    } finally {
      setSubmitLoading(false);
    }
  };

  const actions = [
    { icon: Receipt, label: 'Ledger', onClick: handleLedger, color: 'text-yellow-400' },
    { icon: UserPlus, label: 'Invite', onClick: handleInvite, color: 'text-cyan-400' },
    { icon: Award, label: 'Badges', onClick: handleBadges, color: 'text-purple-400' },
    { icon: Lock, label: 'Private', onClick: handlePrivate, color: 'text-green-400' },
  ];

  return (
    <>
      <div className={cn(
        "flex items-center justify-around py-2 px-4",
        "bg-card/80 backdrop-blur-md border-t border-border/30",
        className
      )}>
        {actions.map(({ icon: Icon, label, onClick, color }) => (
          <Button
            key={label}
            variant="ghost"
            size="sm"
            onClick={onClick}
            className={cn(
              "flex flex-col items-center gap-0.5 h-auto py-2 px-4",
              "hover:bg-muted/50 active:scale-95 transition-all",
              "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className={cn("h-5 w-5", color)} />
            <span className="text-[10px] font-medium">{label}</span>
          </Button>
        ))}
      </div>

      {/* Create Private Huddle Dialog */}
      <Dialog open={showPrivateDialog} onOpenChange={setShowPrivateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Create a Private Huddle
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleCreateHuddle} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="huddle-name">Huddle Name</Label>
              <Input
                id="huddle-name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., My Inner Circle"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="team-select">Select Team</Label>
              <Select 
                value={formData.team_id} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, team_id: value }))}
                required
                disabled={!!teamId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a team" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      <div className="flex items-center gap-2">
                        <Avatar className="w-6 h-6">
                          <AvatarImage src={team.logo_url} />
                          <AvatarFallback className="text-xs">
                            {team.name.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span>{team.city} {team.name}</span>
                        <span className="text-xs text-muted-foreground">({team.league})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Card className="bg-muted/50">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Trophy className="w-5 h-5 text-primary mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium mb-1">What is a Private Huddle?</p>
                    <p className="text-muted-foreground">
                      A private chat with your closest fans. Invite-only and branched from this team's community.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end gap-2 pt-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setShowPrivateDialog(false)}
                disabled={submitLoading}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={submitLoading}
                className="bg-primary hover:bg-primary/90"
              >
                {submitLoading ? 'Creating...' : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Create
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

    </>
  );
});
