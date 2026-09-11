import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useQueryClient } from "@tanstack/react-query";
import { Lock, Plus, ShieldCheck } from "lucide-react-native";
import { Type } from "@/components/ui/Type";
import { TeamPicker } from "@/components/profile/TeamPicker";
import {
  useFollowedTeams,
  useTeamHuddles,
  type FollowedTeam,
  type TeamHuddle,
} from "@/hooks/useFollowedTeams";
import { useRoomGames, type RoomGame } from "@/hooks/useRoomGames";
import { colors } from "@/theme/colors";
import { cn } from "@/lib/utils";

/**
 * Teams — the answer to "I follow five teams, so where are they?"
 *
 * Following has been written to `user_follows` since onboarding was rewritten,
 * and until now nothing read it back. You picked teams on day one and then had
 * no way to see them, add one, or drop one. Worse, huddle creation is gated on
 * following, so a person who skipped a team at signup was permanently unable to
 * make a room for it.
 *
 * THE SHAPE IS TEAM → ROOMS, not a flat list. A flat list of rooms is Home,
 * and repeating it here would make the tab pointless. What this screen knows
 * that Home doesn't is which rooms exist for your teams that you are NOT in —
 * the only place in the app where that is visible.
 *
 * Empty rooms are fine here, and that's the difference from Home. Home is
 * "where your people are" and an empty row there is a dead end; this is a
 * directory, where an empty room is an invitation to be the first one in.
 */
