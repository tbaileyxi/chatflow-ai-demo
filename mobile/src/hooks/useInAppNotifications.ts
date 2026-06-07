import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";

type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];

export type InAppNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  huddleId: string | null;
  teamId: string | null;
  gameId: string | null;
  data: NotificationRow["data"];
  readAt: string | null;
  createdAt: string | null;
};

function mapNotification(row: NotificationRow): InAppNotification {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    huddleId: row.huddle_id,
    teamId: row.team_id,
    gameId: row.game_id,
    data: row.data,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

export function useInAppNotifications(limit = 12) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ["in-app-notifications", user?.id, limit];

  const query = useQuery({
    queryKey,
    enabled: !!user,
    queryFn: async (): Promise<InAppNotification[]> => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data ?? []).map(mapNotification);
    },
  });

  const markRead = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", notificationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .is("read_at", null);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const notifications = query.data ?? [];
  const unreadCount = notifications.filter((n) => !n.readAt).length;

  return {
    ...query,
    notifications,
    unreadCount,
    markRead: markRead.mutateAsync,
    markAllRead: markAllRead.mutateAsync,
  };
}
