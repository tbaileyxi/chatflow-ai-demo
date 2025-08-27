import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Shield, Star, Users, Search } from "lucide-react";

interface HuddleVerificationDialogProps {
  huddleId: string;
  isVerified?: boolean;
  trigger?: React.ReactNode;
}

export const HuddleVerificationDialog = ({ 
  huddleId, 
  isVerified, 
  trigger 
}: HuddleVerificationDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-huddle-subscription', {
        body: { huddleId }
      });

      if (error) throw error;

      // Open Stripe checkout in new tab
      if (data.url) {
        window.open(data.url, '_blank');
        setOpen(false);
      }
    } catch (error: any) {
      console.error("Error creating subscription:", error);
      toast({
        title: "Payment setup failed",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (isVerified) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button 
            variant="outline" 
            size="sm"
            className="border-verified-primary text-verified-primary hover:bg-verified-background"
          >
            <Shield className="w-4 h-4 mr-2" />
            Get Verified
          </Button>
        )}
      </DialogTrigger>
      
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-verified-primary" />
            Upgrade to Verified Huddle
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <Card className="border-verified-border">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="w-5 h-5 text-verified-primary" />
                Verified Huddle Features
              </CardTitle>
              <CardDescription>
                Premium features for serious communities
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <Shield className="w-4 h-4 text-verified-primary" />
                <span className="text-sm">Official verification badge</span>
              </div>
              <div className="flex items-center gap-3">
                <Search className="w-4 h-4 text-verified-primary" />
                <span className="text-sm">Discoverable in official search</span>
              </div>
              <div className="flex items-center gap-3">
                <Users className="w-4 h-4 text-verified-primary" />
                <span className="text-sm">Member approval system</span>
              </div>
              <div className="flex items-center gap-3">
                <Star className="w-4 h-4 text-verified-primary" />
                <span className="text-sm">Enhanced credibility</span>
              </div>
            </CardContent>
          </Card>
          
          <div className="text-center p-4 bg-verified-background rounded-lg">
            <div className="text-2xl font-bold text-verified-primary">$99/year</div>
            <div className="text-sm text-muted-foreground">Annual subscription</div>
          </div>
          
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleUpgrade}
              disabled={loading}
              className="bg-verified-primary hover:bg-verified-primary/90 text-white"
            >
              {loading ? "Processing..." : "Upgrade Now"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};