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
  /** The room this came from is a one-to-one, so it reads as a message from a
      person rather than activity in a room. */
  isDm: boolean;
};

/**
 * Four pings from the same person in the same room are one event to the person
 * reading them, and four rows that have to be dismissed one at a time. A group
 * keeps the newest of a run and carries the rest along so the X clears them
 * all together.
 */
export type NotificationGroup = InAppNotification & {
  /** Every id in the group, newest first — what the X has to delete. */
  ids: string[];
  count: number;
  /** Unread if ANY of them is: dismissing should not quietly mark them read. */
  unread: boolean;
  senderId: string | null;
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
    isDm: false,
  };
}

function senderOf(n: InAppNotification): string | null {
  const d = n.data;
  if (!d || typeof d !== "object" || Array.isArray(d)) return null;
  const id = (d as { senderId?: unknown }).senderId;
  return typeof id === "string" ? id : null;
}

/**
 * Collapse a run of notifications that say the same thing: same kind, same
 * room, same person. Only a RUN — two pings either side of somebody else's
 * invite stay as they happened, because collapsing across the list would
 * reorder the story it tells.
 */
export function groupNotifications(
  list: InAppNotification[],
): NotificationGroup[] {
  const out: NotificationGroup[] = [];
  for (const n of list) {
    const sender = senderOf(n);
    const last = out[out.length - 1];
    const same =
      last &&
      last.type === n.type &&
      last.huddleId === n.huddleId &&
      last.senderId === sender;
    if (same) {
      last.ids.push(n.id);
      last.count += 1;
      last.unread = last.unread || !n.readAt;
      continue;
    }
    out.push({
      ...n,
      ids: [n.id],
      count: 1,
      unread: !n.readAt,
      senderId: sender,
    });
  }
  return out;
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
      const mapped = (data ?? []).map(mapNotification);

      // Which of these rooms are one-to-one. One query for the whole list, and
      // a failure costs the DM styling rather than the notifications.
      const huddleIds = Array.from(
        new Set(mapped.map((n) => n.huddleId).filter((id): id is string => !!id)),
      );
      if (huddleIds.length > 0) {
        const { data: rooms } = await (supabase as any)
          .from("huddles")
          .select("id, is_dm")
          .in("id", huddleIds);
        const dm = new Set(
          ((rooms ?? []) as { id: string; is_dm: boolean | null }[])
            .filter((r) => r.is_dm === true)
            .map((r) => r.id),
        );
        for (const n of mapped) {
          if (n.huddleId && dm.has(n.huddleId)) n.isDm = true;
        }
      }

      return mapped;
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

  /** Dismiss one. It is yours; nobody else can see it. */
  const remove = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("id", notificationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  /** The X on a collapsed row clears every ping it stands for. */
  const removeMany = useMutation({
    mutationFn: async (ids: string[]) => {
      if (ids.length === 0) return;
      const { error } = await supabase
        .from("notifications")
        .delete()
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const markManyRead = useMutation({
    mutationFn: async (ids: string[]) => {
      if (ids.length === 0) return;
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .in("id", ids);
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

  /** Clear the lot. Same reasoning as Mark all read — a list you cannot empty
      in one go is a list you stop opening. */
  const removeAll = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const notifications = query.data ?? [];
  const unreadCount = notifications.filter((n) => !n.readAt).length;
  const groups = groupNotifications(notifications);
  const dmGroups = groups.filter((g) => g.isDm);
  const roomGroups = groups.filter((g) => !g.isDm);

  return {
    ...query,
    notifications,
    groups,
    dmGroups,
    roomGroups,
    unreadCount,
    markRead: markRead.mutateAsync,
    markAllRead: markAllRead.mutateAsync,
    removeNotification: remove.mutateAsync,
    removeNotifications: removeMany.mutateAsync,
    markNotificationsRead: markManyRead.mutateAsync,
    removeAllNotifications: removeAll.mutateAsync,
  };
}
