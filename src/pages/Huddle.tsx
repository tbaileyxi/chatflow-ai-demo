import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { RetroHuddleLayout } from '@/components/retro/RetroHuddleLayout';
import { RetroVirtualizedChat } from '@/components/retro/RetroVirtualizedChat';
import { RetroChatInput } from '@/components/retro/RetroChatInput';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PickEmView } from '@/components/pickem/PickEmView';
import { useToast } from '@/hooks/use-toast';

export const Huddle = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [huddle, setHuddle] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickEmViewId, setPickEmViewId] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  
  const chatChannelRef = useRef<any>(null);
  const typingChannelRef = useRef<any>(null);
  const lastTypingSentRef = useRef<number>(0);

  // Load huddle data
  useEffect(() => {
    if (!id) return;
    
    const loadHuddle = async () => {
      try {
        // Load huddle with basic query
        const huddleResponse = await fetch(`/api/huddle/${id}`).catch(() => null);
        
        if (huddleResponse?.ok) {
          const huddleData = await huddleResponse.json();
          setHuddle(huddleData);
        } else {
          // Fallback to direct supabase query with simple structure
          const { data: huddleData } = await (supabase as any)
            .from('huddles')
            .select('*, team:teams!inner(*)')
            .eq('id', id)
            .single();

          if (!huddleData) {
            navigate('/not-found');
            return;
          }
          setHuddle(huddleData);
        }

        // Load messages with simple structure
        const { data: rawMessages } = await supabase
          .from('messages')
          .select('*')
          .eq('huddle_id', id)
          .order('created_at', { ascending: true })
          .limit(100);

        if (rawMessages) {
          // Get user profiles for messages
          const messageUserIds = [...new Set(rawMessages.map((m: any) => m.user_id))];
          const { data: profiles } = await supabase
            .from('profiles')
            .select('*')
            .in('id', messageUserIds);

          const profileMap = (profiles || []).reduce((acc: any, profile: any) => {
            acc[profile.id] = profile;
            return acc;
          }, {});

          const messagesWithProfiles = rawMessages.map((message: any) => ({
            ...message,
            profiles: profileMap[message.user_id]
          }));

          setMessages(messagesWithProfiles);
        }
        
      } catch (error) {
        console.error('Error loading huddle:', error);
        toast({
          title: "Error",
          description: "Failed to load huddle",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    loadHuddle();
  }, [id, navigate, toast]);

  // Real-time subscriptions
  useEffect(() => {
    if (!id || !user) return;

    // Subscribe to new messages
    const messagesChannel = supabase
      .channel(`messages:${id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `huddle_id=eq.${id}`
      }, async (payload) => {
        if (payload.new) {
          // Get profile for new message
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', (payload.new as any).user_id)
            .single();

          const messageWithProfile = {
            ...payload.new,
            profiles: profile
          };

          setMessages(prev => [...prev, messageWithProfile]);
        }
      })
      .subscribe();

    // Subscribe to typing indicators
    const typingChannel = supabase
      .channel(`typing:${id}`)
      .on('broadcast', { event: 'typing' }, (payload) => {
        if (payload.payload.userId !== user.id) {
          setTypingUsers(prev => {
            const filtered = prev.filter(u => u !== payload.payload.name);
            return [...filtered, payload.payload.name];
          });
          
          // Clear typing after 3 seconds
          setTimeout(() => {
            setTypingUsers(prev => prev.filter(u => u !== payload.payload.name));
          }, 3000);
        }
      })
      .subscribe();

    chatChannelRef.current = messagesChannel;
    typingChannelRef.current = typingChannel;

    return () => {
      messagesChannel.unsubscribe();
      typingChannel.unsubscribe();
    };
  }, [id, user]);

  // Send message
  const sendMessage = useCallback(async (content: string) => {
    if (!id || !user || !content.trim()) return;

    try {
      // Simple direct insert with manual data structure
      const messageData = {
        id: crypto.randomUUID(),
        content: content.trim(),
        huddle_id: id,
        user_id: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Optimistically add to local state
      const messageWithProfile = {
        ...messageData,
        profiles: {
          id: user.id,
          display_name: user.user_metadata?.display_name || user.email?.split('@')[0] || 'User',
          username: user.email?.split('@')[0] || 'user',
          avatar_url: user.user_metadata?.avatar_url
        }
      };
      setMessages(prev => [...prev, messageWithProfile]);

      // Send to database (fire and forget for better UX)
      (supabase as any)
        .from('messages')
        .insert([messageData])
        .then(({ error }) => {
          if (error) {
            console.error('Error persisting message:', error);
            // Remove from local state if failed
            setMessages(prev => prev.filter(m => m.id !== messageData.id));
            toast({
              title: "Error",
              description: "Failed to send message",
              variant: "destructive",
            });
          }
        });
        
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
    }
  }, [id, user, toast]);

  // Send media message
  const sendMediaMessage = useCallback(async (file: File) => {
    if (!id || !user) return;

    try {
      toast({
        title: "Uploading...",
        description: "Uploading media file",
      });

      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `huddle-media/${id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(filePath);

      // Create message with media
      const messageData = {
        id: crypto.randomUUID(),
        content: `[Shared ${file.type.startsWith('image/') ? 'image' : 'video'}]`,
        huddle_id: id,
        user_id: user.id,
        media_url: publicUrl,
        media_type: file.type.startsWith('image/') ? 'image' : 'video',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Add to local state immediately
      const messageWithProfile = {
        ...messageData,
        profiles: {
          id: user.id,
          display_name: user.user_metadata?.display_name || user.email?.split('@')[0] || 'User',
          username: user.email?.split('@')[0] || 'user',
          avatar_url: user.user_metadata?.avatar_url
        }
      };
      setMessages(prev => [...prev, messageWithProfile]);

      // Persist to database
      const { error } = await (supabase as any)
        .from('messages')
        .insert([messageData]);

      if (error) throw error;

      toast({
        title: "Uploaded!",
        description: "Media shared successfully",
      });
    } catch (error) {
      console.error('Error sending media:', error);
      toast({
        title: "Error",
        description: "Failed to send media",
        variant: "destructive",
      });
    }
  }, [id, user, toast]);

  // Message actions
  const handleMegaphone = useCallback(async (messageId: string) => {
    try {
      const message = messages.find(m => m.id === messageId);
      if (!message) return;

      toast({
        title: "Broadcasted!",
        description: "Message sent to Spotlight Feed",
      });
    } catch (error) {
      console.error('Error broadcasting:', error);
      toast({
        title: "Error",
        description: "Failed to broadcast message",
        variant: "destructive",
      });
    }
  }, [messages, toast]);

  const handleHighlight = useCallback(async (messageId: string) => {
    try {
      // Update local state for immediate feedback
      setMessages(prev => prev.map(m => 
        m.id === messageId ? { ...m, is_highlighted: true } : m
      ));
      
      toast({
        title: "Highlighted!",
        description: "Message added to highlights",
      });
    } catch (error) {
      console.error('Error highlighting:', error);
    }
  }, [toast]);

  const handleCopyCallout = useCallback(async (messageId: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      await handleHighlight(messageId);
      
      toast({
        title: "Called Out!",
        description: "Message copied and highlighted",
      });
    } catch (error) {
      console.error('Error calling out:', error);
    }
  }, [handleHighlight, toast]);

  const handleViewPickEm = useCallback((instanceId: string) => {
    setPickEmViewId(instanceId);
  }, []);

  if (loading) {
    return (
      <RetroHuddleLayout teamName="Loading..." huddleId="">
        <div className="flex items-center justify-center h-full">
          <div className="text-muted-foreground font-arcade">Loading huddle...</div>
        </div>
      </RetroHuddleLayout>
    );
  }

  if (!huddle) {
    return (
      <RetroHuddleLayout teamName="Not Found" huddleId="">
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <h3 className="text-xl font-semibold mb-2 font-orbitron">Huddle not found</h3>
            <p className="text-muted-foreground font-exo2">This huddle may not exist or you don't have access to it.</p>
          </div>
        </div>
      </RetroHuddleLayout>
    );
  }

  return (
    <RetroHuddleLayout 
      huddleId={id!} 
      teamName={huddle?.team?.name}
      huddle={huddle}
      messages={messages.filter(m => m.is_highlighted)}
      currentUserId={user?.id}
    >
      <RetroVirtualizedChat
        items={messages}
        currentUserId={user?.id}
        isAdmin={user?.id === huddle?.owner_id}
        onMegaphone={handleMegaphone}
        onHighlight={handleHighlight}
        onCopyCallout={handleCopyCallout}
        teamName={huddle?.team?.name}
        getItemKey={(message) => message.id}
      />
      
      <RetroChatInput
        onSendMessage={sendMessage}
        onSendMedia={sendMediaMessage}
        placeholder="Share your thoughts..."
        disabled={loading}
        huddleId={id!}
        teamName={huddle?.team?.name}
        onTyping={(isTyping) => {
          if (isTyping && user?.id) {
            const now = Date.now();
            if (now - (lastTypingSentRef.current || 0) > 1200) {
              lastTypingSentRef.current = now;
              const name = user.user_metadata?.display_name || user.email?.split('@')[0] || 'User';
              typingChannelRef.current?.send({
                type: 'broadcast',
                event: 'typing',
                payload: { userId: user.id, name: name }
              });
            }
          }
        }}
      />

      {/* Pick 'Em View Dialog */}
      {pickEmViewId && (
        <Dialog open={!!pickEmViewId} onOpenChange={() => setPickEmViewId(null)}>
          <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle className="font-orbitron">Pick 'Em Details</DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto">
              <PickEmView 
                instanceId={pickEmViewId} 
                onBack={() => setPickEmViewId(null)} 
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </RetroHuddleLayout>
  );
};