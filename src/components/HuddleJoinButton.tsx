import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Shield, UserPlus, CheckCircle, ArrowRight, Home, DollarSign } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface HuddleJoinButtonProps {
  huddle: {
    id: string;
    name: string;
    is_verified?: boolean;
  };
  isAlreadyMember?: boolean;
  onJoinSuccess?: () => void;
  compact?: boolean;
  membershipRequired?: boolean;
  membershipPrice?: number;
}

export const HuddleJoinButton = ({ 
  huddle, 
  isAlreadyMember, 
  onJoinSuccess,
  compact = false,
  membershipRequired = false,
  membershipPrice = 0
}: HuddleJoinButtonProps) => {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [joinType, setJoinType] = useState<'request' | 'direct'>('direct');
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleJoinRequest = async () => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please log in to join huddles",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      if (membershipRequired) {
        // Handle paid membership
        const { data, error } = await supabase.functions.invoke('create-huddle-membership-checkout', {
          body: { huddleId: huddle.id }
        });

        if (error) throw error;

        // Open Stripe checkout in a new tab
        window.open(data.url, '_blank');
        setOpen(false);
        return;
      } else if (huddle.is_verified) {
        // Check if request already exists
        const { data: existingRequest } = await supabase
          .from("huddle_join_requests")
          .select("id, status")
          .eq("huddle_id", huddle.id)
          .eq("user_id", user.id)
          .single();

        if (existingRequest) {
          if (existingRequest.status === "pending") {
            toast({
              title: "Request already sent",
              description: "Your join request is pending review.",
            });
          } else {
            toast({
              title: "Request already processed",
              description: `Your join request was ${existingRequest.status}.`,
            });
          }
          setOpen(false);
          return;
        }

        // Create join request for verified huddles
        const { error } = await supabase.from("huddle_join_requests").insert({
          huddle_id: huddle.id,
          user_id: user.id,
          message: message.trim() || null,
        });

        if (error) throw error;

        setJoinType('request');
        setShowSuccessDialog(true);
      } else {
        // Direct join for non-verified huddles
        const { error } = await supabase.from("huddle_members").insert({
          huddle_id: huddle.id,
          user_id: user.id,
        });

        if (error) throw error;

        // Update member count
        const { data: currentHuddle } = await supabase
          .from("huddles")
          .select("member_count")
          .eq("id", huddle.id)
          .single();
        
        await supabase
          .from("huddles")
          .update({ 
            member_count: (currentHuddle?.member_count || 0) + 1,
            last_message_at: new Date().toISOString()
          })
          .eq("id", huddle.id);

        setJoinType('direct');
        setShowSuccessDialog(true);
      }

      setOpen(false);
      setMessage("");
    } catch (error: any) {
      console.error("Error joining huddle:", error);
      toast({
        title: "Failed to join",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (isAlreadyMember) {
    return null;
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
        <Button 
          size={compact ? "sm" : "sm"}
          className={compact 
            ? "bg-huddle-primary hover:bg-huddle-primary/90 text-white text-xs h-6 px-2 w-full justify-center"
            : "bg-huddle-primary hover:bg-huddle-primary/90 text-white"
          }
        >
          {compact ? (
            <>
              {membershipRequired ? <DollarSign className="w-3 h-3 mr-1" /> : <UserPlus className="w-3 h-3 mr-1" />}
              {membershipRequired ? "Subscribe" : huddle.is_verified ? "Request" : "Join"}
            </>
          ) : (
            <>
              {membershipRequired ? <DollarSign className="w-4 h-4 mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
              {membershipRequired ? `Subscribe ($${(membershipPrice / 100).toFixed(2)}/mo)` : huddle.is_verified ? "Request to Join" : "Join Huddle"}
            </>
          )}
        </Button>
      </DialogTrigger>
      
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {membershipRequired && <DollarSign className="w-5 h-5 text-primary" />}
            {huddle.is_verified && <Shield className="w-5 h-5 text-verified-primary" />}
            {membershipRequired ? "Subscribe to" : huddle.is_verified ? "Request to Join" : "Join"} {huddle.name}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {membershipRequired && (
            <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-primary" />
                <span className="font-medium text-primary">Premium Membership Required</span>
              </div>
              <p className="text-sm text-muted-foreground">
                This huddle requires a monthly subscription of ${(membershipPrice / 100).toFixed(2)} to join.
                You'll be redirected to complete your payment.
              </p>
            </div>
          )}
          
          {huddle.is_verified && !membershipRequired && (
            <div className="p-4 bg-verified-background border border-verified-border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4 text-verified-primary" />
                <span className="font-medium text-verified-primary">Verified Huddle</span>
              </div>
              <p className="text-sm text-muted-foreground">
                This is an official verified huddle. Your join request will be reviewed by the huddle owner.
              </p>
            </div>
          )}
          
          {huddle.is_verified && !membershipRequired && (
            <div className="space-y-2">
              <Label htmlFor="message">Message (optional)</Label>
              <Textarea
                id="message"
                placeholder="Tell the owner why you'd like to join..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
              />
            </div>
          )}
          
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleJoinRequest}
              disabled={loading}
              className="bg-huddle-primary hover:bg-huddle-primary/90 text-white"
            >
              {loading ? (membershipRequired ? "Redirecting..." : "Sending...") : (membershipRequired ? `Pay $${(membershipPrice / 100).toFixed(2)}/mo` : huddle.is_verified ? "Send Request" : "Join")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* Success Dialog */}
    <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            {joinType === 'request' ? 'Join Request Sent!' : 'Welcome to the Huddle!'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="text-center">
            {joinType === 'request' ? (
              <p className="text-muted-foreground">
                Your request to join "{huddle.name}" has been sent to the huddle owner for review.
                You'll be notified when they respond.
              </p>
            ) : (
              <p className="text-muted-foreground">
                You're now a member of "{huddle.name}"! 
                Start chatting with your fellow fans.
              </p>
            )}
          </div>
          
          <div className="flex flex-col gap-2">
            {joinType === 'direct' && (
              <Button 
                onClick={() => {
                  navigate(`/huddle/${huddle.id}`);
                  setShowSuccessDialog(false);
                  onJoinSuccess?.();
                }}
                className="bg-huddle-primary hover:bg-huddle-primary/90 text-white"
              >
                <ArrowRight className="w-4 h-4 mr-2" />
                Go to Huddle
              </Button>
            )}
            <Button 
              variant="outline"
              onClick={() => {
                navigate('/app');
                setShowSuccessDialog(false);
                onJoinSuccess?.();
              }}
            >
              <Home className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
};