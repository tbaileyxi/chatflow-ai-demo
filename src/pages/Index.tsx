import { useState, useEffect } from "react";
import { Navigate } from 'react-router-dom';
import { FeedTabs } from "@/components/FeedTabs";
import { HuddleBar } from "@/components/HuddleBar";
import { useAuth } from '@/hooks/useAuth';
import { EnhancedOnboarding } from "@/components/EnhancedOnboarding";
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

      try {
        // Check if user has completed profile setup
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('display_name, avatar_url, onboarding_completed')
          .eq('user_id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('Error fetching profile:', error);
          return;
        }

        // If no profile exists or no display name, show profile setup
        if (!profile || !profile.display_name) {
          setShowProfileSetup(true);
          setShowOnboarding(false);
          setProfileComplete(false);
          return;
        }

        setProfileComplete(true);

        // Only show onboarding for users who haven't completed it yet AND have a complete profile
        if (profile.onboarding_completed === false || profile.onboarding_completed === null) {
          setShowOnboarding(true);
        } else {
          setShowOnboarding(false);
        }
      } catch (error) {
        console.error('Error checking user profile:', error);
      }
    };

    checkUserProfile();
  }, [user]);

  const handleProfileSetupComplete = () => {
    setShowProfileSetup(false);
    setProfileComplete(true);
    // Show onboarding for new users after profile setup
    setShowOnboarding(true);
  };

  const handleOnboardingComplete = async () => {
    // Mark onboarding as completed in database
    await supabase
      .from('profiles')
      .update({ onboarding_completed: true })
      .eq('user_id', user?.id);
    
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

  // Show onboarding if user hasn't seen it before
  if (showOnboarding && profileComplete) {
    return <EnhancedOnboarding onComplete={handleOnboardingComplete} />;
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
