import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface Message {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  media_url?: string;
  media_type?: string;
  embed_code?: string;
  embeds?: Array<{
    commentary: string;
    embed_code: string;
    embed_type: 'x' | 'iframe' | 'youtube';
  }>;
  poll_data?: any;
  is_team_agent_message?: boolean;
  origin_team_id?: string;
  origin_teams?: {
    name: string;
    logo_url?: string;
  } | null;
  profiles?: {
    display_name?: string;
    username?: string;
    avatar_url?: string;
  } | null;
  reactions?: {
    [emoji: string]: {
      count: number;
      users: string[];
    };
  };
}

interface UseOptimizedMessagesReturn {
  messages: Message[];
  loading: boolean;
  hasMore: boolean;
  loadingOlder: boolean;
  loadOlderMessages: () => Promise<void>;
  addMessage: (message: Message) => void;
  sendMessage: (content: string) => Promise<void>;
  fetchMessageReactions: (messageId: string) => Promise<any>;
}

export const useOptimizedMessages = (huddleId: string): UseOptimizedMessagesReturn => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [oldestCreatedAt, setOldestCreatedAt] = useState<string | null>(null);
  
  const PAGE_SIZE = 50; // Increased for better performance
  const profileCacheRef = useRef<Map<string, any>>(new Map());
  const reactionCacheRef = useRef<Map<string, any>>(new Map());

  // Memoized profile fetcher with caching
  const fetchProfile = useCallback(async (userId: string) => {
    if (profileCacheRef.current.has(userId)) {
      return profileCacheRef.current.get(userId);
    }

    try {
      const { data } = await supabase.rpc('get_public_profile', { target_user_id: userId });
      const profile = Array.isArray(data) ? data[0] : data;
      if (profile) {
        profileCacheRef.current.set(userId, profile);
      }
      return profile;
    } catch (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
  }, []);

  // Batch profile fetching for better performance
  const fetchProfilesBatch = useCallback(async (userIds: string[]) => {
    const uncachedIds = userIds.filter(id => !profileCacheRef.current.has(id));
    
    if (uncachedIds.length === 0) {
      return userIds.map(id => profileCacheRef.current.get(id));
    }

    try {
      const profilePromises = uncachedIds.map(userId => 
        supabase.rpc('get_public_profile', { target_user_id: userId })
      );
      const results = await Promise.all(profilePromises);
      
      results.forEach((result, index) => {
        const profile = Array.isArray(result.data) ? result.data[0] : result.data;
        if (profile) {
          profileCacheRef.current.set(uncachedIds[index], profile);
        }
      });

      return userIds.map(id => profileCacheRef.current.get(id));
    } catch (error) {
      console.error('Error batch fetching profiles:', error);
      return [];
    }
  }, []);

  // Optimized message reactions fetcher with caching
  const fetchMessageReactions = useCallback(async (messageId: string) => {
    if (reactionCacheRef.current.has(messageId)) {
      return reactionCacheRef.current.get(messageId);
    }

    try {
      const { data, error } = await supabase
        .from('huddle_message_reactions')
        .select('emoji, user_id')
        .eq('message_id', messageId);

      if (error) throw error;

      const reactions: { [emoji: string]: { count: number; users: string[] } } = {};
      data?.forEach(reaction => {
        if (!reactions[reaction.emoji]) {
          reactions[reaction.emoji] = { count: 0, users: [] };
        }
        reactions[reaction.emoji].count++;
        reactions[reaction.emoji].users.push(reaction.user_id);
      });

      reactionCacheRef.current.set(messageId, reactions);
      return reactions;
    } catch (error) {
      console.error('Error fetching reactions:', error);
      return {};
    }
  }, []);

  // Initial messages fetch with optimizations
  const fetchMessages = useCallback(async () => {
    if (!huddleId) return;

    try {
      setLoading(true);
      
      const { data: messagesData, error } = await supabase
        .from("huddle_messages")
        .select(`
          id,
          content,
          created_at,
          user_id,
          media_url,
          media_type,
          embed_code,
          embeds,
          poll_data,
          is_team_agent_message,
          origin_team_id,
          origin_teams:teams!origin_team_id(name, logo_url)
        `)
        .eq("huddle_id", huddleId)
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);

      if (error) throw error;

      const reversed = (messagesData || []).slice().reverse();
      
      // Batch fetch profiles for better performance
      const userIds = [...new Set(reversed.map(m => m.user_id).filter(Boolean))];
      const profiles = await fetchProfilesBatch(userIds);
      const profileMap = new Map(userIds.map((id, index) => [id, profiles[index]]));

      const messagesWithProfiles = reversed.map(message => ({
        ...message,
        embeds: message.embeds as any,
        profiles: profileMap.get(message.user_id) || null
      }));

      setMessages(messagesWithProfiles);
      setOldestCreatedAt(messagesWithProfiles[0]?.created_at || null);
      setHasMore((messagesData?.length || 0) === PAGE_SIZE);

      // Batch fetch reactions for visible messages (debounced)
      setTimeout(() => {
        messagesWithProfiles.forEach(message => {
          fetchMessageReactions(message.id);
        });
      }, 100);

    } catch (error) {
      console.error("Error fetching messages:", error);
    } finally {
      setLoading(false);
    }
  }, [huddleId, fetchProfilesBatch, fetchMessageReactions]);

  // Load older messages with optimization
  const loadOlderMessages = useCallback(async () => {
    if (!hasMore || loadingOlder || !oldestCreatedAt || !huddleId) return;
    
    setLoadingOlder(true);
    try {
      const { data: olderData, error } = await supabase
        .from("huddle_messages")
        .select(`
          id,
          content,
          created_at,
          user_id,
          media_url,
          media_type,
          embed_code,
          embeds,
          poll_data,
          is_team_agent_message,
          origin_team_id,
          origin_teams:teams!origin_team_id(name, logo_url)
        `)
        .eq("huddle_id", huddleId)
        .lt('created_at', oldestCreatedAt)
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);

      if (error) throw error;

      const batch = (olderData || []).slice().reverse();
      
      // Batch fetch profiles
      const userIds = [...new Set(batch.map(m => m.user_id).filter(Boolean))];
      const profiles = await fetchProfilesBatch(userIds);
      const profileMap = new Map(userIds.map((id, index) => [id, profiles[index]]));

      const batchWithProfiles = batch.map(message => ({
        ...message,
        embeds: message.embeds as any,
        profiles: profileMap.get(message.user_id) || null
      }));

      setMessages(prev => [...batchWithProfiles, ...prev]);
      setOldestCreatedAt(batchWithProfiles[0]?.created_at || oldestCreatedAt);
      setHasMore((olderData?.length || 0) === PAGE_SIZE);

    } catch (error) {
      console.error('Error loading older messages:', error);
    } finally {
      setLoadingOlder(false);
    }
  }, [hasMore, loadingOlder, oldestCreatedAt, huddleId, fetchProfilesBatch]);

  // Add new message (for real-time updates)
  const addMessage = useCallback((newMessage: Message) => {
    setMessages(prev => {
      const exists = prev.some(m => m.id === newMessage.id);
      return exists ? prev : [...prev, newMessage];
    });
  }, []);

  // Send message with optimistic updates
  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || !user?.id || !huddleId) return;

    // Optimistic update
    const optimisticMessage: Message = {
      id: `temp-${Date.now()}`,
      content: content.trim(),
      created_at: new Date().toISOString(),
      user_id: user.id,
      profiles: profileCacheRef.current.get(user.id) || {
        display_name: user.email?.split('@')[0] || 'User',
        username: null,
        avatar_url: null
      },
      reactions: {}
    };

    setMessages(prev => [...prev, optimisticMessage]);

    try {
      const { data: inserted, error } = await supabase
        .from("huddle_messages")
        .insert({
          huddle_id: huddleId,
          user_id: user.id,
          content: content.trim()
        })
        .select()
        .single();

      if (error) throw error;

      // Replace optimistic message with real one
      setMessages(prev => prev.map(msg => 
        msg.id === optimisticMessage.id 
          ? { ...inserted, embeds: inserted.embeds as any, profiles: optimisticMessage.profiles, reactions: {} }
          : msg
      ));

    } catch (error) {
      console.error("Error sending message:", error);
      // Remove optimistic message on error
      setMessages(prev => prev.filter(msg => msg.id !== optimisticMessage.id));
      throw error;
    }
  }, [user, huddleId]);

  // Initialize messages on mount
  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  return {
    messages,
    loading,
    hasMore,
    loadingOlder,
    loadOlderMessages,
    addMessage,
    sendMessage,
    fetchMessageReactions
  };
};