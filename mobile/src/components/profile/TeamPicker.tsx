// Pick your team → land in that team's open room.
//
// This is the "arrived without an invite" path. Before it existed, an uninvited
// signup finished onboarding with zero rooms: nothing on Home, nothing in
// search (which is friend-scoped), nobody to talk to. Joining the team room
// gives them somewhere real to land on their first run.
//
// join_team_huddle() creates the room if that team doesn't have one yet, so
// this works whether or not the team rooms exist in the data.

import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { colors } from "@/theme/colors";

type Team = {
  id: string;
  name: string;
  city: string | null;
  logoUrl: string | null;
  league: string | null;
};

export function TeamPicker({
  onJoined,
  onSkip,
}: {
  onJoined: (huddleId: string) => void;
  onSkip?: () => void;
}) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [joining, setJoining] = useState<string | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("teams")
        .select("id, name, city, logo_url, league")
        .eq("status", "active")
        .order("name");
      if (cancelled) return;
      setTeams(
        (data ?? []).map((t: any) => ({
          id: t.id,
          name: t.name,
          city: t.city ?? null,
          logoUrl: t.logo_url ?? null,
          league: t.league ?? null,
        })),
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return teams;
    return teams.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.city ?? "").toLowerCase().includes(q) ||
        (t.league ?? "").toLowerCase().includes(q),
    );
  }, [teams, search]);

  const join = async (teamId: string) => {
    setJoining(teamId);
    try {
      const { data, error } = await (supabase.rpc as any)("join_team_huddle", {
        p_team_id: teamId,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      await queryClient.invalidateQueries({ queryKey: ["user-huddles"] });
      onJoined(row?.huddle_id ?? "");
    } catch (err) {
      console.warn("[team-picker] join failed", err);
      // Don't strand them in onboarding over this.
      onSkip?.();
    } finally {
      setJoining(null);
    }
  };

  return (
    <View>
      <Text className="text-4xl font-black leading-tight text-foreground">
        Who do you follow?
      </Text>
      <Text className="mt-3 text-lg leading-7 text-muted-foreground">
        We'll drop you in that team's room so you have somewhere to land.
      </Text>

      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search teams"
        placeholderTextColor={colors.mutedForeground}
        autoCorrect={false}
        className="mt-5 rounded-xl border border-border bg-muted px-4 py-3 text-foreground"
        style={{ color: colors.foreground }}
      />

      {loading ? (
        <View className="items-center py-10">
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView style={{ maxHeight: 300 }} className="mt-3" keyboardShouldPersistTaps="handled">
          <View className="gap-1">
            {filtered.map((t) => (
              <Pressable
                key={t.id}
                onPress={() => join(t.id)}
                disabled={!!joining}
                className="flex-row items-center gap-3 rounded-xl px-2 py-2.5 active:bg-muted/40"
              >
                <View className="h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-muted">
                  {t.logoUrl ? (
                    <Image
                      source={{ uri: t.logoUrl }}
                      className="h-full w-full"
                      resizeMode="cover"
                    />
                  ) : (
                    <Text className="text-sm font-bold text-muted-foreground">
                      {t.name.charAt(0)}
                    </Text>
                  )}
                </View>
                <View className="flex-1">
                  <Text className="text-base font-bold text-foreground" numberOfLines={1}>
                    {t.city ? `${t.city} ${t.name}` : t.name}
                  </Text>
                  {t.league ? (
                    <Text className="text-xs text-muted-foreground">{t.league}</Text>
                  ) : null}
                </View>
                {joining === t.id ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : null}
              </Pressable>
            ))}

            {filtered.length === 0 ? (
              <Text className="py-8 text-center text-sm text-muted-foreground">
                No teams match that.
              </Text>
            ) : null}
          </View>
        </ScrollView>
      )}

      {onSkip ? (
        <Pressable onPress={onSkip} className="mt-4 py-2 active:opacity-70">
          <Text className="text-center text-sm font-black text-muted-foreground">
            Skip for now
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
