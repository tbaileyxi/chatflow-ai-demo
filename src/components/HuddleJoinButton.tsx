import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Shield, UserPlus } from "lucide-react";

interface HuddleJoinButtonProps {
  huddle: {
    id: string;
    name: string;
    is_verified?: boolean;
  };
  isAlreadyMember?: boolean;
  onJoinSuccess?: () => void;
}

export const HuddleJoinButton = ({ 
  huddle, 
  isAlreadyMember, 
  onJoinSuccess 
}: HuddleJoinButtonProps) => {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

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
      if (huddle.is_verified) {
        // Create join request for verified huddles
        const { error } = await supabase.from("huddle_join_requests").insert({
          huddle_id: huddle.id,
          user_id: user.id,
          message: message.trim() || null,
        });

        if (error) throw error;

        toast({
          title: "Join request sent!",
          description: "The huddle owner will review your request.",
        });
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

        toast({
          title: "Joined huddle!",
          description: `You're now a member of ${huddle.name}`,
        });
      }

      setOpen(false);
      setMessage("");
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          size="sm" 
          className="bg-huddle-primary hover:bg-huddle-primary/90 text-white"
        >
          <UserPlus className="w-4 h-4 mr-2" />
          {huddle.is_verified ? "Request to Join" : "Join Huddle"}
        </Button>
      </DialogTrigger>
      
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {huddle.is_verified && <Shield className="w-5 h-5 text-verified-primary" />}
            {huddle.is_verified ? "Request to Join" : "Join"} {huddle.name}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {huddle.is_verified && (
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
          
          {huddle.is_verified && (
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
              {loading ? "Sending..." : (huddle.is_verified ? "Send Request" : "Join")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};