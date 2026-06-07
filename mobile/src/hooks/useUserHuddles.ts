import { useQuery } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DEV_ROOMS_STORAGE_KEY } from "@/config/devData";

export type UserHuddle = {
  id: string;
  name: string;
  memberCount: number;
  ownerId: string | null;
  roomRole: "owner" | "joined";
  lastMessageAt: string | null;
  isVerified: boolean;
  isOfficialTeam: boolean;
  isPrivate: boolean;
  teamName: string | null;
  teamCity: string | null;
  teamLogoUrl: string | null;
  latestMessage: string | null;
  latestMessageIsBot: boolean;
  hasUnread: boolean;
};

export function useUserHuddles() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["user-huddles", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<UserHuddle[]> => {
      if (!user) return [];

      if (user.app_metadata?.provider === "dev_test") {
        const stored = await AsyncStorage.getItem(DEV_ROOMS_STORAGE_KEY);
        const rooms = stored ? JSON.parse(stored) : [];
        return rooms.map((room: any) => ({
          id: room.id,
          name: room.name,
          memberCount: room.memberCount ?? (room.relationship === "joined" ? 3 : 1),
          ownerId: room.relationship === "owner" ? user.id : null,
          roomRole: room.relationship === "joined" ? "joined" : "owner",
          lastMessageAt: room.createdAt ?? null,
          isVerified: false,
          isOfficialTeam: false,
          isPrivate: room.accessMode === "private",
          teamName: room.teamName ?? null,
          teamCity: room.teamCity ?? null,
          teamLogoUrl: room.teamLogoUrl ?? null,
          latestMessage:
            "Room created. Invite friends here; game-day chat and bot cards live in this space.",
          latestMessageIsBot: true,
          hasUnread: false,
        }));
      }

      // Get user's huddle memberships
      const { data: memberships, error: memError } = await supabase
        .from("huddle_members")
        .select(
          `
          huddle_id,
          last_read_at,
          huddles (
            id, name, member_count, last_message_at,
            owner_id, is_verified, is_official_team_huddle, is_private,
            teams!team_id (name, city, logo_url)
          )
        `,
        )
        .eq("user_id", user.id);

      if (memError || !memberships) return [];

      const huddleIds = memberships
        .map((m) => (m.huddles as any)?.id)
        .filter(Boolean) as string[];

      if (huddleIds.length === 0) return [];

      // Get latest message per huddle
      const { data: messages } = await supabase
        .from("huddle_messages")
        .select("huddle_id, content, created_at, is_bot_message")
        .in("huddle_id", huddleIds)
        .order("created_at", { ascending: false });

      const latestByHuddle = new Map<
        string,
        { content: string; isBot: boolean }
      >();
      if (messages) {
        for (const msg of messages) {
          if (!latestByHuddle.has(msg.huddle_id)) {
            latestByHuddle.set(msg.huddle_id, {
              content: msg.content,
              isBot: msg.is_bot_message ?? false,
            });
          }
        }
      }

      return memberships
        .filter((m) => m.huddles)
        .map((m) => {
          const h = m.huddles as any;
          const team = h.teams;
          const latest = latestByHuddle.get(h.id);
          const lastRead = m.last_read_at
            ? new Date(m.last_read_at)
            : new Date(0);
          const lastMsg = h.last_message_at
            ? new Date(h.last_message_at)
            : null;

          const roomRole: "owner" | "joined" =
            h.owner_id === user.id ? "owner" : "joined";

          return {
            id: h.id,
            name: h.name,
            memberCount: h.member_count ?? 0,
            ownerId: h.owner_id ?? null,
            roomRole,
            lastMessageAt: h.last_message_at,
            isVerified: h.is_verified ?? false,
            isOfficialTeam: h.is_official_team_huddle ?? false,
            isPrivate: h.is_private ?? false,
            teamName: team?.name ?? null,
            teamCity: team?.city ?? null,
            teamLogoUrl: team?.logo_url ?? null,
            latestMessage: latest?.content ?? null,
            latestMessageIsBot: latest?.isBot ?? false,
            hasUnread: lastMsg ? lastMsg > lastRead : false,
          };
        })
        .sort((a, b) => {
          // Sort by last message time, newest first
          const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
          const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
          return bTime - aTime;
        });
    },
  });
}
