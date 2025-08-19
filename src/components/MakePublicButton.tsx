import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Megaphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface MakePublicButtonProps {
  messageId: string;
  messageContent: string;
  mediaUrl?: string;
  mediaType?: string;
  embedCode?: string;
  teamId?: string;
  isOwner: boolean;
}

export const MakePublicButton = ({ 
  messageId, 
  messageContent, 
  mediaUrl, 
  mediaType, 
  embedCode,
  teamId,
  isOwner 
}: MakePublicButtonProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleMakePublic = async () => {
    if (!user || !isOwner) return;

    setLoading(true);
    try {
      // Normalize message_type to match database constraints
      let normalizedMessageType = 'text';
      if (mediaUrl) {
        if (embedCode) {
          normalizedMessageType = 'embed';
        } else {
          normalizedMessageType = 'upload'; // For images/videos
        }
      } else if (embedCode) {
        normalizedMessageType = 'embed';
      }

      // Create a new post in the posts table with spotlight target audience
      const { error } = await supabase
        .from('posts')
        .insert({
          content: messageContent,
          media_url: mediaUrl,
          message_type: normalizedMessageType,
          embed_code: embedCode,
          team_id: teamId,
          author_id: user.id,
          target_audience: ['spotlight'],
          delivery_status: 'sent',
          is_spotlight: true
        });

      if (error) throw error;

      toast({
        title: "Made public!",
        description: "Your message has been added to the Spotlight feed"
      });
      
      setIsOpen(false);
    } catch (error) {
      console.error("Error making post public:", error);
      toast({
        title: "Error",
        description: "Failed to make post public",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isOwner) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-muted-foreground hover:text-spotlight hover:bg-spotlight/10"
        >
          <Megaphone className="w-3 h-3" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Make Post Public</DialogTitle>
          <DialogDescription>
            This will add your message to the public Spotlight feed where all users can see it.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm text-foreground whitespace-pre-wrap">{messageContent}</p>
            {mediaUrl && (
              <div className="mt-2 text-xs text-muted-foreground">
                Includes {mediaType === 'image' ? 'image' : 'media'} attachment
              </div>
            )}
          </div>
          
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleMakePublic} 
              disabled={loading}
              className="bg-spotlight text-primary-foreground hover:bg-spotlight/90"
            >
              {loading ? "Publishing..." : "Make Public"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};