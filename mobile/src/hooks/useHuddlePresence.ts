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
  const [typingUsers, setTypingUsers] = useState<PresenceUser[]>([]);
  const [entryBanner, setEntryBanner] = useState<string | null>(null);
  const bannerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const displayNameRef = useRef("User");
  const avatarUrlRef = useRef<string | null>(null);
  const trackedRef = useRef(false);

  const clearBanner = useCallback(() => {
    setEntryBanner(null);
  }, []);

  useEffect(() => {
    if (!huddleId || !user) return;

    // Cancellation flag: if the user jumps rooms before async work resolves,
    // late continuations must not touch the (already removed) channel.
    let cancelled = false;

    const channel = supabase.channel(`presence-${huddleId}`, {
      config: { presence: { key: user.id } },
    });
    channelRef.current = channel;

    channel
      .on("broadcast", { event: "typing" }, ({ payload }) => {
          const typing = payload as PresenceUser & { isTyping?: boolean };
          if (!typing.userId || typing.userId === user.id) return;

          if (typingTimeoutsRef.current[typing.userId]) {
            clearTimeout(typingTimeoutsRef.current[typing.userId]);
            delete typingTimeoutsRef.current[typing.userId];
          }

          if (!typing.isTyping) {
            setTypingUsers((current) =>
              current.filter((item) => item.userId !== typing.userId),
            );
            return;
          }

          setTypingUsers((current) => {
            const nextUser = {
              userId: typing.userId,
              displayName: typing.displayName,
              avatarUrl: typing.avatarUrl ?? null,
            };
            const exists = current.some((item) => item.userId === typing.userId);
            return exists
              ? current.map((item) =>
                  item.userId === typing.userId ? nextUser : item,
                )
              : [...current, nextUser];
          });

          typingTimeoutsRef.current[typing.userId] = setTimeout(() => {
            setTypingUsers((current) =>
              current.filter((item) => item.userId !== typing.userId),
            );
            delete typingTimeoutsRef.current[typing.userId];
          }, 3500);
        })
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
          if (status !== "SUBSCRIBED" || cancelled) return;

          // Fetch profile metadata AFTER subscribing — the channel lifecycle
          // never waits on this network call, so room-jumping can't strand
          // a half-initialized channel.
          const { data: profile } = await supabase
            .from("profiles")
            .select("display_name, username, avatar_url")
            .eq("user_id", user.id)
            .maybeSingle();
          if (cancelled) return;

          const displayName =
            profile?.display_name ??
            profile?.username ??
            (user.user_metadata?.display_name as string | undefined) ??
            "User";
          displayNameRef.current = displayName;
          avatarUrlRef.current = profile?.avatar_url ?? null;

          await channel.track({
            userId: user.id,
            displayName,
            avatarUrl: profile?.avatar_url ?? null,
          });

          // Notify other members that this user entered (throttled server-side)
          supabase.functions
            .invoke("send-push-notification", {
              body: {
                type: "presence_active",
                huddleId,
                userId: user.id,
                displayName,
              },
            })
            .catch(() => {});

          // Delay setting trackedRef so we don't show banners for initial presence state
          setTimeout(() => {
            if (!cancelled) trackedRef.current = true;
          }, 1000);
        });

    return () => {
      cancelled = true;
      trackedRef.current = false;
      if (bannerTimeoutRef.current) clearTimeout(bannerTimeoutRef.current);
      Object.values(typingTimeoutsRef.current).forEach(clearTimeout);
      typingTimeoutsRef.current = {};
      setTypingUsers([]);
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [huddleId, user?.id, clearBanner]);

  const sendTyping = useCallback(
    (isTyping: boolean) => {
      if (!user || !channelRef.current) return;
      channelRef.current
        .send({
          type: "broadcast",
          event: "typing",
          payload: {
            userId: user.id,
            displayName: displayNameRef.current,
            avatarUrl: avatarUrlRef.current,
            isTyping,
          },
        })
        .catch(() => {});
    },
    [user?.id],
  );

  return { presentUsers, typingUsers, entryBanner, clearBanner, sendTyping };
}
