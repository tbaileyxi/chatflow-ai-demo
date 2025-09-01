
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
    if (!user || !isOwner) {
      toast({
        title: "Error",
        description: "You must be logged in and own this message",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      console.log("Making post public:", {
        author_id: user.id,
        messageContent,
        mediaUrl,
        embedCode,
        teamId,
        isOwner
      });

      // Determine message_type based on content
      let messageType = 'text';
      if (embedCode) {
        messageType = 'embed';
      } else if (mediaUrl) {
        messageType = 'upload';
      }

      console.log("Message type:", messageType);

      // Create a new post in the posts table with spotlight target audience
      const { data, error } = await supabase
        .from('posts')
        .insert({
          content: messageContent,
          media_url: mediaUrl,
          message_type: messageType,
          embed_code: embedCode,
          team_id: teamId,
          author_id: user.id,
          target_audience: ['spotlight'],
          delivery_status: 'sent',
          is_spotlight: true
        })
        .select();

      if (error) {
        console.error("Database error:", error);
        throw error;
      }

      console.log("Post created successfully:", data);

      toast({
        title: "Made public!",
        description: "Your message has been added to the Spotlight feed"
      });
      
      setIsOpen(false);
    } catch (error) {
      console.error("Error making post public:", error);
      toast({
        title: "Error",
        description: "Failed to make post public. Please try again.",
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
          <DialogTitle>Share to Spotlight?</DialogTitle>
          <DialogDescription>
            This will add your message to the public Spotlight feed where all users can see it. Are you sure you want to continue?
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
            {embedCode && (
              <div className="mt-2 text-xs text-muted-foreground">
                Includes embedded content
              </div>
            )}
          </div>
          
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-sm text-amber-800">
              <strong>Note:</strong> Once shared to Spotlight, this content will be visible to all users and cannot be easily removed.
            </p>
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
              {loading ? "Sharing..." : "Share to Spotlight"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
