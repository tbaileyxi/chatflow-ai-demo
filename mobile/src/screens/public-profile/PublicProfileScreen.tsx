import { View, Text, Image, Pressable, ScrollView } from "react-native";
import { useRoute, useNavigation, type RouteProp } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Users } from "lucide-react-native";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ScreenWrapper } from "@/components/ui/screen-wrapper";
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
        <Text className="text-lg font-black text-foreground">Profile</Text>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <LoadingSpinner />
        </View>
      ) : !p ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-center text-muted-foreground">
            This account is no longer available.
          </Text>
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
                <Text className="text-2xl font-black text-muted-foreground">
                  {initials || "?"}
                </Text>
              </View>
            )}

            <Text className="mt-4 text-2xl font-black text-foreground">{name}</Text>

            {/* If their Side Huddle name is nothing useful but you have them in
                your phone, say so — that is the line that answers "who?". */}
            {knownAs && rawName && knownAs !== rawName ? (
              <Text className="mt-1 text-sm text-muted-foreground">
                In your contacts as {knownAs}
              </Text>
            ) : null}

            {!rawName ? (
              <Text className="mt-1 text-sm text-muted-foreground">
                Hasn't set up their profile yet
              </Text>
            ) : null}

            {p.bio ? (
              <Text className="mt-4 text-center text-base leading-relaxed text-foreground">
                {p.bio}
              </Text>
            ) : null}

            {joined ? (
              <Text className="mt-3 text-xs text-muted-foreground">Joined {joined}</Text>
            ) : null}
          </View>

          {data!.rooms.length > 0 ? (
            <View className="mt-8 px-4">
              <View className="mb-3 flex-row items-center gap-2">
                <Users color={colors.mutedForeground} size={14} />
                <Text className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                  Rooms you're both in
                </Text>
              </View>
              <View className="gap-2">
                {data!.rooms.map((r) => (
                  <Pressable
                    key={r.id}
                    onPress={() => navigation.navigate("Huddle", { huddleId: r.id })}
                    className="flex-row items-center justify-between rounded-2xl border border-border bg-card p-4 active:opacity-80"
                  >
                    <Text className="flex-1 text-base font-black text-foreground" numberOfLines={1}>
                      {r.name}
                    </Text>
                    <Text className="text-xs font-black text-primary">Open →</Text>
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
