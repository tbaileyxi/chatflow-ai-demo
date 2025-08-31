import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Send, Plus, Smile } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

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
  const [emojiPopoverOpen, setEmojiPopoverOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const handleFileUpload = useCallback(async (file: File) => {
    if (uploading) return;
    
    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop() || 'dat';
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
      
      const { data, error } = await supabase.storage
        .from('chat-media')
        .upload(fileName, file);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('chat-media')
        .getPublicUrl(data.path);

      const type = file.type.startsWith('video/') ? 'video' : 'image';
      await onSendMedia(publicUrl, type);
      
      toast({
        title: "Upload successful",
        description: `${type} uploaded successfully`,
      });

    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: "Failed to upload file. Please try again.",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  }, [uploading, onSendMedia, toast]);

  const handleMediaButtonClick = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.accept = "image/*,video/*";
      fileInputRef.current.click();
    }
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
    // Reset input value
    e.target.value = '';
  }, [handleFileUpload]);

  // Stop typing indicator when component unmounts or message is sent
  useEffect(() => {
    return () => onTyping?.(false);
  }, [onTyping]);

  return (
    <div className="relative">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
      
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
            <Button
              variant="ghost"
              size="sm"
              className="h-12 w-12 p-0 hover:bg-muted rounded-full"
              disabled={disabled || sending || uploading}
              aria-label="Add media"
              onClick={handleMediaButtonClick}
            >
              <Plus className="w-5 h-5" />
            </Button>
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