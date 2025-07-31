import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Shield } from "lucide-react";

export const AdminLoginDialog = () => {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const sendOTP = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone: phone,
        options: {
          data: {
            display_name: "Admin User",
          }
        }
      });

      if (error) throw error;
      
      setOtpSent(true);
      toast({
        title: "OTP Sent",
        description: "Please check your phone for the verification code",
      });
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

  const verifyOTP = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        phone: phone,
        token: otp,
        type: 'sms'
      });

      if (error) throw error;
      
      // Make user admin after successful login
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('user_roles').upsert({
          user_id: user.id,
          role: 'admin'
        });
      }

      setOpen(false);
      setPhone("");
      setOtp("");
      setOtpSent(false);
      
      toast({
        title: "Admin Access Granted",
        description: "You now have admin privileges",
      });
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Shield className="w-4 h-4" />
          Admin Login
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Admin Access
          </DialogTitle>
        </DialogHeader>
        
        {!otpSent ? (
          <div className="space-y-4">
            <div>
              <Label htmlFor="phone">Admin Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+1234567890"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <Button onClick={sendOTP} disabled={!phone || loading} className="w-full">
              {loading ? "Sending..." : "Send Admin OTP"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label htmlFor="otp">Verification Code</Label>
              <Input
                id="otp"
                placeholder="Enter 6-digit code"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                maxLength={6}
              />
            </div>
            <Button onClick={verifyOTP} disabled={!otp || loading} className="w-full">
              {loading ? "Verifying..." : "Verify & Grant Admin Access"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};