export function TeamsScreen() {
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);

  const { data: teams, isLoading, refetch, isRefetching } = useFollowedTeams();
  const teamIds = useMemo(() => (teams ?? []).map((t) => t.id), [teams]);
  const { data: byTeam } = useTeamHuddles(teamIds);
  const { data: games } = useRoomGames(teamIds);

  const finishEditing = () => {
    setEditing(false);
    // Both the list and the rooms under it are now stale.
    queryClient.invalidateQueries({ queryKey: ["followed-teams-full"] });
    queryClient.invalidateQueries({ queryKey: ["followed-teams"] });
    queryClient.invalidateQueries({ queryKey: ["huddles-for-teams"] });
  };

  if (editing) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          <TeamPicker
            title="Your teams"
            subtitle="Add or drop as many as you like. This decides which games find you, and which rooms you can start."
            ctaLabel="Done"
            onDone={finishEditing}
            onSkip={finishEditing}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <View className="flex-row items-center justify-between px-4 pb-3 pt-2">
        <Type variant="title">Teams</Type>
        <Pressable
          onPress={() => setEditing(true)}
          className="rounded-full border border-border px-3 py-1.5 active:opacity-70"
        >
          <Type variant="captionStrong" tone="primary">Edit</Type>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
      >
        {isLoading ? (
          <View className="py-16">
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (teams ?? []).length === 0 ? (
          <EmptyFollows onPick={() => setEditing(true)} />
        ) : (
          (teams ?? []).map((team) => (
            <TeamBlock
              key={team.id}
              team={team}
              game={games?.get(team.id)}
              huddles={byTeam?.get(team.id) ?? []}
              onOpen={(id) => navigation.navigate("Huddle", { huddleId: id })}
              onJoin={(id) => navigation.navigate("JoinHuddle", { huddleId: id })}
              onCreate={() =>
                navigation.navigate("CreateSideHuddle", { teamId: team.id })
              }
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function TeamBlock({
  team,
  game,
  huddles,
  onOpen,
  onJoin,
  onCreate,
}: {
  team: FollowedTeam;
  game?: RoomGame;
  huddles: TeamHuddle[];
  onOpen: (id: string) => void;
  onJoin: (id: string) => void;
  onCreate: () => void;
}) {
  const live = game?.status === "live";

  return (
    <View className="mb-6">
      <View className="flex-row items-center gap-3 px-4 pb-2">
        <View className="h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-muted">
          {team.logoUrl ? (
            <Image
              source={{ uri: team.logoUrl }}
              className="h-full w-full"
              resizeMode="cover"
            />
          ) : (
            <Type variant="bodyStrong" tone="muted">
              {team.name.charAt(0)}
            </Type>
          )}
        </View>
        <View className="min-w-0 flex-1">
          <Type variant="heading"  numberOfLines={1}>
            {team.name}
          </Type>
          {/* The game line is the only thing here that changes hour to hour,
              so it sits with the team rather than being repeated on every
              room underneath it. */}
          {game ? (
            <Type
              variant={live ? "dataStrong" : "caption"}
              tone={live ? "primary" : "muted"}
              className="mt-0.5"
              numberOfLines={1}
            >
              {live
                ? `◆ ${game.us.name} ${game.us.score ?? 0} · ${game.them.name} ${game.them.score ?? 0}`
                : `${game.us.name} ${game.isHome ? "vs" : "at"} ${game.them.name}`}
            </Type>
          ) : team.league ? (
            <Type variant="caption" tone="muted" className="mt-0.5">
              {team.league}
            </Type>
          ) : null}
        </View>
        <Pressable
          onPress={onCreate}
          className="h-8 w-8 items-center justify-center rounded-full bg-primary/10 active:opacity-70"
        >
          <Plus color={colors.primary} size={16} />
        </Pressable>
      </View>

      {huddles.length === 0 ? (
        <Pressable
          onPress={onCreate}
          className="mx-4 rounded-xl border border-dashed border-border p-3 active:opacity-70"
        >
          <Type variant="captionStrong">
            No room for {team.name} yet
          </Type>
          <Type variant="caption" tone="muted" className="mt-0.5">
            Start one and invite whoever you watch with.
          </Type>
        </Pressable>
      ) : (
        <View className="gap-2 px-4">
          {huddles.map((h) => (
            <RoomRow
              key={h.id}
              huddle={h}
              onPress={() => (h.isMember ? onOpen(h.id) : onJoin(h.id))}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function RoomRow({
  huddle,
  onPress,
}: {
  huddle: TeamHuddle;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={cn(
        "flex-row items-center gap-3 rounded-xl border bg-card p-3 active:opacity-80",
        huddle.isMember ? "border-[#33404F]" : "border-border",
      )}
    >
      <View className="min-w-0 flex-1">
        <View className="flex-row items-center gap-1.5">
          <Type variant="captionStrong" className="shrink" numberOfLines={1}>
            {huddle.name}
          </Type>
          {huddle.isOfficial ? (
            <ShieldCheck color={colors.primary} size={11} />
          ) : null}
          {huddle.isPrivate ? (
            <Lock color={colors.mutedForeground} size={10} />
          ) : null}
        </View>

        {/* Who is in there beats how many are in there, every time — but a
            room with nobody you know still gets a count, because on this
            screen "12 people" is the difference between a room and a shell. */}
        <Type variant="data" tone="muted" className="mt-0.5" numberOfLines={1}>
          {huddle.knownNames.length > 0
            ? `${huddle.knownNames.slice(0, 2).join(", ")}${
                huddle.knownNames.length > 2
                  ? ` +${huddle.knownNames.length - 2}`
                  : ""
              } in here`
            : huddle.memberCount > 0
              ? `${huddle.memberCount} ${huddle.memberCount === 1 ? "person" : "people"}`
              : "Nobody in yet — go first"}
        </Type>
      </View>

      <Text
        className={cn(
          "text-[11px] font-black",
          huddle.isMember ? "text-muted-foreground" : "text-primary",
        )}
      >
        {huddle.isMember ? "Open" : "Join"}
      </Text>
    </Pressable>
  );
}

function EmptyFollows({ onPick }: { onPick: () => void }) {
  return (
    <View className="mx-4 mt-6 rounded-2xl border border-border bg-card p-5">
      <Type variant="heading">
        You don't follow any teams yet
      </Type>
      <Type variant="caption" tone="muted" className="mt-2">
        Following a team is what makes its games show up on Home, and it's what
        lets you start a room for it.
      </Type>
      <Pressable
        onPress={onPick}
        className="mt-4 items-center rounded-xl bg-primary py-3 active:opacity-80"
      >
        <Type variant="captionStrong" tone="onPrimary">
          Pick your teams
        </Type>
      </Pressable>
    </View>
  );
}

export default TeamsScreen;
