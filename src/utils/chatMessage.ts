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
};

export const hasRichContent = (m?: Partial<BasicMessage> | null): boolean => {
  if (!m) return false;
  const hasMedia = typeof m.media_url === 'string' && m.media_url.trim() !== '';
  const hasEmbed = typeof m.embed_code === 'string' && m.embed_code.trim() !== '';
  const hasPoll = !!m.poll_data;
  return hasMedia || hasEmbed || hasPoll;
};

export const isConsecutiveMessage = (
  current?: Partial<BasicMessage> | null,
  previous?: Partial<BasicMessage> | null,
  windowMs: number = 5 * 60 * 1000
): boolean => {
  if (!current || !previous) return false;
  if (current.user_id !== previous.user_id) return false;
  if (current.is_bot_message || current.is_team_agent_message) return false;
  if (previous.is_bot_message || previous.is_team_agent_message) return false;
  const curTime = new Date(current.created_at as any).getTime();
  const prevTime = new Date(previous.created_at as any).getTime();
  if (!Number.isFinite(curTime) || !Number.isFinite(prevTime)) return false;
  return curTime - prevTime < windowMs;
};

export const shouldShowProfile = (
  current?: Partial<BasicMessage> | null,
  previous?: Partial<BasicMessage> | null
): boolean => {
  if (!current) return true;
  if (current.is_bot_message || current.is_team_agent_message) return true;
  if (hasRichContent(current)) return true;
  return !isConsecutiveMessage(current, previous);
};
