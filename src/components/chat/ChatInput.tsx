import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogTrigger, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Send, Plus } from "lucide-react";
import { MediaUpload } from "@/components/MediaUpload";
import { useToast } from "@/hooks/use-toast";

interface ChatInputProps {
  onSendMessage: (message: string) => Promise<void>;
  onSendMedia?: (mediaUrl: string, mediaType?: string) => Promise<void>;
  placeholder?: string;
  disabled?: boolean;
  onTyping?: () => void;
}

export const ChatInput = ({ onSendMessage, onSendMedia, placeholder = "Type your message...", disabled = false, onTyping }: ChatInputProps) => {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [mediaDialogOpen, setMediaDialogOpen] = useState(false);
  const { toast } = useToast();

  const handleSend = async () => {
    if (!message.trim() || sending) return;
    
    setSending(true);
    try {
      const processedMessage = linkifyText(message.trim());
      await onSendMessage(processedMessage);
      setMessage("");
      adjustTextareaHeight();
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleMediaSelected = async (mediaUrl: string, mediaType?: string) => {
    setMediaDialogOpen(false);
    if (onSendMedia) {
      try {
        await onSendMedia(mediaUrl, mediaType);
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to send media",
          variant: "destructive",
        });
      }
    }
  };

  const adjustTextareaHeight = () => {
    const textarea = document.querySelector('textarea');
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }
  };

const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
  setMessage(e.target.value);
  adjustTextareaHeight();
  onTyping?.();
};

  const linkifyText = (text: string): string => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-primary underline">$1</a>');
  };

  return (
    <div className="flex items-end gap-2 p-4 border-t bg-card">
      <Dialog open={mediaDialogOpen} onOpenChange={setMediaDialogOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="shrink-0"
            disabled={disabled}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <VisuallyHidden>
            <DialogTitle>Upload Media</DialogTitle>
            <DialogDescription>
              Upload an image or video to share in the chat
            </DialogDescription>
          </VisuallyHidden>
          <MediaUpload
            onMediaSelected={handleMediaSelected}
            className="w-full"
            bucket="chat-media"
            showPreview={true}
          />
        </DialogContent>
      </Dialog>

      <div className="flex-1 min-w-0">
        <Textarea
          value={message}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || sending}
          className="min-h-[56px] max-h-[120px] resize-none rounded-2xl bg-muted/30 border-2 border-muted-foreground/20 focus:border-primary/50 focus:bg-background transition-all px-4 py-3 text-base"
          rows={2}
        />
      </div>

      <Button
        onClick={handleSend}
        disabled={!message.trim() || sending || disabled}
        size="icon"
        className="shrink-0 rounded-xl"
      >
        <Send className="h-4 w-4" />
      </Button>
    </div>
  );
};