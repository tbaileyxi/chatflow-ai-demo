import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
  const [loading, setLoading] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
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

        // Redirect to Stripe checkout
        window.location.href = data.url;
        return;
      }

      // For all huddles (verified or not, free or will-be-paid), allow direct join
      // Paid verified huddles already went through Stripe checkout above
      const { error } = await supabase.from("huddle_members").insert({
        huddle_id: huddle.id,
        user_id: user.id,
      });

      if (error) {
        if (error.code === '23505') {
          toast({
            title: "Already a member",
            description: "You're already in this huddle!",
          });
          setOpen(false);
          return;
        }
        throw error;
      }

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

      setShowSuccessDialog(true);
      setOpen(false);
      onJoinSuccess?.();
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
              {membershipRequired ? `$${(membershipPrice / 100).toFixed(2)}/mo` : "Join"}
            </>
          ) : (
            <>
              {membershipRequired ? <DollarSign className="w-4 h-4 mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
              {membershipRequired ? `Join for $${(membershipPrice / 100).toFixed(2)}/mo` : "Join Huddle"}
            </>
          )}
        </Button>
      </DialogTrigger>
      
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {membershipRequired && <DollarSign className="w-5 h-5 text-primary" />}
            {huddle.is_verified && <Shield className="w-5 h-5 text-verified-primary" />}
            {membershipRequired ? "Subscribe to" : "Join"} {huddle.name}
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
                This verified huddle requires a <strong>${(membershipPrice / 100).toFixed(2)}/month</strong> subscription.
                You'll get <strong>instant access</strong> after payment is confirmed.
              </p>
            </div>
          )}
          
          {huddle.is_verified && !membershipRequired && (
            <div className="p-4 bg-verified-background border border-verified-border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4 text-verified-primary" />
                <span className="font-medium text-verified-primary">Free Verified Huddle</span>
              </div>
              <p className="text-sm text-muted-foreground">
                This is a free verified huddle. You'll get <strong>instant access</strong> when you join.
              </p>
            </div>
          )}
          
          {!huddle.is_verified && (
            <p className="text-sm text-muted-foreground">
              Join this huddle to start chatting with other fans and participate in the community.
            </p>
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
              {loading ? (membershipRequired ? "Redirecting..." : "Joining...") : (membershipRequired ? `Pay $${(membershipPrice / 100).toFixed(2)}/mo` : "Join Huddle")}
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
            Welcome to the Huddle!
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="text-center">
            <p className="text-muted-foreground">
              You're now a member of "{huddle.name}"! 
              Start chatting with your fellow fans.
            </p>
          </div>
          
          <div className="flex flex-col gap-2">
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