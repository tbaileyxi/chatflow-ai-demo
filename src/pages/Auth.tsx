import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Phone } from 'lucide-react';

export const Auth = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSignUp, setIsSignUp] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [sentCode, setSentCode] = useState(false);
  const [loading, setLoading] = useState(false);

  if (user) {
    // Check for pending huddle join
    const pendingJoinData = localStorage.getItem('pendingHuddleJoin');
    if (pendingJoinData) {
      try {
        const joinData = JSON.parse(pendingJoinData);
        // Navigate to the original invite link to complete the flow
        return <Navigate to={`/join-huddle/${joinData.huddleId}`} replace />;
      } catch (error) {
        console.error('Error parsing pending join data:', error);
        localStorage.removeItem('pendingHuddleJoin');
      }
    }
    return <Navigate to="/" replace />;
  }

  const sendVerificationCode = async () => {
    if (!phoneNumber.trim()) {
      toast({
        title: "Error",
        description: "Please enter a phone number",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      
      const { error } = await supabase.functions.invoke('send-sms', {
        body: {
          phone_number: phoneNumber,
          verification_code: code
        }
      });

      if (error) throw error;

      // Store the code temporarily for verification
      sessionStorage.setItem('verificationCode', code);
      sessionStorage.setItem('phoneNumber', phoneNumber);
      
      setSentCode(true);
      toast({
        title: "Code Sent",
        description: "Check your phone for the verification code",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send verification code",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Verify the code - accept both stored code and development code "123456"
      const storedCode = sessionStorage.getItem('verificationCode');
      const storedPhone = sessionStorage.getItem('phoneNumber');
      
      if (verificationCode !== storedCode && verificationCode !== '123456') {
        throw new Error('Invalid verification code');
      }
      
      if (verificationCode !== '123456' && phoneNumber !== storedPhone) {
        throw new Error('Invalid phone number');
      }

      if (isSignUp) {
        // Include pending huddle join and phone data in user metadata
        const pendingJoinData = localStorage.getItem('pendingHuddleJoin');
        let userMetadata: any = {
          phone_number: phoneNumber,
          phone_verified: true,
          display_name: `User ${phoneNumber.slice(-4)}`
        };
        
        if (pendingJoinData) {
          try {
            userMetadata = { ...userMetadata, pendingHuddleJoin: JSON.parse(pendingJoinData) };
          } catch (e) {
            console.error('Failed to parse pending join data:', e);
          }
        }

        // Create user with phone number as email substitute
        // Ensure email is valid format by using only the last 10 digits
        const cleanPhone = phoneNumber.replace(/\D/g, '').slice(-10);
        const fakeEmail = `user${cleanPhone}@sidehuddle.app`;
        const { error } = await supabase.auth.signUp({
          email: fakeEmail,
          password: `phone_${phoneNumber.replace(/\D/g, '')}_verified`,
          options: {
            data: userMetadata,
            emailRedirectTo: `${window.location.origin}/`
          }
        });
        if (error) throw error;

        // Clean up stored codes
        sessionStorage.removeItem('verificationCode');
        sessionStorage.removeItem('phoneNumber');

        toast({
          title: "Success",
          description: "Account created successfully!",
        });
      } else {
        // For sign in, check if profile exists, if not suggest signup
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id')
          .eq('phone_number', phoneNumber)
          .maybeSingle();

        if (!profiles) {
          toast({
            title: "Phone not found",
            description: "Please sign up first or switch to Sign Up mode",
            variant: "destructive"
          });
          return;
        }

        // Sign in with the consistent password format
        const cleanPhone = phoneNumber.replace(/\D/g, '').slice(-10);
        const fakeEmail = `user${cleanPhone}@sidehuddle.app`;
        const { error } = await supabase.auth.signInWithPassword({
          email: fakeEmail,
          password: `phone_${phoneNumber.replace(/\D/g, '')}_verified`
        });

        if (error) {
          toast({
            title: "Sign in failed",
            description: "Please try signing up instead",
            variant: "destructive"
          });
          return;
        }

        // Clean up stored codes
        sessionStorage.removeItem('verificationCode');
        sessionStorage.removeItem('phoneNumber');

        toast({
          title: "Success", 
          description: "Signed in successfully!",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center flex items-center justify-center gap-2">
            <Phone className="h-5 w-5" />
            {isSignUp ? 'Create Account' : 'Welcome to Side Huddle'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!sentCode ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+1 (555) 123-4567"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  required
                />
              </div>
              <Button 
                onClick={sendVerificationCode} 
                className="w-full" 
                disabled={loading}
              >
                {loading ? 'Sending...' : 'Send Verification Code'}
              </Button>
              <div className="mt-4 text-center">
                <Button
                  variant="link"
                  onClick={() => setIsSignUp(!isSignUp)}
                >
                  {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleAuth} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">Verification Code</Label>
                <p className="text-sm text-muted-foreground">
                  Enter the 6-digit code sent to {phoneNumber}
                </p>
                <Input
                  id="code"
                  type="text"
                  placeholder="123456"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  maxLength={6}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Verifying...' : isSignUp ? 'Create Account' : 'Sign In'}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  setSentCode(false);
                  setVerificationCode('');
                }}
              >
                Change Phone Number
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};