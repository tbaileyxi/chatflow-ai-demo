import { useState, useEffect } from "react";
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { MobileOnboarding } from "@/components/MobileOnboarding";
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
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('display_name, avatar_url, onboarding_completed')
          .eq('user_id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('Error fetching profile:', error);
          return;
        }

        if (!profile || !profile.display_name) {
          setShowProfileSetup(true);
          setShowOnboarding(false);
          setProfileComplete(false);
          return;
        }

        setProfileComplete(true);

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
    setShowOnboarding(true);
  };

  const handleOnboardingComplete = async () => {
    await supabase
      .from('profiles')
      .update({ onboarding_completed: true })
      .eq('user_id', user?.id);
    
    setShowOnboarding(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background crt-effect">
        <div className="text-lg text-muted-foreground font-arcade">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (showProfileSetup) {
    return (
      <div className="min-h-screen bg-background crt-effect">
        <div className="fixed inset-0 pointer-events-none opacity-10">
          <div className="absolute inset-0 retro-grid"></div>
          <div className="absolute inset-0 retro-scanlines"></div>
        </div>
        <div className="relative">
          <ProfileSetup onComplete={handleProfileSetupComplete} />
        </div>
      </div>
    );
  }

  if (showOnboarding && profileComplete) {
    return (
      <div className="min-h-screen bg-background crt-effect">
        <div className="fixed inset-0 pointer-events-none opacity-10">
          <div className="absolute inset-0 retro-grid"></div>
          <div className="absolute inset-0 retro-scanlines"></div>
        </div>
        <div className="relative">
          <MobileOnboarding onComplete={handleOnboardingComplete} />
        </div>
      </div>
    );
  }

  return <Navigate to="/app" replace />;
};

export default Index;