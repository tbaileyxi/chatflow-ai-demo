import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Send, Plus, Smile, Camera, Image, Trophy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface ChatInputProps {
  onSendMessage: (content: string) => Promise<void>;
  onSendMedia: (url: string, type: 'image' | 'video') => Promise<void>;
  onTyping?: (isTyping: boolean) => void;
  placeholder?: string;
  disabled?: boolean;
  huddleId?: string;
  userId?: string;
  onSlashStart?: (command: string) => void;
  onSlashComplete?: (success: boolean) => void;
  onPickEm?: () => void;
  showPickEm?: boolean;
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
  disabled = false,
  huddleId,
  userId,
  onSlashStart,
  onSlashComplete,
  onPickEm,
  showPickEm = false
}: ChatInputProps) => {
  const [message, setMessage] = useState('');
  const [emojiPopoverOpen, setEmojiPopoverOpen] = useState(false);
  const [mediaOptionsOpen, setMediaOptionsOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleSend = useCallback(async () => {
    if (!message.trim() || sending || disabled) return;

    setSending(true);
    try {
      const trimmedMessage = message.trim();
      
      // Check if it's a slash command
      if (trimmedMessage.startsWith('/') || trimmedMessage.startsWith('?')) {
        await handleSlashCommand(trimmedMessage);
      } else {
        await onSendMessage(trimmedMessage);
      }
      
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

  const handleCameraClick = useCallback(() => {
    if (cameraInputRef.current) {
      cameraInputRef.current.click();
    }
    setMediaOptionsOpen(false);
  }, []);

  const handlePhotoLibraryClick = useCallback(() => {
    if (photoInputRef.current) {
      photoInputRef.current.click();
    }
    setMediaOptionsOpen(false);
  }, []);

  const handleMediaButtonClick = useCallback(() => {
    setMediaOptionsOpen(!mediaOptionsOpen);
  }, [mediaOptionsOpen]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
    // Reset input value
    e.target.value = '';
  }, [handleFileUpload]);

  const handleSlashCommand = useCallback(async (command: string) => {
    if (!huddleId || !userId) {
      toast({
        title: "Error",
        description: "Unable to process command right now.",
        variant: "destructive"
      });
      return;
    }

    // Normalize command - remove punctuation, convert ? to /
    let normalizedCommand = command.trim();
    if (normalizedCommand.startsWith('?')) {
      normalizedCommand = '/' + normalizedCommand.slice(1);
    }
    normalizedCommand = normalizedCommand.replace(/[?!.]*$/, ''); // Remove trailing punctuation

    const parts = normalizedCommand.split(' ');
    const cmd = parts[0].toLowerCase();
    const teamName = parts.slice(1).join(' ');

    // Trigger ephemeral start callback
    onSlashStart?.(normalizedCommand);

    if (cmd === '/score' || cmd === '/stats') {
      try {
        const response = await supabase.functions.invoke('sports-stats', {
          body: {
            command: cmd,
            huddleId,
            userId,
            teamName
          }
        });

        if (response.error) throw response.error;

        toast({
          title: "Command sent",
          description: `Fetching ${cmd === '/score' ? 'score' : 'stats'}${teamName ? ` for ${teamName}` : ''}...`,
        });
        onSlashComplete?.(true);
      } catch (error) {
        console.error('Slash command error:', error);
        toast({
          title: "Command failed",
          description: "Unable to process command. Please try again.",
          variant: "destructive"
        });
        onSlashComplete?.(false);
      }
    } else if (cmd === '/pickem') {
      try {
        // Find active pick'em instance for this huddle
        const { data: activeInstance } = await supabase
          .from('pickem_instances')
          .select('id, title, status')
          .eq('huddle_id', huddleId)
          .eq('status', 'open')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (activeInstance) {
          // Post existing pick'em card as current user
          await supabase.from('huddle_messages').insert({
            huddle_id: huddleId,
            user_id: userId,
            content: 'Current Pick \'em challenge:',
            message_type: 'pickem_card',
            embed_code: JSON.stringify({
              type: 'pickem_card',
              instanceId: activeInstance.id,
              title: activeInstance.title,
              gameCount: 0
            }),
            is_bot_message: false
          });
          
          toast({
            title: "Pick 'em displayed",
            description: "Current pick 'em challenge posted!",
          });
        } else {
          // Create new pick'em for current week
          const response = await supabase.functions.invoke('pickem-create-week', {
            body: { huddleId }
          });

          if (response.error) throw response.error;

          toast({
            title: "Pick 'em created",
            description: "New pick 'em challenge created for this week!",
          });
        }
        onSlashComplete?.(true);
      } catch (error) {
        console.error('Pick em command error:', error);
        toast({
          title: "Command failed",
          description: "Unable to create or display pick 'em. Please try again.",
          variant: "destructive"
        });
        onSlashComplete?.(false);
      }
    } else {
      toast({
        title: "Unknown command",
        description: "Available: /score [team], /stats [team], /pickem, /score nfl, /score college. You can also use ? instead of /",
        variant: "destructive"
      });
      onSlashComplete?.(false);
    }
  }, [huddleId, userId, toast]);

  // Stop typing indicator when component unmounts or message is sent
  useEffect(() => {
    return () => onTyping?.(false);
  }, [onTyping]);

  return (
    <div className="relative">
      {/* Hidden file inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
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
          <div className="flex gap-2 items-end">
            {/* Media options */}
            {mediaOptionsOpen && (
              <div className="flex gap-2 mb-0">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-12 w-12 p-0 hover:bg-muted rounded-full"
                  disabled={disabled || sending || uploading}
                  aria-label="Take photo"
                  onClick={handleCameraClick}
                >
                  <Camera className="w-5 h-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-12 w-12 p-0 hover:bg-muted rounded-full"
                  disabled={disabled || sending || uploading}
                  aria-label="Photo library"
                  onClick={handlePhotoLibraryClick}
                >
                  <Image className="w-5 h-5" />
                </Button>
                {showPickEm && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-12 w-12 p-0 hover:bg-muted rounded-full text-primary"
                    disabled={disabled || sending}
                    aria-label="Start Pick 'Em"
                    onClick={() => {
                      onPickEm?.();
                      setMediaOptionsOpen(false);
                    }}
                  >
                    <Trophy className="w-5 h-5" />
                  </Button>
                )}
              </div>
            )}
            
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