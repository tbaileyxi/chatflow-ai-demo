import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  Image,
  ScrollView,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ArrowRight } from "lucide-react-native";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { colors } from "@/theme/colors";

type OnboardingTeam = {
  id: string;
  name: string;
  city: string;
  logoUrl: string | null;
  league: string;
};

const LEAGUES = ["NFL", "NBA", "NHL", "NCAAF", "MLB"] as const;

function useOnboardingTeams() {
  return useQuery({
    queryKey: ["onboarding-teams"],
    queryFn: async (): Promise<OnboardingTeam[]> => {
      const { data, error } = await supabase
        .from("teams")
        .select("id, name, city, logo_url, league")
        .eq("status", "active")
        .in("league", [...LEAGUES])
        .order("name");

      if (error || !data) return [];
      return data.map((t) => ({
        id: t.id,
        name: t.name,
        city: t.city,
        logoUrl: t.logo_url,
        league: t.league ?? "",
      }));
    },
  });
}

export function OnboardingScreen() {
  const [selectedTeams, setSelectedTeams] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();
  const navigation = useNavigation();
  const queryClient = useQueryClient();

  const toggleTeam = (id: string) => {
    setSelectedTeams((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= 5) return prev;
        next.add(id);
      }
      return next;
    });
  };

  const finishOnboarding = async () => {
    if (!user || selectedTeams.size < 2) return;

    setSaving(true);
    try {
      // Save follows
      const follows = [...selectedTeams].map((teamId) => ({
        user_id: user.id,
        team_id: teamId,
      }));

      const { error } = await supabase.from("user_follows").upsert(follows, {
        onConflict: "user_id,team_id",
      });

      if (error) {
        Alert.alert("Error", "Failed to save team selections.");
        return;
      }

      queryClient.invalidateQueries({ queryKey: ["super-huddle-feed"] });
      await completeOnboarding();
    } finally {
      setSaving(false);
    }
  };

  const completeOnboarding = async () => {
    if (!user) return;

    await supabase
      .from("profiles")
      .update({ onboarding_completed: true })
      .eq("user_id", user.id);

    queryClient.invalidateQueries({ queryKey: ["profile"] });
    queryClient.invalidateQueries({ queryKey: ["user-huddles"] });
    navigation.reset({
      index: 0,
      routes: [{ name: "MainTabs" as any }],
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <TeamPickerStep
        selectedTeams={selectedTeams}
        onToggle={toggleTeam}
        onNext={finishOnboarding}
        saving={saving}
      />
    </SafeAreaView>
  );
}

function TeamPickerStep({
  selectedTeams,
  onToggle,
  onNext,
  saving,
}: {
  selectedTeams: Set<string>;
  onToggle: (id: string) => void;
  onNext: () => void;
  saving: boolean;
}) {
  const { data: teams, isLoading } = useOnboardingTeams();
  const [filterLeague, setFilterLeague] = useState<string | null>(null);

  const filtered = filterLeague
    ? teams?.filter((t) => t.league.toUpperCase() === filterLeague)
    : teams;

  return (
    <View className="flex-1">
      {/* Header */}
      <View className="items-center px-6 pt-6 pb-4">
        <View className="mb-3 h-14 w-14 items-center justify-center rounded-2xl bg-primary">
          <Text className="text-xl font-bold text-primary-foreground">SH</Text>
        </View>
        <Text className="text-2xl font-bold text-foreground">
          Build your Super Huddle
        </Text>
        <Text className="mt-2 text-center text-sm text-muted-foreground">
          Pick 2-5 teams to follow. Their posts will appear in your Super Huddle
          feed.
        </Text>
        <Text className="mt-1 text-xs text-muted-foreground">
          {selectedTeams.size}/5 selected
          {selectedTeams.size < 2 ? " (pick at least 2)" : ""}
        </Text>
      </View>

      {/* League filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
        className="mb-3"
        style={{ flexGrow: 0 }}
      >
        <Pressable
          className={cn(
            "rounded-full px-4 py-2",
            !filterLeague
              ? "bg-primary"
              : "border border-border bg-transparent",
          )}
          onPress={() => setFilterLeague(null)}
        >
          <Text
            className={cn(
              "text-sm font-medium",
              !filterLeague
                ? "text-primary-foreground"
                : "text-muted-foreground",
            )}
          >
            All
          </Text>
        </Pressable>
        {LEAGUES.map((league) => (
          <Pressable
            key={league}
            className={cn(
              "rounded-full px-4 py-2",
              filterLeague === league
                ? "bg-primary"
                : "border border-border bg-transparent",
            )}
            onPress={() =>
              setFilterLeague(filterLeague === league ? null : league)
            }
          >
            <Text
              className={cn(
                "text-sm font-medium",
                filterLeague === league
                  ? "text-primary-foreground"
                  : "text-muted-foreground",
              )}
            >
              {league}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Team grid */}
      {isLoading ? (
        <View className="flex-row flex-wrap gap-3 px-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-20 rounded-xl" />
          ))}
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 10,
            paddingHorizontal: 16,
            paddingBottom: 100,
          }}
        >
          {filtered?.map((team) => {
            const selected = selectedTeams.has(team.id);
            return (
              <Pressable
                key={team.id}
                className={cn(
                  "w-[22%] items-center gap-1.5 rounded-xl border p-2 active:opacity-80",
                  selected
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card",
                )}
                onPress={() => onToggle(team.id)}
              >
                <View className="relative">
                  <View className="h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-muted">
                    {team.logoUrl ? (
                      <Image
                        source={{ uri: team.logoUrl }}
                        className="h-full w-full"
                        resizeMode="cover"
                      />
                    ) : (
                      <Text className="text-xs font-bold text-muted-foreground">
                        {team.name.slice(0, 2)}
                      </Text>
                    )}
                  </View>
                  {selected && (
                    <View className="absolute -right-1 -top-1 h-5 w-5 items-center justify-center rounded-full bg-primary">
                      <Check color={colors.primaryForeground} size={12} />
                    </View>
                  )}
                </View>
                <Text
                  className="text-center text-xs text-foreground"
                  numberOfLines={1}
                >
                  {team.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {/* Bottom CTA */}
      <View className="absolute bottom-0 left-0 right-0 border-t border-border bg-background px-6 pb-8 pt-4">
        <Button
          size="lg"
          onPress={onNext}
          disabled={selectedTeams.size < 2 || saving}
        >
          <View className="flex-row items-center gap-2">
            <Text className="text-sm font-semibold text-primary-foreground">
              {saving ? "Saving..." : "Continue"}
            </Text>
            {!saving && <ArrowRight color={colors.primaryForeground} size={18} />}
          </View>
        </Button>
      </View>
    </View>
  );
}
