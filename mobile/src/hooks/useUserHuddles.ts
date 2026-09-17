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
  /** Needed to resolve which game the room is about — see useRoomGames. */
  teamId: string | null;
  teamName: string | null;
  teamCity: string | null;
  teamLogoUrl: string | null;
  latestMessage: string | null;
  /**
   * Who said it. "Mike THAT'S A STOP" is the artifact's line; without the
   * name the liveliest thing on the card is a fragment with no author.
   */
  latestMessageSender: string | null;
  latestMessageIsBot: boolean;
  hasUnread: boolean;
  /** True for the public huddle attached to a fixture. */
  isGameRoom: boolean;
  /** A two-person thread. Lives on your profile, not in Your Huddles. */
  isDm: boolean;
  /** Set on a side huddle — the ones that close at 2am. Null on everything
   *  permanent, which is how a card knows to draw itself dashed. */
  expiresAt: string | null;
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
          teamId: room.teamId ?? null,
          teamName: room.teamName ?? null,
          teamCity: room.teamCity ?? null,
          teamLogoUrl: room.teamLogoUrl ?? null,
          latestMessage:
            "Room created. Invite friends here; game-day chat and bot cards live in this space.",
          latestMessageSender: null,
          latestMessageIsBot: true,
          hasUnread: false,
          expiresAt: null,
          isGameRoom: false,
          isDm: false,
        }));
      }

      /**
       * A ONE-COLUMN TYPO MUST NOT EMPTY THIS SCREEN.
       *
       * PostgREST fails the WHOLE select when any column in it is unknown, so
       * asking for `expires_at` against a database that has not run the side
       * huddle migration returns nothing — and Home shows "No huddles yet" to
       * somebody with nine of them. That exact shape has now bitten twice
       * this week: the profiles embed on the last-message line, and an RLS
       * policy before it.
       *
       * So the newer column is asked for once, and its absence costs the
       * dashed border rather than the entire list.
       */
      const CORE = `
          huddle_id,
          last_read_at,
          huddles (
            id, name, member_count, last_message_at,
            owner_id, is_verified, is_official_team_huddle, is_private, team_id,
            %EXTRA%
            teams!team_id (name, city, logo_url)
          )
        `;

      let { data: memberships, error: memError } = await (supabase as any)
        .from("huddle_members")
        .select(CORE.replace("%EXTRA%", "expires_at, is_game_room, is_dm,"))
        .eq("user_id", user.id);

      // ...but ONLY for that one case. This used to retry on any error at
      // all, and the retry drops expires_at, is_game_room and is_dm — so a
      // transient failure or an RLS change came back as a list where every
      // room looks permanent and none of them look like a game room. That is
      // how a spun-up room that died at 2am keeps sitting in Your Huddles
      // wearing a crown: the filters that would have removed it were reading
      // columns the fallback never asked for.
      const missingColumn =
        memError?.code === "42703" ||
        /column .* does not exist|could not find the .* column/i.test(
          memError?.message ?? "",
        );

      if (memError && missingColumn) {
        ({ data: memberships, error: memError } = await (supabase as any)
          .from("huddle_members")
          .select(CORE.replace("%EXTRA%", ""))
          .eq("user_id", user.id));
      } else if (memError) {
        console.warn("[huddles] membership select failed", memError);
      }

      if (memError || !memberships) return [];

      const huddleIds = (memberships as any[])
        .map((m) => (m.huddles as any)?.id)
        .filter(Boolean) as string[];

      if (huddleIds.length === 0) return [];

      // Latest message per huddle — one limit(1) query each, in parallel.
      // A single unbounded .in() query here used to download the entire
      // message history of every huddle and degraded home-screen load as
      // tables grew.
      const latestByHuddle = new Map<
        string,
        { content: string; isBot: boolean; userId: string | null; sender: string | null }
      >();
      await Promise.all(
        huddleIds.map(async (hid) => {
          const { data: msg } = await supabase
            .from("huddle_messages")
            .select("content, is_bot_message, user_id")
            .eq("huddle_id", hid)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (msg) {
            latestByHuddle.set(hid, {
              content: msg.content,
              isBot: msg.is_bot_message ?? false,
              // Resolved below. `profiles` is keyed on user_id rather than id,
              // so PostgREST has no relationship to embed and the join form
              // fails the whole select — which is how the last-message line
              // disappeared from every card at once.
              userId: msg.is_bot_message ? null : (msg as any).user_id ?? null,
              sender: null,
            });
          }
        }),
      );

      // One query for every speaker, not one per room.
      const senderIds = [
        ...new Set(
          [...latestByHuddle.values()].map((l) => l.userId).filter(Boolean) as string[],
        ),
      ];
      if (senderIds.length > 0) {
        const { data: senders } = await supabase
          .from("profiles")
          .select("user_id, display_name, username")
          .in("user_id", senderIds);
        const byId = new Map((senders ?? []).map((p: any) => [p.user_id, p]));
        for (const entry of latestByHuddle.values()) {
          if (!entry.userId) continue;
          const p = byId.get(entry.userId) as any;
          // First name only — the card has room for "Mike", not for
          // "Mike Donnelly THAT'S A STOP".
          const full = (p?.display_name || p?.username || null) as string | null;
          entry.sender = full ? full.split(/\s+/)[0] : null;
        }
      }

      return (memberships as any[])
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

          /**
           * NOBODY OWNS A GAME HUDDLE.
           *
           * get_or_create_game_room has to put something in owner_id — the
           * column is NOT NULL — so it uses whoever opened the fixture first,
           * and that person got a crown on a room nobody made. Ownership means
           * something here (it decides who can rename, set a photo, remove
           * people), and none of that applies to a public huddle that exists
           * because a game is on.
           */
          const roomRole: "owner" | "joined" =
            h.owner_id === user.id && h.is_game_room !== true ? "owner" : "joined";

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
            teamId: h.team_id ?? null,
            teamName: team?.name ?? null,
            teamCity: team?.city ?? null,
            teamLogoUrl: team?.logo_url ?? null,
            latestMessage: latest?.content ?? null,
            latestMessageSender: latest?.sender ?? null,
            latestMessageIsBot: latest?.isBot ?? false,
            hasUnread: lastMsg ? lastMsg > lastRead : false,
            expiresAt: (h as any).expires_at ?? null,
            isGameRoom: (h as any).is_game_room === true,
            isDm: (h as any).is_dm === true,
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
