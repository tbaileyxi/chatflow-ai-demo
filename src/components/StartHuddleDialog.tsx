import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Plus, Users, Trophy, Shield, ArrowRight } from 'lucide-react';
import { CreateVerifiedHuddleDialog } from '@/components/CreateVerifiedHuddleDialog';

interface Team {
  id: string;
  name: string;
  city: string;
  league: string;
  logo_url?: string;
}

interface StartHuddleDialogProps {
  onHuddleCreated?: () => void;
  trigger?: React.ReactNode;
  parentTeamId?: string;
  isCreatingSideHuddle?: boolean;
}

export const StartHuddleDialog = ({ onHuddleCreated, trigger, parentTeamId, isCreatingSideHuddle = false }: StartHuddleDialogProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);
  const [teamsLoaded, setTeamsLoaded] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    team_id: ''
  });
  const [submitLoading, setSubmitLoading] = useState(false);

  const fetchTeams = async () => {
    if (teamsLoaded) return;
    
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('id, name, city, league, logo_url')
        .eq('status', 'active')
        .order('league', { ascending: true })
        .order('city', { ascending: true });

      if (error) throw error;
      setTeams(data || []);
      setTeamsLoaded(true);
    } catch (error) {
      console.error('Error fetching teams:', error);
      toast({
        title: "Error",
        description: "Failed to load teams",
        variant: "destructive"
      });
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen) {
      fetchTeams();
      // Pre-populate team if creating a side huddle
      if (parentTeamId) {
        setFormData(prev => ({ ...prev, team_id: parentTeamId }));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a huddle name",
        variant: "destructive"
      });
      return;
    }

    if (!formData.team_id) {
      toast({
        title: "Validation Error",
        description: "Please select a team",
        variant: "destructive"
      });
      return;
    }

    if (!user?.id) {
      toast({
        title: "Authentication Error",
        description: "You must be logged in to create a huddle",
        variant: "destructive"
      });
      return;
    }

    setSubmitLoading(true);
    try {
      // Get team name for backfill
      const selectedTeam = teams.find(t => t.id === formData.team_id);
      
      console.log('Creating huddle with data:', {
        name: formData.name.trim(),
        owner_id: user.id,
        team_id: formData.team_id,
        is_private: true,
        member_count: 1
      });
      
      // Create the huddle (trigger automatically adds owner as member)
      const { data: huddle, error: huddleError } = await supabase
        .from('huddles')
        .insert({
          name: formData.name.trim(),
          owner_id: user.id,
          team_id: formData.team_id,
          is_private: true,
          member_count: 1,
          parent_team_id: parentTeamId || null,
          is_official_team_huddle: false
        })
        .select()
        .single();

      if (huddleError) {
        throw new Error(`Failed to create huddle: ${huddleError.message}`);
      }

      // Trigger backfill for the new huddle (fire-and-forget)
      if (huddle?.id && selectedTeam) {
        supabase.functions.invoke('huddle-backfill', {
          body: {
            huddle_id: huddle.id,
            team_id: formData.team_id,
            team_name: `${selectedTeam.city} ${selectedTeam.name}`,
            is_new_huddle: true
          }
        }).then(({ error }) => {
          if (error) console.error('Backfill error:', error);
          else console.log('✅ Huddle backfill triggered');
        });
      }

      toast({
        title: "Success!",
        description: `Created "${formData.name}" huddle successfully!`,
      });

      setFormData({ name: '', team_id: '' });
      setOpen(false);
      onHuddleCreated?.();
      
      // Navigate to the newly created huddle
      if (huddle?.id) {
        navigate(`/huddle/${huddle.id}`);
      }
    } catch (error) {
      console.error('Error creating huddle:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create huddle';
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Start Side Huddle
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            {isCreatingSideHuddle ? "Create a Side Huddle" : "Start a New Side Huddle"}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="huddle-name">Huddle Name</Label>
            <Input
              id="huddle-name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., Chiefs Kingdom Chat"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="team-select">Select Team</Label>
            <Select 
              value={formData.team_id} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, team_id: value }))}
              required
              disabled={isCreatingSideHuddle && !!parentTeamId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose a team for this huddle" />
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
                  <p className="font-medium mb-1">What is a Side Huddle?</p>
                  <p className="text-muted-foreground">
                    {isCreatingSideHuddle 
                      ? "Create a private chat that branches from the main team community. Perfect for your closest fans!"
                      : "A private chat room with your friends centered around your favorite team. Get team agent updates and chat with fellow fans!"
                    }
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <CreateVerifiedHuddleDialog 
            onHuddleCreated={onHuddleCreated}
            trigger={
              <Button 
                type="button"
                variant="link" 
                className="w-full text-verified-primary hover:text-verified-primary/80 gap-1 p-0 h-auto"
              >
                <Shield className="w-4 h-4" />
                Get hosted? 
                <ArrowRight className="w-3 h-3" />
              </Button>
            }
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setOpen(false)}
              disabled={submitLoading}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={submitLoading}
              className="bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitLoading ? (
                <>
                  <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Huddle
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};