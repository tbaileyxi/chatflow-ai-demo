import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Globe, BadgeCheck, Lock } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { HuddlePreviewCard } from '@/components/HuddlePreviewCard';

export const Landing = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [publicHuddles, setPublicHuddles] = useState<any[]>([]);
  const [huddlesLoading, setHuddlesLoading] = useState(true);

  // Redirect logged-in users to their feed
  useEffect(() => {
    if (!loading && user) {
      navigate('/app');
    }
  }, [user, loading, navigate]);

  // Fetch top public huddles for preview
  useEffect(() => {
    const fetchPublicHuddles = async () => {
      try {
        const { data, error } = await supabase
          .from('huddles')
          .select(`
            id,
            name,
            member_count,
            is_verified,
            is_official_team_huddle,
            team:teams(logo_url, name)
          `)
          .or('is_private.eq.false,is_official_team_huddle.eq.true')
          .order('member_count', { ascending: false })
          .limit(6);

        if (error) throw error;
        setPublicHuddles(data || []);
      } catch (error) {
        console.error('Error fetching public huddles:', error);
      } finally {
        setHuddlesLoading(false);
      }
    };

    fetchPublicHuddles();
  }, []);

  return (
    <div className="min-h-screen bg-background overflow-hidden relative">
      {/* Sharp Background Pattern */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Sharp geometric pattern */}
        <div className="absolute inset-0 opacity-40">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-secondary/20 via-transparent to-muted/20"></div>
          <div className="absolute top-20 left-20 w-40 h-40 bg-primary/30 rotate-45 blur-xl shadow-2xl"></div>
          <div className="absolute top-40 right-32 w-32 h-32 bg-secondary/40 rotate-12 blur-lg shadow-xl"></div>
          <div className="absolute bottom-40 left-1/3 w-48 h-48 bg-primary/20 -rotate-12 blur-2xl shadow-lg"></div>
          
          {/* Sharp lines with yellow/slate accents */}
          <div className="absolute top-1/4 right-1/4 w-2 h-24 bg-gradient-to-b from-primary to-transparent rotate-45 shadow-lg"></div>
          <div className="absolute bottom-1/3 left-1/3 w-2 h-20 bg-gradient-to-b from-secondary to-transparent -rotate-12 shadow-md"></div>
          <div className="absolute top-1/2 left-1/4 w-1 h-16 bg-gradient-to-b from-primary to-transparent rotate-90 shadow-sm"></div>
          
          {/* Additional dynamic elements */}
          <div className="absolute top-3/4 right-1/4 w-6 h-6 bg-primary rounded-full blur-sm shadow-lg animate-pulse"></div>
          <div className="absolute top-1/3 left-1/6 w-4 h-4 bg-secondary rounded-full blur-sm shadow-md animate-pulse delay-1000"></div>
        </div>
      </div>

      {/* Hero Section */}
      <div className="relative z-10">

        {/* Content */}
        <div className="max-w-6xl mx-auto px-4 pt-12 pb-32">
          <div className="text-center space-y-8">
            {/* Logo */}
            <div className="flex justify-center mb-8">
              <div className="w-28 h-28 md:w-36 md:h-36 rounded-full overflow-hidden shadow-2xl border-4 border-primary/20 bg-black">
                <img 
                  src="/lovable-uploads/89d98004-873f-423c-983e-8f49264b77cf.png" 
                  alt="Side Huddle Logo" 
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
            
            {/* Main tagline */}
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-8 tracking-wide" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.3)' }}>
              THE SPORTS APP FOR FRIENDS & FANS
            </h1>

            {/* CTA Buttons - Now above the fold */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
              <Button 
                size="lg" 
                className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-4 text-lg font-bold shadow-2xl hover:shadow-primary/40 transition-all duration-300 transform hover:scale-105 border-2 border-primary"
                onClick={() => navigate('/auth?signup=true')}
                style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.5)' }}
              >
                Sign Up
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button 
                variant="outline" 
                size="lg" 
                className="border-2 border-secondary bg-secondary/20 text-foreground hover:bg-secondary/40 hover:text-foreground hover:border-primary px-8 py-4 text-lg font-bold backdrop-blur-sm transition-all duration-300 shadow-xl hover:shadow-2xl transform hover:scale-105"
                onClick={() => navigate('/auth')}
                style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.3)' }}
              >
                Sign In
              </Button>
            </div>

            {/* Updated Subheadline */}
            <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto font-medium leading-relaxed" style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.2)' }}>
              Join public team chats, discover verified fan communities, or create private huddles with your crew. 
              All your sports conversations in one place.
            </p>
          </div>
        </div>
      </div>

      {/* Features Section - Three Huddle Types */}
      <div className="py-20 bg-gradient-to-r from-muted/20 via-muted/30 to-muted/20 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 - Public Huddles */}
            <div className="text-center space-y-4 p-8 bg-card/90 backdrop-blur-sm rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 border-2 border-primary/20 hover:border-primary/40 group">
              <div className="w-16 h-16 bg-primary/30 rounded-2xl flex items-center justify-center mx-auto group-hover:scale-110 transition-transform duration-300 shadow-lg">
                <Globe className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-card-foreground">Public Huddles</h3>
              <p className="text-muted-foreground leading-relaxed">
                Open team chats for every fan. Browse and join the conversation without signing up. Sign in to participate.
              </p>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => navigate('/huddle-search')}
                className="mt-2"
              >
                Browse Communities
              </Button>
            </div>

            {/* Feature 2 - Verified Communities */}
            <div className="text-center space-y-4 p-8 bg-card backdrop-blur-sm rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 border-2 border-primary/30 hover:border-primary/50 group">
              <div className="w-16 h-16 bg-primary/40 rounded-2xl flex items-center justify-center mx-auto group-hover:scale-110 transition-transform duration-300 shadow-lg border border-primary/20">
                <BadgeCheck className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-foreground">Verified Communities</h3>
              <p className="text-foreground/80 leading-relaxed font-medium">
                Official fan communities run by notable creators and organizations. Trusted spaces for die-hard fans.
              </p>
            </div>

            {/* Feature 3 - Private Huddles */}
            <div className="text-center space-y-4 p-8 bg-card/90 backdrop-blur-sm rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 border-2 border-primary/20 hover:border-primary/40 group">
              <div className="w-16 h-16 bg-primary/30 rounded-2xl flex items-center justify-center mx-auto group-hover:scale-110 transition-transform duration-300 shadow-lg">
                <Lock className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-card-foreground">Private Huddles</h3>
              <p className="text-muted-foreground leading-relaxed">
                Create invite-only group chats with your friends, family, and fellow fans. Your crew, your rules.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Live Public Huddles Preview Section */}
      {!huddlesLoading && publicHuddles.length > 0 && (
        <div className="py-20 bg-background">
          <div className="max-w-6xl mx-auto px-4">
            <div className="text-center mb-12 space-y-4">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground">
                🏈 Active Fan Communities
              </h2>
              <p className="text-lg text-muted-foreground">
                See what fans are talking about right now
              </p>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-8">
              {publicHuddles.map((huddle) => (
                <HuddlePreviewCard key={huddle.id} huddle={huddle} />
              ))}
            </div>

            <div className="text-center">
              <Button 
                size="lg"
                onClick={() => navigate('/huddle-search')}
                className="gap-2"
              >
                Browse All Communities
                <ArrowRight className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Footer CTA */}
      <div className="py-16 bg-primary text-primary-foreground relative overflow-hidden shadow-2xl">
        {/* Background decoration */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-10 left-10 w-32 h-32 bg-secondary/20 rounded-full blur-xl shadow-lg"></div>
          <div className="absolute bottom-10 right-10 w-24 h-24 bg-secondary/30 rounded-full blur-lg shadow-md"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-40 h-40 bg-secondary/10 rounded-full blur-2xl"></div>
        </div>
        
        <div className="max-w-4xl mx-auto text-center px-4 space-y-6 relative z-10">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.3)' }}>
            Ready to elevate your sports experience?
          </h2>
          <p className="text-xl font-medium opacity-95" style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.3)' }}>
            Join thousands of fans already connecting on Side Huddle.
          </p>
          <Button 
            size="lg" 
            className="bg-secondary text-secondary-foreground hover:bg-secondary/90 border-2 border-secondary px-8 py-4 text-lg font-bold shadow-2xl hover:shadow-secondary/40 transition-all duration-300 transform hover:scale-105"
            onClick={() => navigate('/auth?signup=true')}
            style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.5)' }}
          >
            Get Started Now
          </Button>
        </div>
      </div>
    </div>
  );
};