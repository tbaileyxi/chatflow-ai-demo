import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Send, Plus, Smile, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { ImprovedMediaUpload } from './ImprovedMediaUpload';

interface ChatInputProps {
  onSendMessage: (content: string) => Promise<void>;
  onSendMedia: (url: string, type: 'image' | 'video') => Promise<void>;
  onTyping?: (isTyping: boolean) => void;
  placeholder?: string;
  disabled?: boolean;
}

const QUICK_EMOJIS = [
  '😀', '😂', '😍', '🤔', '👍', '👎', '❤️', '🔥', '💯', '😎',
  '🎉', '⚽', '🏀', '🏈', '⚾', '🎯', '🏆', '💪', '👏', '🙌'
];

export const ModernChatInput = ({ 
  onSendMessage, 
  onSendMedia, 
  onTyping,
  placeholder = "Type a message...",
  disabled = false 
}: ChatInputProps) => {
  const [message, setMessage] = useState('');
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [emojiPopoverOpen, setEmojiPopoverOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  const handleSend = useCallback(async () => {
    if (!message.trim() || sending || disabled) return;

    setSending(true);
    try {
      await onSendMessage(message.trim());
      setMessage('');
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

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setMessage(value);
    
    // Auto-resize textarea
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }

    // Typing indicator
    onTyping?.(value.length > 0);
  }, [onTyping]);

  const handleEmojiSelect = useCallback((emoji: string) => {
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newMessage = message.slice(0, start) + emoji + message.slice(end);
      setMessage(newMessage);
      
      // Reset cursor position
      setTimeout(() => {
        textarea.setSelectionRange(start + emoji.length, start + emoji.length);
        textarea.focus();
      }, 0);
    }
    setEmojiPopoverOpen(false);
  }, [message]);

  const handleMediaSelected = useCallback(async (url: string, type: 'image' | 'video') => {
    try {
      await onSendMedia(url, type);
      setUploadDialogOpen(false);
    } catch (error) {
      console.error('Error sending media:', error);
      toast({
        title: "Error",
        description: "Failed to send media. Please try again.",
        variant: "destructive"
      });
    }
  }, [onSendMedia, toast]);

  // Stop typing indicator when component unmounts or message is sent
  useEffect(() => {
    return () => onTyping?.(false);
  }, [onTyping]);

  return (
    <div className="relative">
      <div className="p-4 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 border-t border-border sticky bottom-0 left-0 right-0 pb-[calc(env(safe-area-inset-bottom)+12px)]">

        <div className="flex gap-3 items-end">
          {/* Main input area */}
          <div className="flex-1 relative">
            <Textarea
              ref={textareaRef}
              value={message}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onFocus={() => setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 100)}
              placeholder={placeholder}
              disabled={disabled || sending}
              className={cn(
                "resize-none min-h-[96px] max-h-[180px] pl-4 pr-12 py-3",
                "border-2 border-border focus:border-primary transition-colors",
                "bg-background text-foreground placeholder:text-muted-foreground",
                "rounded-2xl"
              )}
              rows={1}
            />
            
            {/* Emoji button inside textarea */}
            <Popover open={emojiPopoverOpen} onOpenChange={setEmojiPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 p-0 hover:bg-muted"
                  disabled={disabled || sending}
                >
                  <Smile className="w-4 h-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-3" align="end">
                <div className="grid grid-cols-5 gap-2">
                  {QUICK_EMOJIS.map((emoji) => (
                    <Button
                      key={emoji}
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-lg hover:bg-muted"
                      onClick={() => handleEmojiSelect(emoji)}
                    >
                      {emoji}
                    </Button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>
          
          {/* Action buttons */}
          <div className="flex gap-2">
            <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-12 w-12 p-0 hover:bg-muted rounded-full"
                  disabled={disabled || sending}
                  aria-label="Add media"
                >
                  <Plus className="w-5 h-5" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <ImprovedMediaUpload
                  onMediaSelected={handleMediaSelected}
                  bucket="chat-media"
                  onClose={() => setUploadDialogOpen(false)}
                />
              </DialogContent>
            </Dialog>
            <Button
              onClick={handleSend}
              disabled={!message.trim() || sending || disabled}
              size="sm"
              className={cn(
                "h-12 w-12 p-0 rounded-full transition-all duration-200",
                "bg-primary hover:bg-primary/90 text-primary-foreground",
                !message.trim() && "opacity-50 cursor-not-allowed"
              )}
            >
              <Send className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};