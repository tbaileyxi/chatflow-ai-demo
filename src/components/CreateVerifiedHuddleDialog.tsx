import { useState } from 'react';
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
import { Shield, Users, Trophy } from 'lucide-react';
import { VerifiedBadge } from './VerifiedBadge';

interface Team {
  id: string;
  name: string;
  city: string;
  league: string;
  logo_url?: string;
}

interface CreateVerifiedHuddleDialogProps {
  onHuddleCreated?: () => void;
  trigger?: React.ReactNode;
}

export const CreateVerifiedHuddleDialog = ({ onHuddleCreated, trigger }: CreateVerifiedHuddleDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
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
    } else {
      // Reset form on close
      setFormData({ name: '', team_id: '' });
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
        description: "You must be logged in to create a verified huddle",
        variant: "destructive"
      });
      return;
    }

    setSubmitLoading(true);
    try {
      // Create huddle first then initiate payment
      const { data: huddle, error: huddleError } = await supabase
        .from('huddles')
        .insert({
          name: formData.name.trim(),
          owner_id: user.id,
          team_id: formData.team_id,
          is_private: false, // Verified huddles are public
          member_count: 1
        })
        .select()
        .single();

      if (huddleError) throw huddleError;

      // Call payment function - Stripe handles promo codes natively
      const { data, error } = await supabase.functions.invoke('create-verification-payment', {
        body: { huddleId: huddle.id }
      });

      if (error) throw error;

      // Redirect to Stripe checkout in same tab
      if (data?.url) {
        window.location.href = data.url;
        return;
      }

      setFormData({ name: '', team_id: '' });
      setOpen(false);
      onHuddleCreated?.();
    } catch (error) {
      console.error('Error creating verified huddle:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create verified huddle';
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
        {trigger}
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-verified-primary" />
            Create Verified Huddle
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <Card className="bg-verified-background border-verified-border">
            <CardContent className="p-4">
              <div className="flex items-start gap-3 mb-3">
                <VerifiedBadge size="lg" />
                <div className="text-sm">
                  <p className="font-medium mb-1 text-verified-primary">What is a Verified Huddle?</p>
                  <ul className="text-muted-foreground space-y-1 text-xs">
                    <li>• Set subscription rates and earn. Members pay to join. Or make it free!</li>
                    <li>• Official verification badge</li>
                    <li>• Discoverable in public search</li>
                    <li>• Member approval system</li>
                    <li>• Enhanced credibility</li>
                  </ul>
                </div>
              </div>
              <div className="text-center py-2 bg-background/50 rounded">
                <span className="text-2xl font-bold">$49.99</span>
                <span className="text-muted-foreground text-sm ml-2">one-time</span>
              </div>
              <p className="text-xs text-muted-foreground text-center mt-2">
                Have a promo code? Enter it at checkout.
              </p>
            </CardContent>
          </Card>

          <div className="space-y-2">
            <Label htmlFor="huddle-name">Huddle Name</Label>
            <Input
              id="huddle-name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., Official Chiefs Kingdom"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="team-select">Select Team</Label>
            <Select 
              value={formData.team_id} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, team_id: value }))}
              required
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
              className="bg-verified-primary hover:bg-verified-primary/90"
            >
              {submitLoading ? (
                <>
                  <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  Creating...
                </>
              ) : (
                <>
                  <Shield className="w-4 h-4 mr-2" />
                  Continue to Payment
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
