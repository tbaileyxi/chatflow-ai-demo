import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Send, Plus, Smile, Image, Video, X } from 'lucide-react';
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
  const [dragOver, setDragOver] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<File[]>([]);
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

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const uploadSingleFile = useCallback(async (file: File) => {
    try {
      const ext = file.name.split('.').pop() || 'dat';
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { data, error } = await supabase.storage
        .from('chat-media')
        .upload(fileName, file);
      if (error) throw error;
      const { data: pub } = supabase.storage
        .from('chat-media')
        .getPublicUrl(data.path);
      const type: 'image' | 'video' = file.type.startsWith('video/') ? 'video' : 'image';
      await onSendMedia(pub.publicUrl, type);
    } catch (error) {
      console.error('Error uploading media:', error);
      toast({
        title: "Upload failed",
        description: "Please try again.",
        variant: "destructive"
      });
    } finally {
      setUploadingFiles(prev => prev.filter(f => f !== file));
    }
  }, [onSendMedia, toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    const mediaFiles = files.filter(file => 
      file.type.startsWith('image/') || file.type.startsWith('video/')
    );
    
    if (mediaFiles.length > 0) {
      setUploadingFiles(prev => [...prev, ...mediaFiles]);
      mediaFiles.forEach(file => uploadSingleFile(file));
    }
  }, [uploadSingleFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setUploadingFiles(prev => [...prev, ...files]);
      files.forEach(file => uploadSingleFile(file));
    }
  }, [uploadSingleFile]);

  const removeUploadingFile = useCallback((index: number) => {
    setUploadingFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Stop typing indicator when component unmounts or message is sent
  useEffect(() => {
    return () => onTyping?.(false);
  }, [onTyping]);

  return (
    <div className="relative">
      {/* Drag overlay */}
      {dragOver && (
        <div className="absolute inset-0 z-50 bg-primary/10 border-2 border-dashed border-primary rounded-lg flex items-center justify-center">
          <div className="text-primary font-medium">Drop files to upload</div>
        </div>
      )}
      
      <div 
        className="p-4 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 border-t border-border sticky bottom-0 left-0 right-0 pb-[calc(env(safe-area-inset-bottom)+12px)]"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* File previews */}
        {uploadingFiles.length > 0 && (
          <div className="mb-3 flex gap-2 flex-wrap">
            {uploadingFiles.map((file, index) => (
              <div key={index} className="relative group">
                <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center">
                  {file.type.startsWith('image/') ? (
                    <Image className="w-6 h-6 text-muted-foreground" />
                  ) : (
                    <Video className="w-6 h-6 text-muted-foreground" />
                  )}
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  className="absolute -top-2 -right-2 h-6 w-6 p-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => removeUploadingFile(index)}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        )}

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
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,video/*"
              className="hidden"
              onChange={handleFileSelect}
            />
            <Button
              variant="ghost"
              size="sm"
              className="h-12 w-12 p-0 hover:bg-muted rounded-full"
              disabled={disabled || sending}
              onClick={() => fileInputRef.current?.click()}
              aria-label="Add media"
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