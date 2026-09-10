import { useMemo } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { Crown, Lock } from "lucide-react-native";
import { supabase } from "@/integrations/supabase/client";
import { useUserHuddles } from "@/hooks/useUserHuddles";
import { colors } from "@/theme/colors";

/**
 * The rooms you're responsible for, and whether anyone is waiting.
 *
 * huddle_join_requests has shipped and worked for months with nowhere to see
 * it: a request wrote a row, fired one push, and if that push was missed the
 * person waited forever. The approve/deny UI existed the whole time, buried
 * inside a settings screen you had to already know to open, on a room you had
 * to already remember was private.
 *
 * So the count comes to you. It sits on your profile — the one screen you open
 * for your own things — and every room you run links straight to the place
 * where you can act on it.
 */
export function RoomsYouRun() {
  const navigation = useNavigation<any>();
  const { data: huddles } = useUserHuddles();

  const owned = useMemo(
    () => (huddles ?? []).filter((h) => h.roomRole === "owner"),
    [huddles],
  );

  // One query for every room rather than one per room.
  const { data: pending } = useQuery({
    queryKey: ["pending-requests", owned.map((h) => h.id).sort().join(",")],
    enabled: owned.length > 0,
    staleTime: 60_000,
    queryFn: async (): Promise<Map<string, number>> => {
      const counts = new Map<string, number>();
      const { data } = await supabase
        .from("huddle_join_requests")
        .select("huddle_id")
        .eq("status", "pending")
        .in(
          "huddle_id",
          owned.map((h) => h.id),
        );
      for (const r of data ?? []) {
        counts.set(r.huddle_id, (counts.get(r.huddle_id) ?? 0) + 1);
      }
      return counts;
    },
  });

  if (owned.length === 0) return null;

  const totalPending = [...(pending?.values() ?? [])].reduce((a, b) => a + b, 0);

  return (
    <View className="gap-2">
      {totalPending > 0 ? (
        <View className="mb-1 rounded-xl bg-primary/10 px-3 py-2">
          <Text className="text-sm font-black text-primary">
            {totalPending} {totalPending === 1 ? "person is" : "people are"}{" "}
            waiting to join
          </Text>
          <Text className="mt-0.5 text-xs text-muted-foreground">
            They can't get in until you let them.
          </Text>
        </View>
      ) : null}

      {owned.map((room) => {
        const waiting = pending?.get(room.id) ?? 0;
        return (
          <Pressable
            key={room.id}
            onPress={() =>
              navigation.navigate("HuddleSettings", { huddleId: room.id })
            }
            className="flex-row items-center gap-3 rounded-xl border border-border bg-card p-2.5 active:opacity-80"
          >
            <View className="h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-muted">
              {room.teamLogoUrl ? (
                <Image
                  source={{ uri: room.teamLogoUrl }}
                  className="h-full w-full"
                  resizeMode="cover"
                />
              ) : (
                <Text className="text-sm font-bold text-muted-foreground">
                  {room.name.charAt(0)}
                </Text>
              )}
            </View>

            <View className="min-w-0 flex-1">
              <View className="flex-row items-center gap-1.5">
                <Text
                  className="shrink text-sm font-bold text-foreground"
                  numberOfLines={1}
                >
                  {room.name}
                </Text>
                <Crown color={colors.primary} size={11} />
                {room.isPrivate ? (
                  <Lock color={colors.mutedForeground} size={10} />
                ) : null}
              </View>
              <Text className="mt-0.5 text-[11px] text-muted-foreground">
                {room.memberCount}{" "}
                {room.memberCount === 1 ? "member" : "members"}
              </Text>
            </View>

            {waiting > 0 ? (
              <View className="rounded-full bg-destructive px-2 py-0.5">
                <Text className="text-[11px] font-black text-white">
                  {waiting}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
