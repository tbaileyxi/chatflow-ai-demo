import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Users, MessageCircle, Trophy } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useEffect } from 'react';

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
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Hero Section */}
      <div className="relative">
        {/* Background with geometric shapes */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-20 left-10 w-32 h-32 bg-primary/10 transform rotate-45 rounded-lg"></div>
          <div className="absolute top-40 right-20 w-24 h-24 bg-secondary/10 transform -rotate-12 rounded-lg"></div>
          <div className="absolute bottom-40 left-1/4 w-20 h-20 bg-accent/10 transform rotate-30 rounded-lg"></div>
          <div className="absolute bottom-20 right-1/3 w-28 h-28 bg-success/10 transform -rotate-45 rounded-lg"></div>
        </div>

        {/* Content */}
        <div className="relative z-10 max-w-6xl mx-auto px-4 pt-20 pb-32">
          <div className="text-center space-y-8">
            {/* Headline */}
            <h1 className="text-4xl md:text-6xl font-bold text-foreground leading-tight">
              One App.{' '}
              <span className="text-primary">Your team feeds.</span>
              <br />
              <span className="text-secondary">Your private chats.</span>
              <br />
              <span className="text-accent">Game on.</span>
            </h1>

            {/* Subheadline */}
            <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto">
              Finally: Private group chats that actually follow your team. 
              Curated social media posts + your friends in one place.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-8">
              <Button 
                size="lg" 
                className="bg-accent hover:bg-accent/90 text-accent-foreground px-8 py-4 text-lg font-semibold group"
                onClick={() => navigate('/auth?signup=true')}
              >
                Sign Up
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button 
                variant="outline" 
                size="lg" 
                className="border-secondary text-secondary hover:bg-secondary hover:text-secondary-foreground px-8 py-4 text-lg font-semibold"
                onClick={() => navigate('/auth')}
              >
                Sign In
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-20 bg-muted/30">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="text-center space-y-4 p-6 bg-card rounded-xl shadow-sm hover:shadow-md transition-shadow">
              <div className="w-16 h-16 bg-primary/10 rounded-xl flex items-center justify-center mx-auto">
                <Users className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-card-foreground">Team Feeds</h3>
              <p className="text-muted-foreground">
                Get curated content from your favorite teams and players in one clean feed.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="text-center space-y-4 p-6 bg-card rounded-xl shadow-sm hover:shadow-md transition-shadow">
              <div className="w-16 h-16 bg-secondary/10 rounded-xl flex items-center justify-center mx-auto">
                <MessageCircle className="h-8 w-8 text-secondary" />
              </div>
              <h3 className="text-xl font-semibold text-card-foreground">Private Chats</h3>
              <p className="text-muted-foreground">
                Create invite-only group chats with your friends, family, and fellow fans.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="text-center space-y-4 p-6 bg-card rounded-xl shadow-sm hover:shadow-md transition-shadow">
              <div className="w-16 h-16 bg-accent/10 rounded-xl flex items-center justify-center mx-auto">
                <Trophy className="h-8 w-8 text-accent" />
              </div>
              <h3 className="text-xl font-semibold text-card-foreground">Game Ready</h3>
              <p className="text-muted-foreground">
                Your gameday group chat starts here. Stay connected during every play.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer CTA */}
      <div className="py-16 bg-primary text-primary-foreground">
        <div className="max-w-4xl mx-auto text-center px-4 space-y-6">
          <h2 className="text-3xl md:text-4xl font-bold">
            Ready to elevate your sports experience?
          </h2>
          <p className="text-xl opacity-90">
            Join thousands of fans already connecting on Side Huddle.
          </p>
          <Button 
            size="lg" 
            className="bg-accent hover:bg-accent/90 text-accent-foreground px-8 py-4 text-lg font-semibold"
            onClick={() => navigate('/auth?signup=true')}
          >
            Get Started Now
          </Button>
        </div>
      </div>
    </div>
  );
};