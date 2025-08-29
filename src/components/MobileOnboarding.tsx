import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ArrowLeft, ArrowRight, CheckCircle, MessageSquare, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { TeamSelector } from '@/components/TeamSelector';

interface MobileOnboardingProps {
  onComplete: () => void;
}

interface Team {
  id: string;
  name: string;
  logo_url?: string;
  city: string;
  conference: string;
}

const ProfileSetupScreen = ({ onNext, onBack }: { onNext: () => void; onBack: () => void }) => {
  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const handleSave = async () => {
    if (!displayName.trim()) {
      toast({
        title: "Required field",
        description: "Please enter a display name",
        variant: "destructive"
      });
      return;
    }

    setSaving(true);
    try {
      const username = displayName.toLowerCase().replace(/[^a-z0-9]/g, '') + Math.floor(Math.random() * 1000);
      
      const { error } = await supabase
        .from('profiles')
        .upsert({
          user_id: user?.id,
          display_name: displayName.trim(),
          username: username
        });

      if (error) throw error;

      toast({
        title: "Profile saved",
        description: "Your profile has been set up successfully!",
      });
      
      onNext();
    } catch (error) {
      console.error('Error saving profile:', error);
      toast({
        title: "Error",
        description: "Failed to save profile. Please try again.",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-4">
        <div className="mx-auto w-16 h-16 bg-glass-accent rounded-full flex items-center justify-center">
          <MessageSquare className="w-8 h-8 text-accent" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">Welcome to Side Huddle</h2>
        <p className="text-muted-foreground">Let's set up your profile to get started</p>
      </div>

      <div className="space-y-4">
        <div className="flex justify-center">
          <Avatar className="w-20 h-20 bg-accent/20">
            <AvatarFallback className="bg-accent/20 text-accent text-xl font-bold">
              {displayName ? displayName.substring(0, 2).toUpperCase() : 'U'}
            </AvatarFallback>
          </Avatar>
        </div>

        <div className="space-y-2">
          <Label htmlFor="displayName">Display Name</Label>
          <Input
            id="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Enter your display name"
            className="glass-input"
            maxLength={50}
          />
        </div>

        <Button 
          onClick={handleSave} 
          disabled={saving || !displayName.trim()}
          className="w-full glass-button"
        >
          {saving ? "Saving..." : "Continue"}
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
};

const TeamSelectionScreen = ({ onNext, onBack }: { onNext: (teamIds: string[]) => void; onBack: () => void }) => {
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const handleCreateHuddle = async () => {
    if (selectedTeams.length === 0) {
      toast({
        title: "Select a team",
        description: "Please select at least one team to create your huddle",
        variant: "destructive"
      });
      return;
    }

    setCreating(true);
    try {
      // Get team info for the first selected team
      const { data: team } = await supabase
        .from('teams')
        .select('*')
        .eq('id', selectedTeams[0])
        .single();

      if (!team) throw new Error('Team not found');

      // Create huddle for the first team
      const { data: huddle, error: huddleError } = await supabase
        .from('huddles')
        .insert({
          name: `${team.city} ${team.name} Core`,
          owner_id: user?.id,
          team_id: team.id,
          is_private: true
        })
        .select()
        .single();

      if (huddleError) throw huddleError;

      // Follow the selected teams
      const followInserts = selectedTeams.map(teamId => ({
        user_id: user?.id,
        team_id: teamId
      }));

      const { error: followError } = await supabase
        .from('user_follows')
        .insert(followInserts);

      if (followError) throw followError;

      onNext(selectedTeams);
    } catch (error) {
      console.error('Error creating huddle:', error);
      toast({
        title: "Error",
        description: "Failed to create huddle. Please try again.",
        variant: "destructive"
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-4">
        <div className="mx-auto w-16 h-16 bg-glass-accent rounded-full flex items-center justify-center">
          <Users className="w-8 h-8 text-accent" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">Choose Your Team</h2>
        <p className="text-muted-foreground">Select your favorite teams to follow and create your first huddle</p>
      </div>

      <TeamSelector onTeamsUpdated={setSelectedTeams} />

      <div className="space-y-3">
        <Button 
          onClick={handleCreateHuddle}
          disabled={creating || selectedTeams.length === 0}
          className="w-full glass-button"
        >
          {creating ? "Creating Huddle..." : `Create My ${selectedTeams.length > 0 ? 'Core ' : ''}Huddle`}
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
        
        <Button 
          variant="ghost" 
          onClick={() => onNext([])}
          className="w-full text-muted-foreground"
        >
          Skip for now
        </Button>
      </div>
    </div>
  );
};

const WelcomeScreen = ({ onComplete }: { onComplete: () => void }) => (
  <div className="space-y-6 text-center">
    <div className="space-y-4">
      <div className="mx-auto w-16 h-16 bg-glass-accent rounded-full flex items-center justify-center">
        <CheckCircle className="w-8 h-8 text-accent" />
      </div>
      <h2 className="text-2xl font-bold text-foreground">You're All Set!</h2>
      <p className="text-muted-foreground">Start chatting with fellow fans and stay updated with the latest from your teams</p>
    </div>

    <div className="grid gap-4">
      <Card className="glass-card border-glass-border">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-accent/20 rounded-lg flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-accent" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-foreground">Chat with Fans</h3>
              <p className="text-sm text-muted-foreground">Join huddles and chat with fellow team supporters</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card border-glass-border">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-glass-secondary/20 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-glass-secondary" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-foreground">Stay Updated</h3>
              <p className="text-sm text-muted-foreground">Get real-time updates from team bots</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>

    <Button onClick={onComplete} className="w-full glass-button">
      Start Chatting
      <MessageSquare className="w-4 h-4 ml-2" />
    </Button>
  </div>
);

export const MobileOnboarding = ({ onComplete }: MobileOnboardingProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const totalSteps = 3;

  const handleNext = (teamIds?: string[]) => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const renderCurrentScreen = () => {
    switch (currentStep) {
      case 0:
        return <ProfileSetupScreen onNext={handleNext} onBack={handleBack} />;
      case 1:
        return <TeamSelectionScreen onNext={handleNext} onBack={handleBack} />;
      case 2:
        return <WelcomeScreen onComplete={onComplete} />;
      default:
        return <ProfileSetupScreen onNext={handleNext} onBack={handleBack} />;
    }
  };

  return (
    <div className="min-h-screen bg-mobile-background flex flex-col safe-area-padding">
      {/* Header */}
      <div className="glass-header border-b border-glass-border p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-foreground">Side Huddle</h1>
          <Badge variant="outline" className="glass-badge">
            {currentStep + 1} of {totalSteps}
          </Badge>
        </div>
        <Progress value={(currentStep + 1) / totalSteps * 100} className="glass-progress" />
      </div>

      {/* Content */}
      <div className="flex-1 p-4 overflow-y-auto">
        <div className="max-w-md mx-auto">
          {renderCurrentScreen()}
        </div>
      </div>

      {/* Back Button */}
      {currentStep > 0 && (
        <div className="p-4">
          <Button variant="ghost" onClick={handleBack} className="w-full">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </div>
      )}
    </div>
  );
};