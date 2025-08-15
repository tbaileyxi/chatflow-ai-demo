import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ArrowLeft, ArrowRight, CheckCircle, Eye, Users, MessageSquare, Zap, Target, Calendar, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface EnhancedOnboardingProps {
  onComplete: () => void;
}

const OnboardingScreen1 = () => (
  <div className="text-center space-y-6">
    <div className="space-y-4">
      <div className="mx-auto w-16 h-16 bg-gradient-to-br from-spotlight to-primary rounded-full flex items-center justify-center">
        <Eye className="w-8 h-8 text-white" />
      </div>
      <h2 className="text-2xl font-bold text-foreground">Two Powerful Feeds</h2>
      <p className="text-muted-foreground max-w-md mx-auto">
        Stay connected with your teams through two distinct feeds designed for different experiences
      </p>
    </div>

    <div className="grid gap-4 max-w-lg mx-auto">
      {/* Spotlight Feed */}
      <Card className="border-spotlight/20 bg-gradient-to-r from-spotlight/5 to-transparent">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-spotlight/10 rounded-lg flex items-center justify-center shrink-0">
              <Target className="w-5 h-5 text-spotlight" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-spotlight">Spotlight Feed</h3>
              <p className="text-sm text-muted-foreground">
                Curated highlights and trending content from the world of sports
              </p>
              <Badge variant="secondary" className="mt-2">Default Feed</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Your Feed */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5 text-primary" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-primary">Your Feed</h3>
              <p className="text-sm text-muted-foreground">
                Personal timeline with content from teams you follow
              </p>
              <Badge variant="outline" className="mt-2">Personalized</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
);

