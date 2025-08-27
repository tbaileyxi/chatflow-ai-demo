import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Users, MessageCircle, Trophy } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useEffect } from 'react';
import shLogo from '@/assets/sh-logo-updated.png';

export const Landing = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  // Redirect logged-in users to their feed
  useEffect(() => {
    if (!loading && user) {
      navigate('/app');
    }
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-primary/8 overflow-hidden relative">
      {/* Sharp Background Pattern */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Sharp geometric pattern */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-primary/10 via-transparent to-huddle-primary/10"></div>
          <div className="absolute top-20 left-20 w-40 h-40 bg-primary/20 rotate-45 blur-xl"></div>
          <div className="absolute top-40 right-32 w-32 h-32 bg-huddle-primary/25 rotate-12 blur-lg"></div>
          <div className="absolute bottom-40 left-1/3 w-48 h-48 bg-accent/15 -rotate-12 blur-2xl"></div>
          
          {/* Sharp lines */}
          <div className="absolute top-1/4 right-1/4 w-1 h-20 bg-gradient-to-b from-primary to-transparent rotate-45"></div>
          <div className="absolute bottom-1/3 left-1/3 w-1 h-16 bg-gradient-to-b from-huddle-primary to-transparent -rotate-12"></div>
          <div className="absolute top-1/2 left-1/4 w-1 h-12 bg-gradient-to-b from-accent to-transparent rotate-90"></div>
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
            
            {/* Headline */}
            <h1 className="text-4xl md:text-6xl font-black text-foreground leading-tight tracking-tight" style={{ fontFamily: 'Impact, "Arial Black", sans-serif' }}>
              One App.{' '}
              <span className="text-transparent bg-gradient-to-r from-primary to-huddle-primary bg-clip-text">Your team feeds.</span>
              <br />
              <span className="text-muted-foreground">Your private chats.</span>
              <br />
              <span className="text-transparent bg-gradient-to-r from-huddle-primary to-primary bg-clip-text">Game on.</span>
            </h1>

            {/* Subheadline */}
            <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto font-medium leading-relaxed">
              Finally: Private group chats that actually follow your team. 
              Curated social media posts + your friends in one place.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-8">
              <Button 
                size="lg" 
                className="bg-gradient-to-r from-primary to-huddle-primary hover:from-primary/90 hover:to-huddle-primary/90 text-white px-8 py-4 text-lg font-semibold group shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                onClick={() => navigate('/auth?signup=true')}
              >
                Sign Up
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button 
                variant="outline" 
                size="lg" 
                className="border-2 border-muted-foreground/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground hover:border-primary px-8 py-4 text-lg font-semibold backdrop-blur-sm transition-all duration-300"
                onClick={() => navigate('/auth')}
              >
                Sign In
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-20 bg-gradient-to-r from-muted/20 via-muted/30 to-muted/20 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="text-center space-y-4 p-8 bg-card/80 backdrop-blur-sm rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 border border-primary/10 hover:border-primary/20 group">
              <div className="w-16 h-16 bg-gradient-to-br from-primary/20 to-huddle-primary/20 rounded-2xl flex items-center justify-center mx-auto group-hover:scale-110 transition-transform duration-300">
                <Users className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-card-foreground">Team Feeds</h3>
              <p className="text-muted-foreground leading-relaxed">
                Get curated content from your favorite teams and players in one clean feed.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="text-center space-y-4 p-8 bg-card/80 backdrop-blur-sm rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 border border-huddle-primary/10 hover:border-huddle-primary/20 group">
              <div className="w-16 h-16 bg-gradient-to-br from-huddle-primary/20 to-secondary/20 rounded-2xl flex items-center justify-center mx-auto group-hover:scale-110 transition-transform duration-300">
                <MessageCircle className="h-8 w-8 text-huddle-primary" />
              </div>
              <h3 className="text-xl font-bold text-card-foreground">Private Chats</h3>
              <p className="text-muted-foreground leading-relaxed">
                Create invite-only group chats with your friends, family, and fellow fans.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="text-center space-y-4 p-8 bg-card/80 backdrop-blur-sm rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 border border-accent/10 hover:border-accent/20 group">
              <div className="w-16 h-16 bg-gradient-to-br from-accent/20 to-primary/20 rounded-2xl flex items-center justify-center mx-auto group-hover:scale-110 transition-transform duration-300">
                <Trophy className="h-8 w-8 text-accent" />
              </div>
              <h3 className="text-xl font-bold text-card-foreground">Game Ready</h3>
              <p className="text-muted-foreground leading-relaxed">
                Your gameday group chat starts here. Stay connected during every play.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer CTA */}
      <div className="py-16 bg-gradient-to-r from-primary via-huddle-primary to-primary text-white relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-10 left-10 w-32 h-32 bg-white/10 rounded-full blur-xl"></div>
          <div className="absolute bottom-10 right-10 w-24 h-24 bg-white/10 rounded-full blur-lg"></div>
        </div>
        
        <div className="max-w-4xl mx-auto text-center px-4 space-y-6 relative z-10">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            Ready to elevate your sports experience?
          </h2>
          <p className="text-xl opacity-90 font-medium">
            Join thousands of fans already connecting on Side Huddle.
          </p>
          <Button 
            size="lg" 
            className="bg-white/20 hover:bg-white/30 text-white backdrop-blur-sm border border-white/30 hover:border-white/50 px-8 py-4 text-lg font-semibold shadow-2xl transition-all duration-300 transform hover:scale-105"
            onClick={() => navigate('/auth?signup=true')}
          >
            Get Started Now
          </Button>
        </div>
      </div>
    </div>
  );
};