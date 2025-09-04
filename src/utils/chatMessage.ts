// Centralized chat message utilities for grouping and profile visibility
export type BasicMessage = {
  id: string;
  user_id: string;
  created_at: string;
  is_bot_message?: boolean;
  is_team_agent_message?: boolean;
  media_url?: string | null;
  embed_code?: string | null;
  poll_data?: any;
  content?: string | null;
  message_type?: string | null;
};

export type PickEmData = {
  type: 'pickem_card';
  instanceId: string;
  title: string;
  gameCount: number;
};

// Centralized Pick 'Em message parsing
export const parsePickEmMessage = (message: BasicMessage): PickEmData | null => {
  // First check message_type for explicit Pick 'Em messages
  if (message.message_type === 'pickem_card') {
    try {
      let pickemData: any = null;
      
      // Try embed_code first (newer format)
      if (message.embed_code) {
        pickemData = JSON.parse(message.embed_code);
      }
      // Fallback to content (legacy format)
      else if (message.content) {
        pickemData = JSON.parse(message.content);
      }
      
      if (pickemData?.type === 'pickem_card') {
        return {
          type: 'pickem_card',
          instanceId: pickemData.instanceId,
          title: pickemData.title,
          gameCount: pickemData.gameCount
        };
      }
    } catch (e) {
      console.warn('Failed to parse Pick Em message:', e);
    }
  }
  
  // Legacy detection: try parsing embed_code or content as Pick 'Em JSON
  const sources = [message.embed_code, message.content].filter(Boolean);
  for (const source of sources) {
    try {
      const data = JSON.parse(source);
      if (data?.type === 'pickem_card') {
        return {
          type: 'pickem_card',
          instanceId: data.instanceId,
          title: data.title,
          gameCount: data.gameCount
        };
      }
    } catch (e) {
      // Not JSON or not Pick 'Em, continue
    }
  }
  
  return null;
};

export const hasRichContent = (m?: Partial<BasicMessage> | null): boolean => {
  if (!m) return false;
  const hasMedia = typeof m.media_url === 'string' && m.media_url.trim() !== '';
  const hasEmbed = typeof m.embed_code === 'string' && m.embed_code.trim() !== '';
  const hasPoll = !!m.poll_data;
  const hasPickEm = !!parsePickEmMessage(m as BasicMessage);
  return hasMedia || hasEmbed || hasPoll || hasPickEm;
};

export const isConsecutiveMessage = (
  current?: Partial<BasicMessage> | null,
  previous?: Partial<BasicMessage> | null,
  windowMs: number = 5 * 60 * 1000
): boolean => {
  console.log('🔍 isConsecutiveMessage check:', {
    current: current ? { id: current.id, user_id: current.user_id, created_at: current.created_at, is_bot: current.is_bot_message, is_team_agent: current.is_team_agent_message } : null,
    previous: previous ? { id: previous.id, user_id: previous.user_id, created_at: previous.created_at, is_bot: previous.is_bot_message, is_team_agent: previous.is_team_agent_message } : null
  });
  
  if (!current || !previous) {
    console.log('❌ No current or previous message');
    return false;
  }
  if (current.user_id !== previous.user_id) {
    console.log('❌ Different users');
    return false;
  }
  if (current.is_bot_message || current.is_team_agent_message) {
    console.log('❌ Current is bot/team agent');
    return false;
  }
  if (previous.is_bot_message || previous.is_team_agent_message) {
    console.log('❌ Previous is bot/team agent');
    return false;
  }
  const curTime = new Date(current.created_at as any).getTime();
  const prevTime = new Date(previous.created_at as any).getTime();
  if (!Number.isFinite(curTime) || !Number.isFinite(prevTime)) {
    console.log('❌ Invalid timestamps');
    return false;
  }
  const timeDiff = curTime - prevTime;
  const isConsecutive = timeDiff < windowMs;
  console.log('⏰ Time check:', { timeDiff, windowMs, isConsecutive });
  return isConsecutive;
};

export const shouldShowProfile = (
  current?: Partial<BasicMessage> | null,
  previous?: Partial<BasicMessage> | null
): boolean => {
  const hasRich = hasRichContent(current);
  const isConsecutive = isConsecutiveMessage(current, previous);
  const shouldShow = !current || current.is_bot_message || current.is_team_agent_message || hasRich || !isConsecutive;
  
  console.log('👤 shouldShowProfile:', {
    messageId: current?.id,
    hasRichContent: hasRich,
    isConsecutive,
    shouldShow,
    reason: !current ? 'no current' : current.is_bot_message ? 'bot' : current.is_team_agent_message ? 'team agent' : hasRich ? 'rich content' : !isConsecutive ? 'not consecutive' : 'show profile'
  });
  
  return shouldShow;
};
