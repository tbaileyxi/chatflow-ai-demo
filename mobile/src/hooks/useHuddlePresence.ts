import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type PresenceUser = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
};

export function useHuddlePresence(huddleId: string) {
  const { user } = useAuth();
  const [presentUsers, setPresentUsers] = useState<PresenceUser[]>([]);
  const [entryBanner, setEntryBanner] = useState<string | null>(null);
  const bannerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trackedRef = useRef(false);

  const clearBanner = useCallback(() => {
    setEntryBanner(null);
  }, []);

  useEffect(() => {
    if (!huddleId || !user) return;

    const channel = supabase.channel(`presence-${huddleId}`, {
      config: { presence: { key: user.id } },
    });

    // Fetch current user's profile for presence metadata
    const setupPresence = async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, username, avatar_url")
        .eq("user_id", user.id)
        .maybeSingle();

      const displayName =
        profile?.display_name ?? profile?.username ?? "User";

      channel
        .on("presence", { event: "sync" }, () => {
          const state = channel.presenceState<{
            userId: string;
            displayName: string;
            avatarUrl: string | null;
          }>();

          const users: PresenceUser[] = [];
          const seen = new Set<string>();
          for (const key of Object.keys(state)) {
            for (const presence of state[key]) {
              if (!seen.has(presence.userId)) {
                seen.add(presence.userId);
                users.push({
                  userId: presence.userId,
                  displayName: presence.displayName,
                  avatarUrl: presence.avatarUrl,
                });
              }
            }
          }
          setPresentUsers(users);
        })
        .on("presence", { event: "join" }, ({ newPresences }) => {
          for (const p of newPresences) {
            const joined = p as any;
            // Don't show banner for self
            if (joined.userId !== user.id && trackedRef.current) {
              if (bannerTimeoutRef.current) {
                clearTimeout(bannerTimeoutRef.current);
              }
              setEntryBanner(`${joined.displayName} is in the Huddle`);
              bannerTimeoutRef.current = setTimeout(clearBanner, 3000);
            }
          }
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            await channel.track({
              userId: user.id,
              displayName,
              avatarUrl: profile?.avatar_url ?? null,
            });
            // Delay setting trackedRef so we don't show banners for initial presence state
            setTimeout(() => {
              trackedRef.current = true;
            }, 1000);
          }
        });
    };

    setupPresence();

    return () => {
      trackedRef.current = false;
      if (bannerTimeoutRef.current) clearTimeout(bannerTimeoutRef.current);
      supabase.removeChannel(channel);
    };
  }, [huddleId, user?.id, clearBanner]);

  return { presentUsers, entryBanner, clearBanner };
}
