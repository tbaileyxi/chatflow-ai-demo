import { useState } from "react";
import { View, Text, Image, FlatList, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Search, Users, ShieldCheck } from "lucide-react-native";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { colors } from "@/theme/colors";

type SearchHuddle = {
  id: string;
  name: string;
  bio: string | null;
  memberCount: number;
  teamName: string | null;
  teamLogoUrl: string | null;
  ownerName: string | null;
  isMember: boolean;
};

function useHuddleSearch(search: string, userId: string | undefined) {
  return useQuery({
    queryKey: ["huddle-search", search],
    queryFn: async (): Promise<SearchHuddle[]> => {
      let query = supabase
        .from("huddles")
        .select(
          `
          id, name, bio, member_count, owner_id,
          teams!team_id (name, logo_url)
        `,
        )
        .eq("is_private", false)
        .eq("is_verified", true)
        .order("member_count", { ascending: false })
        .limit(30);

      if (search.trim()) {
        query = query.ilike("name", `%${search}%`);
      }

      const { data, error } = await query;
      if (error || !data) return [];

      // Get owner profiles
      const ownerIds = [...new Set(data.map((h) => h.owner_id))];
      const { data: owners } = await supabase
        .from("profiles")
        .select("user_id, display_name, username")
        .in("user_id", ownerIds);
      const ownerMap = new Map(
        (owners ?? []).map((o) => [
          o.user_id,
          o.display_name ?? o.username ?? null,
        ]),
      );

      // Check membership
      let memberSet = new Set<string>();
      if (userId) {
        const huddleIds = data.map((h) => h.id);
        const { data: memberships } = await supabase
          .from("huddle_members")
          .select("huddle_id")
          .eq("user_id", userId)
          .in("huddle_id", huddleIds);
        memberSet = new Set((memberships ?? []).map((m) => m.huddle_id));
      }

      return data.map((h) => {
        const team = (h as any).teams;
        return {
          id: h.id,
          name: h.name,
          bio: h.bio,
          memberCount: h.member_count ?? 0,
          teamName: team?.name ?? null,
          teamLogoUrl: team?.logo_url ?? null,
          ownerName: ownerMap.get(h.owner_id) ?? null,
          isMember: memberSet.has(h.id),
        };
      });
    },
  });
}

export function HuddleSearchScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const { data: huddles, isLoading } = useHuddleSearch(search, user?.id);

  const renderHuddle = ({ item }: { item: SearchHuddle }) => (
    <Pressable
      className="flex-row items-center gap-3 rounded-lg border border-border bg-card p-3 active:opacity-80"
      onPress={() => navigation.navigate("Huddle", { huddleId: item.id })}
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
          <ShieldCheck color={colors.verified.primary} size={14} />
          <Text
            className="flex-1 text-base font-semibold text-foreground"
            numberOfLines={1}
          >
            {item.name}
          </Text>
        </View>
        {item.ownerName && (
          <Text className="text-xs text-muted-foreground">
            by {item.ownerName}
          </Text>
        )}
        <View className="flex-row items-center gap-1">
          <Users color={colors.mutedForeground} size={12} />
          <Text className="text-xs text-muted-foreground">
            {item.memberCount} members
          </Text>
        </View>
      </View>

      {item.isMember ? (
        <Badge variant="secondary">Joined</Badge>
      ) : (
        <Button variant="outline" size="xs">
          Join
        </Button>
      )}
    </Pressable>
  );

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <View className="flex-row items-center gap-3 px-4 py-3">
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <ChevronLeft color={colors.foreground} size={24} />
        </Pressable>
        <Text className="flex-1 text-lg font-bold text-foreground">
          Find Huddles
        </Text>
      </View>

      <View className="px-4 pb-3">
        <Input
          placeholder="Search huddles..."
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
            <Text className="py-8 text-center text-muted-foreground">
              No huddles found
            </Text>
          }
        />
      )}
    </SafeAreaView>
  );
}
