import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Send, Plus, Smile, Camera, Image, Trophy, Video, Bot } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';

interface RetroChatInputProps {
  onSendMessage: (content: string) => Promise<void>;
  onSendMedia?: (url: string, type: 'image' | 'video') => Promise<void>;
  onTyping?: (isTyping: boolean) => void;
  placeholder?: string;
  disabled?: boolean;
  huddleId?: string;
  userId?: string;
  onSlashStart?: (command: string) => void;
  onSlashComplete?: (success: boolean) => void;
  onPickEm?: () => void;
  showPickEm?: boolean;
  teamName?: string;
  isAdmin?: boolean;
}

const TEAM_EMOJIS = [
  '🔥', '💪', '🦬', '⭐', '🏆', '💯', '👏', '🙌', '❤️',
  '😤', '🤝', '👊', '💥', '⚽', '🏀', '🏈', '⚾', '🎯', '🚀'
];

export const RetroChatInput = ({ 
  onSendMessage, 
  onSendMedia, 
  onTyping,
  placeholder = "Chat here...",
  disabled = false,
  huddleId,
  userId,
  onSlashStart,
  onSlashComplete,
  onPickEm,
  showPickEm = false,
  teamName,
  isAdmin = false
}: RetroChatInputProps) => {
  const [message, setMessage] = useState('');
  const [emojiPopoverOpen, setEmojiPopoverOpen] = useState(false);
  const [mediaOptionsOpen, setMediaOptionsOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const videoSelectInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleSend = useCallback(async () => {
    if (!message.trim() || sending || disabled) return;

    setSending(true);
    try {
      const trimmedMessage = message.trim();
      
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
    
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 100)}px`;
    }

    onTyping?.(value.length > 0);
  }, [onTyping]);

  const handleEmojiSelect = useCallback((emoji: string) => {
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newMessage = message.slice(0, start) + emoji + message.slice(end);
      setMessage(newMessage);
      
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

      const fileType = file.type.startsWith('video/') ? 'video' : 'image';
      
      toast({
        title: "Upload successful",
        description: `${fileType} uploaded successfully`,
      });

      await onSendMedia?.(publicUrl, fileType);

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

  const handleSlashCommand = useCallback(async (command: string) => {
    if (!huddleId || !userId) {
      toast({
        title: "Error",
        description: "Unable to process command right now.",
        variant: "destructive"
      });
      return;
    }

    let normalizedCommand = command.trim();
    if (normalizedCommand.startsWith('?')) {
      normalizedCommand = '/' + normalizedCommand.slice(1);
    }
    normalizedCommand = normalizedCommand.replace(/[?!.]*$/, '');

    const parts = normalizedCommand.split(' ');
    const cmd = parts[0].toLowerCase();
    const teamNameArg = parts.slice(1).join(' ');

    onSlashStart?.(normalizedCommand);

    if (cmd === '/score' || cmd === '/stats') {
      try {
        const response = await supabase.functions.invoke('sports-stats', {
          body: {
            command: cmd,
            huddleId,
            userId,
            teamName: teamNameArg
          }
        });

        if (response.error) throw response.error;

        toast({
          title: "Command sent",
          description: `Fetching ${cmd === '/score' ? 'score' : 'stats'}${teamNameArg ? ` for ${teamNameArg}` : ''}...`,
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
        const { data: activeInstance } = await supabase
          .from('pickem_instances')
          .select('id, title, status')
          .eq('huddle_id', huddleId)
          .eq('status', 'open')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (activeInstance) {
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
        description: `Command "${cmd}" not recognized. Available: /score [team], /stats [team], /pickem`,
        variant: "destructive"
      });
      onSlashComplete?.(false);
    }
  }, [huddleId, userId, toast]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
    e.target.value = '';
  }, [handleFileUpload]);

  const handleCoachClick = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    
    // Insert @coach at cursor position (or beginning if empty)
    const newMessage = message.slice(0, start) + '@coach ' + message.slice(end);
    setMessage(newMessage);
    
    // Focus textarea and set cursor after @coach 
    setTimeout(() => {
      textarea.focus();
      const newPosition = start + 7; // "@coach " is 7 chars
      textarea.setSelectionRange(newPosition, newPosition);
      
      // Trigger resize
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 100)}px`;
    }, 0);
  }, [message]);

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
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        capture="environment"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
      <input
        ref={videoSelectInputRef}
        type="file"
        accept="video/*"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
      
      <motion.div 
        className="p-3 bg-team-primary/10 border-t border-team-primary/30 sticky bottom-0 left-0 right-0 pb-[calc(env(safe-area-inset-bottom)+8px)]"
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        <div className="flex gap-2 items-end max-w-4xl mx-auto">
          {/* Single Media/Action Button */}
          <Popover open={mediaOptionsOpen} onOpenChange={setMediaOptionsOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-10 w-10 p-0 bg-team-primary/20 border border-team-primary/40 hover:bg-team-primary/30 rounded-full retro-button-glow"
                disabled={disabled || sending || uploading}
                aria-label="Add media"
              >
                <Plus className="w-5 h-5 text-team-primary" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2 bg-background/95 backdrop-blur-sm border-team-primary/30" side="top">
              <div className="space-y-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    cameraInputRef.current?.click();
                    setMediaOptionsOpen(false);
                  }}
                  className="justify-start h-10 w-full font-exo2"
                  disabled={disabled || sending || uploading}
                >
                  <Camera className="h-4 w-4 mr-2" />
                  Take Photo
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    photoInputRef.current?.click();
                    setMediaOptionsOpen(false);
                  }}
                  className="justify-start h-10 w-full font-exo2"
                  disabled={disabled || sending || uploading}
                >
                  <Image className="h-4 w-4 mr-2" />
                  Choose Photo
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    videoInputRef.current?.click();
                    setMediaOptionsOpen(false);
                  }}
                  className="justify-start h-10 w-full font-exo2"
                  disabled={disabled || sending || uploading}
                >
                  <Video className="h-4 w-4 mr-2" />
                  Record Video
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    videoSelectInputRef.current?.click();
                    setMediaOptionsOpen(false);
                  }}
                  className="justify-start h-10 w-full font-exo2"
                  disabled={disabled || sending || uploading}
                >
                  <Video className="h-4 w-4 mr-2" />
                  Choose Video
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          {/* Main input area */}
          <div className="flex-1 relative">
            <Textarea
              ref={textareaRef}
              value={message}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled || sending}
              className={cn(
                "resize-none min-h-[40px] max-h-[100px] pl-4 pr-12 py-3",
                "border-2 border-team-primary/40 focus:border-team-primary transition-colors",
                "bg-background/50 backdrop-blur-sm text-foreground placeholder:text-muted-foreground",
                "rounded-xl font-exo2",
                "retro-input-glow"
              )}
              rows={1}
            />
            
            {/* Emoji button inside textarea */}
            <Popover open={emojiPopoverOpen} onOpenChange={setEmojiPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 p-0 hover:bg-team-primary/20 rounded-full"
                  disabled={disabled || sending}
                >
                  <Smile className="w-4 h-4 text-team-primary" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-3 bg-background/95 backdrop-blur-sm border-team-primary/30" align="end">
                <div className="grid grid-cols-5 gap-2">
                  {TEAM_EMOJIS.map((emoji) => (
                    <Button
                      key={emoji}
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-lg hover:bg-team-primary/20 hover:scale-110 transition-all duration-200 rounded-full"
                      onClick={() => handleEmojiSelect(emoji)}
                    >
                      {emoji}
                    </Button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>
          
          {/* Coach button */}
          <Button
            variant="ghost"
            size="sm"
            className="h-10 w-10 p-0 bg-team-primary/20 border border-team-primary/40 hover:bg-team-primary/30 rounded-full retro-button-glow"
            disabled={disabled || sending}
            onClick={handleCoachClick}
            aria-label="Ask Coach"
          >
            <Bot className="w-5 h-5 text-team-primary" />
          </Button>
          
          {/* Send button */}
          <Button
            onClick={handleSend}
            disabled={!message.trim() || sending || disabled}
            size="sm"
            className={cn(
              "h-10 w-10 p-0 rounded-full transition-all duration-200",
              "bg-team-primary hover:bg-team-primary/90 text-white",
              "retro-button-glow hover:scale-105",
              !message.trim() && "opacity-50 cursor-not-allowed"
            )}
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>
      </motion.div>
    </div>
  );
};