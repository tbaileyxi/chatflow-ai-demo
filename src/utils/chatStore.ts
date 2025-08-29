import { useCallback, useRef } from 'react';

interface ChatMessage {
  id: string;
  content: string;
  user_id: string;
  created_at: string;
  is_streaming?: boolean;
  [key: string]: any;
}

export class ChatStore {
  private messages: ChatMessage[] = [];
  private updateCallbacks: Set<(messages: ChatMessage[]) => void> = new Set();
  private pendingUpdates = new Map<string, string>();
  private updateFrameId: number | null = null;

  subscribe(callback: (messages: ChatMessage[]) => void) {
    this.updateCallbacks.add(callback);
    return () => this.updateCallbacks.delete(callback);
  }

  private notifySubscribers() {
    this.updateCallbacks.forEach(callback => callback([...this.messages]));
  }

  private scheduleUpdate() {
    if (this.updateFrameId) return;
    
    this.updateFrameId = requestAnimationFrame(() => {
      // Apply all pending updates
      this.pendingUpdates.forEach((content, messageId) => {
        const messageIndex = this.messages.findIndex(m => m.id === messageId);
        if (messageIndex !== -1) {
          this.messages[messageIndex] = {
            ...this.messages[messageIndex],
            content
          };
        }
      });
      
      this.pendingUpdates.clear();
      this.updateFrameId = null;
      this.notifySubscribers();
    });
  }

  addMessage(message: ChatMessage) {
    this.messages.push(message);
    this.notifySubscribers();
  }

  updateStreamingMessage(messageId: string, content: string) {
    // Batch streaming updates
    this.pendingUpdates.set(messageId, content);
    this.scheduleUpdate();
  }

  finishStreaming(messageId: string) {
    const messageIndex = this.messages.findIndex(m => m.id === messageId);
    if (messageIndex !== -1) {
      this.messages[messageIndex] = {
        ...this.messages[messageIndex],
        is_streaming: false
      };
      this.notifySubscribers();
    }
  }

  prependMessages(newMessages: ChatMessage[]) {
    this.messages = [...newMessages, ...this.messages];
    this.notifySubscribers();
  }

  getMessages() {
    return [...this.messages];
  }
}

export const useChatStore = () => {
  const storeRef = useRef<ChatStore>();
  
  if (!storeRef.current) {
    storeRef.current = new ChatStore();
  }

  return storeRef.current;
};

export const useThrottledUpdate = (callback: (...args: any[]) => void, delay: number = 100) => {
  const timeoutRef = useRef<NodeJS.Timeout>();
  const lastRunRef = useRef<number>(0);

  return useCallback((...args: any[]) => {
    const now = Date.now();
    const timeSinceLastRun = now - lastRunRef.current;

    if (timeSinceLastRun >= delay) {
      callback(...args);
      lastRunRef.current = now;
    } else {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        callback(...args);
        lastRunRef.current = Date.now();
      }, delay - timeSinceLastRun);
    }
  }, [callback, delay]);
};