const OnboardingScreen2 = () => (
  <div className="text-center space-y-6">
    <div className="space-y-4">
      <div className="mx-auto w-16 h-16 bg-gradient-to-br from-primary to-blue-600 rounded-full flex items-center justify-center">
        <Users className="w-8 h-8 text-white" />
      </div>
      <h2 className="text-2xl font-bold text-foreground">Side Huddles</h2>
      <p className="text-muted-foreground max-w-md mx-auto">
        Your gameday group chat starts here. Invite Only chats for your friends, family & fans.
      </p>
    </div>

    <div className="grid gap-4 max-w-lg mx-auto">
      {/* Private Chats */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
              <MessageSquare className="w-5 h-5 text-primary" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-primary">Private Group Chats</h3>
              <p className="text-sm text-muted-foreground">
                Invite only chats for your friends, family & fans
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
);

interface ProfileSetupProps {
  onNext: () => void;
  onBack: () => void;
}

const ProfileSetupScreen = ({ onNext, onBack }: ProfileSetupProps) => {
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  // Generate random color for avatar
  const avatarColors = [
    'bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 
    'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-orange-500'
  ];
  const randomColor = avatarColors[Math.floor(Math.random() * avatarColors.length)];

  const handleSave = async () => {
    if (!displayName.trim() || !username.trim()) {
      toast({
        title: "Required fields",
        description: "Please fill in both display name and username",
        variant: "destructive"
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          user_id: user?.id,
          display_name: displayName.trim(),
          username: username.trim().toLowerCase()
        });

      if (error) {
        if (error.message.includes('unique')) {
          toast({
            title: "Username taken",
            description: "This username is already taken. Please choose another.",
            variant: "destructive"
          });
          return;
        }
        throw error;
      }

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
    <div className="text-center space-y-6">
      <div className="space-y-4">
        <div className="mx-auto w-16 h-16 bg-gradient-to-br from-secondary to-accent rounded-full flex items-center justify-center">
          <User className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">Set Up Your Profile</h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          Let other fans know who you are with a display name and username
        </p>
      </div>

      <div className="max-w-sm mx-auto space-y-6">
        {/* Avatar Preview */}
        <div className="flex justify-center">
          <Avatar className={`w-20 h-20 ${randomColor}`}>
            <AvatarFallback className={`${randomColor} text-white text-xl font-bold`}>
              {displayName ? displayName.substring(0, 2).toUpperCase() : 'U'}
            </AvatarFallback>
          </Avatar>
        </div>

        {/* Form Fields */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="displayName" className="text-left block">Display Name</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Enter your display name"
              className="text-center"
              maxLength={50}
            />
            <p className="text-xs text-muted-foreground">This is how others will see you</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="username" className="text-left block">Username</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              placeholder="Enter a unique username"
              className="text-center"
              maxLength={30}
            />
            <p className="text-xs text-muted-foreground">Unique identifier for your profile</p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack} className="flex-1">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={saving || !displayName.trim() || !username.trim()}
            className="flex-1"
          >
            {saving ? "Saving..." : "Continue"}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
};

const OnboardingScreen4 = () => (
  <div className="text-center space-y-6">
    <div className="space-y-4">
      <div className="mx-auto w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center">
        <CheckCircle className="w-8 h-8 text-white" />
      </div>
      <h2 className="text-2xl font-bold text-foreground">You're All Set!</h2>
      <p className="text-muted-foreground max-w-md mx-auto">
        Start exploring, follow teams, and join huddles to connect with fellow fans
      </p>
    </div>

    <div className="space-y-4 max-w-md mx-auto">
      <Card className="border-l-4 border-l-primary">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">
              1
            </div>
            <div className="text-left">
              <h3 className="font-semibold">Follow Teams</h3>
              <p className="text-sm text-muted-foreground">
                Select your favorite teams to get their updates
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-l-4 border-l-accent">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-accent text-accent-foreground rounded-full flex items-center justify-center text-sm font-bold">
              2
            </div>
            <div className="text-left">
              <h3 className="font-semibold">Start Huddle</h3>
              <p className="text-sm text-muted-foreground">
                Create or join group chats with fellow fans
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
);

export const EnhancedOnboarding = ({ onComplete }: EnhancedOnboardingProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const totalSteps = 4;

  const handleNext = () => {
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

  const handleSkip = () => {
    onComplete();
  };

  const renderCurrentScreen = () => {
    switch (currentStep) {
      case 0:
        return <OnboardingScreen1 />;
      case 1:
        return <OnboardingScreen2 />;
      case 2:
        return <ProfileSetupScreen onNext={handleNext} onBack={handleBack} />;
      case 3:
        return <OnboardingScreen4 />;
      default:
        return <OnboardingScreen1 />;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <div className="w-full max-w-2xl space-y-8">
        {/* Progress Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-xl font-bold text-foreground">Welcome to Side Huddle</h1>
            <Badge variant="outline">{currentStep + 1} of {totalSteps}</Badge>
          </div>
          
          <div className="space-y-2">
            <Progress value={(currentStep + 1) / totalSteps * 100} className="w-full" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Feed Types</span>
              <span>Side Huddles</span>
              <span>Profile Setup</span>
              <span>Get Started</span>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <Card className="border-0 shadow-lg bg-card/80 backdrop-blur-sm">
          <CardContent className="p-8">
            {renderCurrentScreen()}
          </CardContent>
        </Card>

        {/* Navigation - only show for non-profile setup screens */}
        {currentStep !== 2 && (
          <div className="flex justify-between items-center">
            <div className="flex gap-2">
              {currentStep > 0 ? (
                <Button variant="outline" onClick={handleBack} className="flex items-center gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </Button>
              ) : (
                <div />
              )}
            </div>

            <div className="flex gap-2">
              <Button variant="ghost" onClick={handleSkip}>
                Skip
              </Button>
              <Button onClick={handleNext} className="flex items-center gap-2">
                {currentStep === totalSteps - 1 ? (
                  <>
                    Get Started
                    <CheckCircle className="w-4 h-4" />
                  </>
                ) : (
                  <>
                    Next
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};