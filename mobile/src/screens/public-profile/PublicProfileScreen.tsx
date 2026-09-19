import { useEffect, useState } from "react";
import { BadgeCheck } from "lucide-react-native";
import { useCreatorBadge } from "@/hooks/useCreatorBadge";
import { Alert, View, Text, Image, Pressable, ScrollView } from "react-native";
import { useRoute, useNavigation, type RouteProp } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Flag, MessageCircle, Users } from "lucide-react-native";
import { Type } from "@/components/ui/Type";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ScreenWrapper } from "@/components/ui/screen-wrapper";
import { blockUser, isBlocked, reportUser, unblockUser } from "@/lib/moderation";
import { openDm } from "@/lib/dm";
import { colors } from "@/theme/colors";
import type { RootStackParamList } from "@/navigation/types";

/**
 * Somebody else's profile.
 *
 * Until this existed the app had no way to answer "who is that?". A name in a
 * roster or above a message was the end of the road — you could see that a
 * person called "User" was in your list and had no way to find out anything
 * about them, including whether you actually knew them.
 *
 * Everything here is already public to anyone in a shared room. The one piece
 * of judgement is which rooms to list: only the ones YOU are also in. Listing
 * every room a person belongs to would turn a profile into a tracker.
 */

type Route = RouteProp<RootStackParamList, "PublicProfile">;

