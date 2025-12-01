import { useState, useEffect } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Mail, Info, Eye, EyeOff } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';


export const Auth = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(true);

  // Check URL params for signup intent
  useEffect(() => {
    if (searchParams.get('signup') === 'true') {
      setIsSignUp(true);
    }
  }, [searchParams]);


  // Check for user authentication and handle redirects
  if (user) {
    const pendingJoinData = localStorage.getItem('pendingHuddleJoin');
    if (pendingJoinData) {
      try {
        const joinData = JSON.parse(pendingJoinData);
        return <Navigate to={`/join-huddle/${joinData.huddleId}`} replace />;
      } catch (error) {
        console.error('Error parsing pending join data:', error);
        localStorage.removeItem('pendingHuddleJoin');
      }
    }
    
    // Check for intended huddle after signup
    const intendedHuddleId = localStorage.getItem('intended_huddle_id');
    if (intendedHuddleId) {
      localStorage.removeItem('intended_huddle_id');
      
      // Auto-join the public huddle - the trigger will update member count
      setTimeout(async () => {
        await supabase
          .from('huddle_members')
          .insert({ huddle_id: intendedHuddleId, user_id: user.id });
      }, 0);
      
      return <Navigate to={`/huddle/${intendedHuddleId}`} replace />;
    }
    
    return <Navigate to="/app" replace />;
  }

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast({
        title: "Error",
        description: "Please enter both email and password",
        variant: "destructive"
      });
      return;
    }

    if (isSignUp && !displayName.trim()) {
      toast({
        title: "Error",
        description: "Please enter your display name",
        variant: "destructive"
      });
      return;
    }

    if (isSignUp && password !== confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match",
        variant: "destructive"
      });
      return;
    }

    if (isSignUp && password.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      if (isSignUp) {
        // Generate username from display name
        const generatedUsername = displayName.toLowerCase().replace(/[^a-z0-9]/g, '') + '_' + Math.random().toString(36).substring(2, 8);
        
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: {
              display_name: displayName.trim(),
              username: generatedUsername
            }
          }
        });

        if (error) throw error;

        toast({
          title: "Account Created",
          description: "Please check your email to verify your account.",
        });
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        toast({
          title: "Success",
          description: "Successfully signed in!",
        });
      }
    } catch (error: any) {
      let errorMessage = error.message;
      
      if (error.message?.includes('Invalid login credentials')) {
        errorMessage = "Invalid email or password. Please try again.";
      } else if (error.message?.includes('User already registered')) {
        errorMessage = "An account with this email already exists. Please sign in instead.";
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-foreground">
            Finally: Private group chats that actually follow your team
          </h1>
          <p className="text-sm text-muted-foreground">
            Curated social media posts + your friends in one place
          </p>
        </div>
        
        <Card className="w-full">
          <CardContent className="pt-6">
            <form onSubmit={handleAuth} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>

              {isSignUp && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="displayName">Display Name</Label>
                    <Input
                      id="displayName"
                      type="text"
                      placeholder="Enter your display name"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="Confirm your password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                  </div>
                </>
              )}

              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="terms" 
                  checked={agreedToTerms}
                  onCheckedChange={(checked) => setAgreedToTerms(checked === true)}
                />
                <Label htmlFor="terms" className="text-sm italic">
                  Agree to{' '}
                  <a 
                    href="https://docs.google.com/document/d/e/2PACX-1vStEnMeiAhNukWvnEO0_4VbNxuBFU5kQ5y7froaOF8H_hjUFa1_nhIclOPnmXe8OL3Vx6-WhL-wMy4M/pub" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Opt in, Privacy & Terms of Service
                  </a>{' '}
                  Policies
                </Label>
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                disabled={loading || !agreedToTerms}
              >
                {loading ? (isSignUp ? 'Creating Account...' : 'Signing In...') : (isSignUp ? 'Create Account' : 'Sign In')}
              </Button>
              
              <div className="text-center">
                <Button
                  type="button"
                  variant="link"
                  onClick={() => setIsSignUp(!isSignUp)}
                >
                  {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};