import React, { useState, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Mic, Camera, Bot } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface RoomChatInputProps {
  huddleId: string;
  userId?: string;
  onSendMessage: (content: string, mediaUrl?: string) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
}

export interface RoomChatInputRef {
  insertEmoji: (emoji: string) => void;
}

export const RoomChatInput = forwardRef<RoomChatInputRef, RoomChatInputProps>(function RoomChatInput({
  huddleId,
  userId,
  onSendMessage,
  disabled = false,
  placeholder = "Say something..."
}, ref) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Expose insertEmoji method for badge click
  useImperativeHandle(ref, () => ({
    insertEmoji: (emoji: string) => {
      setMessage(prev => prev + emoji);
      textareaRef.current?.focus();
    }
  }), []);

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
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  }, [message, sending, disabled, onSendMessage]);

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
  }, []);

  const handleCoachClick = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newMessage = message.slice(0, start) + '@coach ' + message.slice(end);
    setMessage(newMessage);
    
    setTimeout(() => {
      textarea.focus();
      const newPosition = start + 7;
      textarea.setSelectionRange(newPosition, newPosition);
    }, 0);
  }, [message]);

  const handleFileUpload = useCallback(async (file: File) => {
    if (uploading) return;
    
    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop() || 'jpg';
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
      
      const { data, error } = await supabase.storage
        .from('chat-media')
        .upload(fileName, file);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('chat-media')
        .getPublicUrl(data.path);

      await onSendMessage('📷 Photo', publicUrl);
      toast.success('Photo uploaded!');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload photo');
    } finally {
      setUploading(false);
    }
  }, [uploading, onSendMessage]);

  const handleCameraCapture = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
    e.target.value = '';
  }, [handleFileUpload]);

  return (
    <>
      {/* Hidden camera input */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleCameraCapture}
        style={{ display: 'none' }}
      />

      <div className="flex gap-2 items-end">

        {/* Camera Button */}
        <Button
          variant="ghost"
          size="sm"
          className="h-10 w-10 p-0 rounded-full border border-muted-foreground/30 text-muted-foreground hover:text-primary hover:border-primary"
          onClick={() => cameraInputRef.current?.click()}
          disabled={disabled || uploading}
          aria-label="Take photo"
        >
          <Camera className="w-5 h-5" />
        </Button>

        {/* Coach Button */}
        <Button
          variant="ghost"
          size="sm"
          className="h-10 w-10 p-0 border-2 border-yellow-400 bg-transparent text-yellow-400 hover:bg-yellow-400/20 rounded-full"
          disabled={disabled || sending}
          onClick={handleCoachClick}
          aria-label="Ask Coach"
        >
          <Bot className="w-5 h-5" />
        </Button>

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
              "resize-none min-h-[40px] max-h-[100px] pl-4 pr-4 py-3",
              "border border-border/50 focus:border-primary transition-colors",
              "bg-background/50 backdrop-blur-sm text-foreground placeholder:text-muted-foreground",
              "rounded-xl"
            )}
            rows={1}
          />
        </div>
        
        {/* Send button */}
        <Button
          onClick={handleSend}
          disabled={!message.trim() || sending || disabled}
          size="sm"
          className={cn(
            "h-10 w-10 p-0 rounded-full transition-all duration-200 shadow-lg",
            "bg-primary hover:bg-primary/90 text-primary-foreground",
            "hover:scale-105",
            !message.trim() && "opacity-50 cursor-not-allowed"
          )}
        >
          <Send className="w-5 h-5" />
        </Button>
      </div>

      {/* Voice Drop Modal (Coming Soon) */}
      <Dialog open={showVoiceModal} onOpenChange={setShowVoiceModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mic className="h-5 w-5 text-primary" />
              Voice Drop
            </DialogTitle>
          </DialogHeader>
          <div className="text-center py-8">
            <div className="text-4xl mb-4">🎙️</div>
            <p className="text-lg font-semibold mb-2">Coming Next: Voice Drop</p>
            <p className="text-muted-foreground">
              Record quick voice messages to share your live reactions with the huddle.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Camera Modal (Coming Soon) - keeping for future video */}
      <Dialog open={showCameraModal} onOpenChange={setShowCameraModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5 text-primary" />
              Take
            </DialogTitle>
          </DialogHeader>
          <div className="text-center py-8">
            <div className="text-4xl mb-4">📹</div>
            <p className="text-lg font-semibold mb-2">Coming Next: Video Takes</p>
            <p className="text-muted-foreground">
              Record quick video reactions to share with the huddle.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
});
