import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, ArrowRight, CheckCircle, Eye, Users, MessageSquare, Zap, Target, Calendar } from 'lucide-react';

interface OnboardingProps {
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
                Curated highlights and trending content from all your teams
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
        Private group chats enhanced with Team Bot capabilities for real-time discussions
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
                Create intimate discussions with fellow fans
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Team Bot Enhancement */}
      <Card className="border-accent/20 bg-gradient-to-r from-accent/5 to-transparent">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center shrink-0">
              <Zap className="w-5 h-5 text-accent" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-accent">Team Bot Enhancement</h3>
              <p className="text-sm text-muted-foreground">
                Receive official team updates and exclusive content
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
);

const OnboardingScreen3 = () => (
  <div className="text-center space-y-6">
    <div className="space-y-4">
      <div className="mx-auto w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center">
        <CheckCircle className="w-8 h-8 text-white" />
      </div>
      <h2 className="text-2xl font-bold text-foreground">Getting Started</h2>
      <p className="text-muted-foreground max-w-md mx-auto">
        Follow these simple steps to start engaging with your favorite teams
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

export const Onboarding = ({ onComplete }: OnboardingProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const totalSteps = 3;

  const screens = [OnboardingScreen1, OnboardingScreen2, OnboardingScreen3];
  const CurrentScreen = screens[currentStep];

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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <div className="w-full max-w-2xl space-y-8">
        {/* Progress Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-xl font-bold text-foreground">Welcome to the App</h1>
            <Badge variant="outline">{currentStep + 1} of {totalSteps}</Badge>
          </div>
          
          <div className="space-y-2">
            <Progress value={(currentStep + 1) / totalSteps * 100} className="w-full" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Feed Types</span>
              <span>Side Huddles</span>
              <span>Get Started</span>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <Card className="border-0 shadow-lg bg-card/80 backdrop-blur-sm">
          <CardContent className="p-8">
            <CurrentScreen />
          </CardContent>
        </Card>

        {/* Navigation */}
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
      </div>
    </div>
  );
};