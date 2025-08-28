import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Send, Paperclip } from 'lucide-react';
import { MediaUpload } from '@/components/MediaUpload';
import { useToast } from '@/hooks/use-toast';
import { useIOSKeyboard } from '@/hooks/useIOSKeyboard';
import { useThrottle } from '@/utils/performance';

interface ChatInputProps {
  onSendMessage: (content: string) => Promise<void>;
  onSendMedia: (url: string, type: 'image' | 'video') => Promise<void>;
  placeholder?: string;
  disabled?: boolean;
}

export const ChatInput = ({ 
  onSendMessage, 
  onSendMedia, 
  placeholder = "Type a message...",
  disabled = false 
}: ChatInputProps) => {
  const [message, setMessage] = useState('');
  const [mediaDialogOpen, setMediaDialogOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();
  const { setTypingState, isOpen: isKeyboardOpen } = useIOSKeyboard();

  const handleSend = useCallback(async () => {
    if (!message.trim() || sending || disabled) return;

    setSending(true);
    try {
      // Process message to make URLs clickable
      const processedMessage = linkifyText(message.trim());
      await onSendMessage(processedMessage);
      setMessage('');
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive"
      });
    } finally {
      setSending(false);
    }
  }, [message, sending, disabled, onSendMessage, toast]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleMediaSelected = useCallback(async (url: string, type: 'image' | 'video') => {
    try {
      await onSendMedia(url, type);
      setMediaDialogOpen(false);
    } catch (error) {
      console.error('Error sending media:', error);
      toast({
        title: "Error",
        description: "Failed to send media. Please try again.",
        variant: "destructive"
      });
    }
  }, [onSendMedia, toast]);

  // Throttled height adjustment for better iOS performance
  const adjustTextareaHeight = useThrottle(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, 16); // 60fps throttling

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setMessage(value);
    adjustTextareaHeight();
  }, [adjustTextareaHeight]);

  // Handle focus/blur for iOS keyboard detection
  const handleFocus = useCallback(() => {
    setTypingState(true);
  }, [setTypingState]);

  const handleBlur = useCallback(() => {
    setTypingState(false);
  }, [setTypingState]);

  // iOS-specific input handling
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Add iOS-specific event listeners
    const handleTouchStart = (e: TouchEvent) => {
      // Prevent iOS scroll jumping when touching input
      e.stopPropagation();
    };

    textarea.addEventListener('touchstart', handleTouchStart, { passive: false });
    textarea.addEventListener('focus', handleFocus);
    textarea.addEventListener('blur', handleBlur);

    return () => {
      textarea.removeEventListener('touchstart', handleTouchStart);
      textarea.removeEventListener('focus', handleFocus);
      textarea.removeEventListener('blur', handleBlur);
    };
  }, [handleFocus, handleBlur]);

  // Function to make URLs clickable
  const linkifyText = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:underline">$1</a>');
  };

  return (
    <div 
      className="p-4 bg-card border-t border-border"
      style={{
        // iOS keyboard handling
        position: isKeyboardOpen ? 'fixed' : 'relative',
        bottom: isKeyboardOpen ? '0' : 'auto',
        left: isKeyboardOpen ? '0' : 'auto',
        right: isKeyboardOpen ? '0' : 'auto',
        zIndex: isKeyboardOpen ? 1000 : 'auto',
      }}
    >
      <div className="flex gap-2 items-end">
        <div className="flex-1 chat-input-container">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled || sending}
            className="text-input resize-none min-h-[44px] max-h-[120px] pr-12"
            style={{
              // iOS-specific touch handling
              touchAction: 'manipulation',
              WebkitAppearance: 'none',
              WebkitUserSelect: 'text',
            }}
            rows={1}
          />
        </div>
        
        <div className="flex gap-1">
          <Dialog open={mediaDialogOpen} onOpenChange={setMediaDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-10 w-10 p-0"
                disabled={disabled || sending}
              >
                <Paperclip className="w-4 h-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload Media</DialogTitle>
              </DialogHeader>
              <MediaUpload 
                onMediaSelected={handleMediaSelected}
                bucket="huddle-media"
              />
            </DialogContent>
          </Dialog>

          <Button
            onClick={handleSend}
            disabled={!message.trim() || sending || disabled}
            size="sm"
            className="h-10 w-10 p-0 arrow-button"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};