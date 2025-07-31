import { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Phone } from 'lucide-react';
import { AdminLoginDialog } from '@/components/AdminLoginDialog';

export const Auth = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
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
      const { error } = await supabase.auth.signInWithOtp({
        phone: phoneNumber,
        options: {
          shouldCreateUser: isSignUp
        }
      });

      if (error) throw error;
      
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
      const { error } = await supabase.auth.verifyOtp({
        phone: phoneNumber,
        token: verificationCode,
        type: 'sms'
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Successfully authenticated!",
      });
      
      // Auth state will automatically redirect via useAuth
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
              <div className="mt-4 text-center space-y-2">
                <Button
                  variant="link"
                  onClick={() => setIsSignUp(!isSignUp)}
                >
                  {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
                </Button>
                <div>
                  <AdminLoginDialog />
                </div>
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