export default function PublicProfileScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const userId = route.params?.userId;
  // Passed by the caller when it has one — the roster knows what YOU have this
  // person saved as, which beats a display name of "User" every time.
  const knownAs = route.params?.knownAs ?? null;

  // Whether YOU have blocked THEM. Read once on open rather than joined into
  // the profile query: blocking is rare, and a person who is blocked should
  // still load normally with the button flipped, not fail to load.
  const [blocked, setBlocked] = useState(false);
  const isSelf = !!user && user.id === userId;
  const { data: creatorHandle } = useCreatorBadge(userId ?? null);

  useEffect(() => {
    if (!userId || isSelf) return;
    let alive = true;
    isBlocked(userId).then((b) => {
      if (alive) setBlocked(b);
    });
    return () => {
      alive = false;
    };
  }, [userId, isSelf]);

  const { data, isLoading } = useQuery({
    queryKey: ["public-profile", userId, user?.id],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data: p } = await supabase
        .from("profiles")
        .select("user_id, display_name, bio, avatar_url, created_at")
        .eq("user_id", userId)
        .maybeSingle();

      // Rooms in common. Two reads rather than a join: RLS decides what each
      // side can see, and a join would silently return nothing when either
      // half is filtered rather than showing the half that is allowed.
      const [{ data: theirs }, { data: mine }] = await Promise.all([
        supabase.from("huddle_members").select("huddle_id").eq("user_id", userId),
        supabase.from("huddle_members").select("huddle_id").eq("user_id", user?.id ?? ""),
      ]);
      const mineSet = new Set((mine ?? []).map((r: any) => r.huddle_id));
      const shared = (theirs ?? [])
        .map((r: any) => r.huddle_id)
        .filter((id: string) => mineSet.has(id));

      let rooms: Array<{ id: string; name: string }> = [];
      if (shared.length) {
        const { data: hs } = await supabase
          .from("huddles")
          .select("id, name")
          .in("id", shared.slice(0, 20));
        rooms = (hs ?? []).map((h: any) => ({ id: h.id, name: h.name }));
      }

      return { profile: p, rooms };
    },
  });

  const handleBlockToggle = (label: string) => {
    if (!userId) return;

    if (blocked) {
      Alert.alert("Unblock " + label + "?", "You'll see their messages again.", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unblock",
          onPress: async () => {
            if (await unblockUser(userId)) setBlocked(false);
          },
        },
      ]);
      return;
    }

    Alert.alert(
      "Block " + label + "?",
      "You won't see them anywhere in Side Huddle, in any room. They aren't told.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Block",
          style: "destructive",
          onPress: async () => {
            if (await blockUser(userId)) {
              setBlocked(true);
              Alert.alert("Blocked", "You won't see " + label + " again.");
            }
          },
        },
      ],
    );
  };

  const handleReport = (label: string) => {
    if (!userId) return;
    Alert.alert(
      "Report " + label + "?",
      "We review every report within 24 hours.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Report",
          style: "destructive",
          onPress: async () => {
            await reportUser({ userId });
            Alert.alert("Reported", "Thanks — we'll take a look.");
          },
        },
      ],
    );
  };

  const p = data?.profile as any;
  // "User" is what the database calls somebody who never finished onboarding.
  // Showing it as a name is worse than showing nothing.
  const rawName = p?.display_name && p.display_name !== "User" ? p.display_name : null;
  const name = rawName ?? knownAs ?? "Someone";
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s: string) => s[0])
    .join("")
    .toUpperCase();

  const joined = p?.created_at
    ? new Date(p.created_at).toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <ScreenWrapper>
      <View className="flex-row items-center gap-2 px-4 py-3">
        <Pressable onPress={() => navigation.goBack()} className="p-1 active:opacity-70">
          <ChevronLeft color={colors.foreground} size={26} />
        </Pressable>
        <Type variant="title">Profile</Type>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <LoadingSpinner />
        </View>
      ) : !p ? (
        <View className="flex-1 items-center justify-center px-8">
          <Type center variant="body" tone="muted">
            This account is no longer available.
          </Type>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          <View className="items-center px-6 pt-4">
            {p.avatar_url ? (
              <Image
                source={{ uri: p.avatar_url }}
                className="h-24 w-24 rounded-full"
              />
            ) : (
              <View className="h-24 w-24 items-center justify-center rounded-full bg-card border border-border">
                <Type variant="title" tone="muted">
                  {initials || "?"}
                </Type>
              </View>
            )}

            <View className="mt-4 flex-row items-center gap-1.5">
              <Type variant="title">{name}</Type>
              {creatorHandle ? (
                <BadgeCheck color={colors.verified.primary} size={20} accessibilityLabel="Verified creator" />
              ) : null}
            </View>
            {creatorHandle ? (
              <Type variant="data" tone="primary" className="mt-1">
                Verified creator · @{creatorHandle}
              </Type>
            ) : null}

            {/* If their Side Huddle name is nothing useful but you have them in
                your phone, say so — that is the line that answers "who?". */}
            {knownAs && rawName && knownAs !== rawName ? (
              <Type variant="caption" tone="muted" className="mt-1">
                In your contacts as {knownAs}
              </Type>
            ) : null}

            {!rawName ? (
              <Type variant="caption" tone="muted" className="mt-1">
                Hasn't set up their profile yet
              </Type>
            ) : null}

            {p.bio ? (
              <Type center variant="body" className="mt-4">
                {p.bio}
              </Type>
            ) : null}

            {joined ? (
              <Type variant="caption" tone="muted" className="mt-3">Joined {joined}</Type>
            ) : null}

            {/* Block and report live HERE, not only behind a long-press on
                something they said. If they deleted the message, or the
                problem is the profile itself, the long-press route doesn't
                exist — and that's the route a reviewer is looking for. */}
            {/* MESSAGE FIRST. This screen offered two ways to get rid of
                somebody and no way to talk to them — you tap a name in a room
                because you want to say something to them, not because you
                want them gone. */}
            {!isSelf && !blocked ? (
              <Pressable
                onPress={() => void openDm(userId!, navigation)}
                className="mt-5 flex-row items-center justify-center gap-2 rounded-full py-3 active:opacity-80"
                style={{ backgroundColor: colors.primary }}
              >
                <MessageCircle color={colors.primaryForeground} size={18} />
                <Type variant="button" tone="onPrimary" style={{ fontSize: 17 }}>
                  Message {name.split(/\s+/)[0]}
                </Type>
              </Pressable>
            ) : null}

            {!isSelf ? (
              <View className="mt-3 flex-row items-center gap-2">
                <Pressable
                  onPress={() => handleBlockToggle(name)}
                  className={
                    blocked
                      ? "rounded-full border border-border px-4 py-2 active:opacity-70"
                      : "rounded-full border border-destructive px-4 py-2 active:opacity-70"
                  }
                >
                  <Text
                    className={
                      blocked
                        ? "text-xs font-black text-muted-foreground"
                        : "text-xs font-black text-destructive"
                    }
                  >
                    {blocked ? "Unblock" : "Block"}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => handleReport(name)}
                  className="flex-row items-center gap-1.5 rounded-full border border-border px-4 py-2 active:opacity-70"
                >
                  <Flag color={colors.mutedForeground} size={12} />
                  <Type variant="captionStrong" tone="muted">
                    Report
                  </Type>
                </Pressable>
              </View>
            ) : null}

            {blocked ? (
              <Type center variant="caption" tone="muted" className="mt-3 px-6">
                You've blocked {name}. Their messages are hidden from you
                everywhere.
              </Type>
            ) : null}
          </View>

          {data!.rooms.length > 0 ? (
            <View className="mt-8 px-4">
              <View className="mb-3 flex-row items-center gap-2">
                <Users color={colors.mutedForeground} size={14} />
                <Type variant="eyebrow" tone="muted">
                  Rooms you're both in
                </Type>
              </View>
              <View className="gap-2">
                {data!.rooms.map((r) => (
                  <Pressable
                    key={r.id}
                    onPress={() => navigation.navigate("Huddle", { huddleId: r.id })}
                    className="flex-row items-center justify-between rounded-2xl border border-border bg-card p-4 active:opacity-80"
                  >
                    <Type variant="heading" className="flex-1" numberOfLines={1}>
                      {r.name}
                    </Type>
                    <Type variant="captionStrong" tone="primary">Open →</Type>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
        </ScrollView>
      )}
    </ScreenWrapper>
  );
}
