// GlobalPresenceContext — the cross-room "who's live right now" signal that
// powers Friends Now on the Home screen.
//
// Per-room presence (useHuddlePresence) only knows who's in a huddle while YOU
// are subscribed to that room's channel, so it can't answer "which of my
// friends is in any huddle right now." This provider fills that gap: every
// signed-in user joins one shared channel (`presence:lobby`) and continuously
// publishes their current location { huddleId, huddleName } (or null when not
// in a room). Any screen can then read every online user and their current
// huddle. Ephemeral by design — "live now" should mean genuinely live.

import React, {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type LobbyUser = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  huddleId: string | null;
  huddleName: string | null;
};

type GlobalPresenceValue = {
  presentUsers: LobbyUser[];
  setCurrentHuddle: (huddleId: string | null, huddleName?: string | null) => void;
};

const GlobalPresenceContext = createContext<GlobalPresenceValue>({
  presentUsers: [],
  setCurrentHuddle: () => {},
});

export function GlobalPresenceProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const [presentUsers, setPresentUsers] = useState<LobbyUser[]>([]);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const profileRef = useRef<{ displayName: string; avatarUrl: string | null }>({
    displayName: "User",
    avatarUrl: null,
  });
  // Current location is held in a ref so re-tracking doesn't depend on the
  // channel being torn down / rebuilt.
  const huddleRef = useRef<{ id: string | null; name: string | null }>({
    id: null,
    name: null,
  });

  const track = useCallback(() => {
    const channel = channelRef.current;
    if (!channel || !user) return;
    channel
      .track({
        userId: user.id,
        displayName: profileRef.current.displayName,
        avatarUrl: profileRef.current.avatarUrl,
        huddleId: huddleRef.current.id,
        huddleName: huddleRef.current.name,
      })
      .catch(() => {});
  }, [user?.id]);

  const setCurrentHuddle = useCallback(
    (huddleId: string | null, huddleName: string | null = null) => {
      huddleRef.current = { id: huddleId, name: huddleName };
      track();
    },
    [track],
  );

  useEffect(() => {
    if (!user) {
      setPresentUsers([]);
      return;
    }

    let cancelled = false;
    const channel = supabase.channel("presence:lobby", {
      config: { presence: { key: user.id } },
    });
    channelRef.current = channel;

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<LobbyUser>();
        const users: LobbyUser[] = [];
        const seen = new Set<string>();
        for (const key of Object.keys(state)) {
          const metas = state[key];
          // Last meta wins — it reflects the user's most recent location.
          const latest = metas[metas.length - 1];
          if (latest && !seen.has(latest.userId)) {
            seen.add(latest.userId);
            users.push({
              userId: latest.userId,
              displayName: latest.displayName,
              avatarUrl: latest.avatarUrl ?? null,
              huddleId: latest.huddleId ?? null,
              huddleName: latest.huddleName ?? null,
            });
          }
        }
        setPresentUsers(users);
      })
      .subscribe(async (status) => {
        if (status !== "SUBSCRIBED" || cancelled) return;

        const { data: profile } = await supabase
          .from("profiles")
          .select("display_name, username, avatar_url")
          .eq("user_id", user.id)
          .maybeSingle();
        if (cancelled) return;

        profileRef.current = {
          displayName:
            profile?.display_name ??
            profile?.username ??
            (user.user_metadata?.display_name as string | undefined) ??
            "User",
          avatarUrl: profile?.avatar_url ?? null,
        };
        track();
      });

    return () => {
      cancelled = true;
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [user?.id, track]);

  return (
    <GlobalPresenceContext.Provider value={{ presentUsers, setCurrentHuddle }}>
      {children}
    </GlobalPresenceContext.Provider>
  );
}

export function useGlobalPresence() {
  return useContext(GlobalPresenceContext);
}
