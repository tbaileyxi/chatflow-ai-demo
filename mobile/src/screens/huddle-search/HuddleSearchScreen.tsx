import { useState } from "react";
import { View, Text, Image, FlatList, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { Search, Users, ShieldCheck } from "lucide-react-native";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { colors } from "@/theme/colors";
import { pluralize } from "@/lib/plural";

type SearchHuddle = {
  id: string;
  name: string;
  bio: string | null;
  memberCount: number;
  teamName: string | null;
  teamLogoUrl: string | null;
  isMember: boolean;
  isPrivate: boolean;
  isOfficial: boolean;
  knownNames: string[];
  knownCount: number;
};

// "Mike and Sara are in" reads like a reason to tap. "3 members" does not.
function knownLine(names: string[], count: number): string | null {
  if (count === 0) return null;
  if (count === 1) return `${names[0]} is in here`;
  if (count === 2) return `${names[0]} and ${names[1]} are in here`;
  const rest = count - 2;
  return `${names[0]}, ${names[1]} and ${rest} more you know`;
}

// WAS: a direct select over huddles that listed EVERY non-official room
// ordered by member count — 206 rooms of strangers, fully browsable by anyone.
// That is the opposite of how the product is meant to work: rooms are public
// by default, but you should only ever SEE one if somebody you know is inside.
//
// discoverable_huddles() applies that rule server-side (it needs the friend
// graph plus other people's memberships, neither of which RLS lets the client
// read). Official team rooms always come through, so someone with no
// connections yet still lands somewhere.
function useHuddleSearch(search: string) {
  return useQuery({
    queryKey: ["huddle-search", search],
    queryFn: async (): Promise<SearchHuddle[]> => {
      const { data, error } = await (supabase.rpc as any)(
        "discoverable_huddles",
        { p_search: search.trim() || null, p_limit: 40 },
      );

      if (error) {
        console.warn("[search] discoverable_huddles failed", error);
        return [];
      }

      return ((data ?? []) as any[]).map((h) => ({
        id: h.id,
        name: h.name,
        bio: h.bio ?? null,
        memberCount: h.member_count ?? 0,
        teamName: h.team_name ?? null,
        teamLogoUrl: h.team_logo_url ?? null,
        isMember: !!h.is_member,
        isPrivate: !!h.is_private,
        isOfficial: !!h.is_official,
        knownNames: (h.known_names ?? []) as string[],
        knownCount: h.known_count ?? 0,
      }));
    },
  });
}

export function HuddleSearchScreen() {
  const navigation = useNavigation();
  const [search, setSearch] = useState("");
  const { data: huddles, isLoading } = useHuddleSearch(search);

  // Tapping the row does what the row's own button says. It used to open
  // HuddleSettings — the admin editor — which is neither entering nor joining,
  // and is a strange place to land from a discovery screen. That went unnoticed
  // because search returned an empty list every time until the friend-scoped
  // rewrite, so no row was ever tappable.
  const openHuddle = (item: SearchHuddle) =>
    item.isMember
      ? navigation.navigate("Huddle", { huddleId: item.id })
      : navigation.navigate("JoinHuddle", { huddleId: item.id });

  const renderHuddle = ({ item }: { item: SearchHuddle }) => (
    <Pressable
      className="flex-row items-center gap-3 rounded-lg border border-border bg-card p-3 active:opacity-80"
      onPress={() => openHuddle(item)}
    >
      <View className="h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-muted">
        {item.teamLogoUrl ? (
          <Image
            source={{ uri: item.teamLogoUrl }}
            className="h-full w-full"
            resizeMode="cover"
          />
        ) : (
          <Text className="text-lg font-bold text-muted-foreground">
            {item.name.charAt(0)}
          </Text>
        )}
      </View>

      <View className="flex-1 gap-0.5">
        <View className="flex-row items-center gap-1.5">
          {item.isOfficial ? (
            <ShieldCheck color={colors.verified.primary} size={14} />
          ) : null}
          <Text
            className="flex-1 text-base font-semibold text-foreground"
            numberOfLines={1}
          >
            {item.name}
          </Text>
        </View>

        {/* The reason this room is on your screen at all. */}
        {knownLine(item.knownNames, item.knownCount) ? (
          <Text
            className="text-xs font-bold text-primary"
            numberOfLines={1}
          >
            {knownLine(item.knownNames, item.knownCount)}
          </Text>
        ) : null}

        {item.bio ? (
          <Text className="text-xs text-muted-foreground" numberOfLines={2}>
            {item.bio}
          </Text>
        ) : null}
        <View className="flex-row items-center gap-1">
          <Users color={colors.mutedForeground} size={12} />
          <Text className="text-xs text-muted-foreground">
            {pluralize(item.memberCount, "member")}
          </Text>
        </View>
      </View>

      <Button variant="outline" size="xs" onPress={() => openHuddle(item)}>
        {item.isMember ? "Enter" : item.isPrivate ? "Request" : "Join"}
      </Button>
    </Pressable>
  );

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <View className="px-4 pb-3 pt-2">
        <View className="flex-row items-center gap-2">
          <Search color={colors.primary} size={20} />
          <Text className="text-3xl font-black text-foreground">
            Search
          </Text>
        </View>
        <Text className="mt-1 text-sm text-muted-foreground">
          Rooms with people you know, and the team rooms.
        </Text>
      </View>

      <View className="px-4 pb-3">
        <Input
          placeholder="Search rooms and teams..."
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {isLoading ? (
        <View className="gap-3 px-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </View>
      ) : (
        <FlatList
          data={huddles}
          keyExtractor={(item) => item.id}
          renderItem={renderHuddle}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 12, paddingBottom: 32 }}
          ListEmptyComponent={
            // Deliberately not "no results". With friend-scoped discovery an
            // empty list usually means no connections yet, not a bad query —
            // so point at the fix instead of the failure.
            <View className="py-10 px-2">
              <Text className="text-center text-base font-black text-foreground">
                {search.trim() ? "Nothing matches that." : "Nothing here yet."}
              </Text>
              <Text className="mt-2 text-center text-sm leading-5 text-muted-foreground">
                {search.trim()
                  ? "You see rooms where you know somebody, plus the team rooms."
                  : "Rooms show up here once someone you know is in one. Find your people from your profile, or start a room and invite someone."}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
