import { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Phone, Info, Clock } from 'lucide-react';


export const Auth = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isSignUp, setIsSignUp] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [sentCode, setSentCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isDevelopmentMode, setIsDevelopmentMode] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(300); // 5 minutes in seconds
  const [canResend, setCanResend] = useState(false);

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

  // Timer effect for countdown
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (sentCode && timeRemaining > 0) {
      interval = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [sentCode, timeRemaining]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatPhoneNumber = (phone: string) => {
    // Remove all non-digits
    const cleaned = phone.replace(/\D/g, '');
    
    // Add + if not present and number doesn't start with +
    if (!phone.startsWith('+') && cleaned.length >= 10) {
      return `+1${cleaned.slice(-10)}`; // Default to US format
    }
    
    return phone.startsWith('+') ? phone : `+${cleaned}`;
  };

  const sendVerificationCode = async () => {
    if (!phoneNumber.trim()) {
      toast({
        title: "Error",
        description: "Please enter a phone number",
        variant: "destructive"
      });
      return;
    }

    const formattedPhone = formatPhoneNumber(phoneNumber);
    
    // Basic validation
    if (formattedPhone.length < 10) {
      toast({
        title: "Error",
        description: "Please enter a valid phone number",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone: formattedPhone,
        options: {
          shouldCreateUser: isSignUp
        }
      });

      if (error) throw error;
      
      // Check if we're in development mode by calling the SMS function
      try {
        const { data: smsResponse } = await supabase.functions.invoke('send-sms', {
          body: { phone_number: formattedPhone, verification_code: '123456' }
        });
        
        if (smsResponse?.message?.includes('Development mode')) {
          setIsDevelopmentMode(true);
        }
      } catch (smsError) {
        console.log('SMS function check failed:', smsError);
      }
      
      // Update the phone number state to the formatted version
      setPhoneNumber(formattedPhone);
      setSentCode(true);
      setTimeRemaining(300); // Reset timer to 5 minutes
      setCanResend(false);
      
      const toastTitle = isDevelopmentMode ? "Development Mode" : "Code Sent";
      const toastDescription = isDevelopmentMode 
        ? "Use verification code: 123456 (no SMS sent)" 
        : "Check your phone for the verification code";
        
      toast({
        title: toastTitle,
        description: toastDescription,
      });
    } catch (error: any) {
      console.error('SMS Error:', error);
      let errorMessage = "Failed to send verification code";
      
      if (error.message?.includes('Twilio')) {
        errorMessage = "SMS service is not properly configured. Please contact support.";
      } else if (error.message?.includes('Invalid phone number')) {
        errorMessage = "Please enter a valid phone number with country code";
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

  const requestNewCode = async () => {
    setTimeRemaining(300);
    setCanResend(false);
    setVerificationCode('');
    await sendVerificationCode();
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
      let errorMessage = error.message;
      
      if (error.message?.includes('otp_expired') || error.message?.includes('expired')) {
        errorMessage = "Verification code has expired. Please request a new code.";
        setCanResend(true);
        setTimeRemaining(0);
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
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {isDevelopmentMode && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Development Mode</strong><br />
                    Use verification code: <strong>123456</strong><br />
                    <span className="text-sm text-muted-foreground">No SMS will be sent</span>
                  </AlertDescription>
                </Alert>
              )}
              
              <form onSubmit={handleAuth} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Verification Code</Label>
                  <p className="text-sm text-muted-foreground">
                    Enter the 6-digit code sent to {phoneNumber}
                  </p>
                  <Input
                    id="code"
                    type="text"
                    placeholder={isDevelopmentMode ? "123456" : "Enter code"}
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    maxLength={6}
                    required
                  />
                  
                  {timeRemaining > 0 && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      Code expires in: {formatTime(timeRemaining)}
                    </div>
                  )}
                </div>
                
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Verifying...' : isSignUp ? 'Create Account' : 'Sign In'}
                </Button>
                
                {canResend && (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={requestNewCode}
                    disabled={loading}
                  >
                    Request New Code
                  </Button>
                )}
                
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setSentCode(false);
                    setVerificationCode('');
                    setIsDevelopmentMode(false);
                    setTimeRemaining(300);
                    setCanResend(false);
                  }}
                >
                  Change Phone Number
                </Button>
              </form>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};