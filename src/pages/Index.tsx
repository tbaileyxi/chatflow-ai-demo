import { useState, useEffect } from "react";
import { Navigate } from 'react-router-dom';
import { FeedTabs } from "@/components/FeedTabs";
import { HuddleBar } from "@/components/HuddleBar";
import { useAuth } from '@/hooks/useAuth';
import { Onboarding } from "@/components/Onboarding";
import { ProfileSetup } from "@/components/ProfileSetup";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const { user, loading } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const [profileComplete, setProfileComplete] = useState(false);

  useEffect(() => {
    const checkUserProfile = async () => {
      if (!user) return;

      // Check if user has completed profile setup
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name, avatar_url')
        .eq('user_id', user.id)
        .single();

      if (!profile || !profile.display_name) {
        setShowProfileSetup(true);
        return;
      }

      setProfileComplete(true);

      // Check if user has seen onboarding after profile is complete
      const hasSeenOnboarding = localStorage.getItem('hasSeenOnboarding');
      if (!hasSeenOnboarding) {
        setShowOnboarding(true);
      }
    };

    checkUserProfile();
  }, [user]);

  const handleProfileSetupComplete = () => {
    setShowProfileSetup(false);
    setProfileComplete(true);
    setShowOnboarding(true);
  };

  const handleOnboardingComplete = () => {
    localStorage.setItem('hasSeenOnboarding', 'true');
    setShowOnboarding(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (showProfileSetup) {
    return <ProfileSetup onComplete={handleProfileSetupComplete} />;
  }

  if (showOnboarding && profileComplete) {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <FeedTabs />
      </div>
    </div>
  );
};

export default Index;
