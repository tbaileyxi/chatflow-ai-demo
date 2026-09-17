import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  Alert,
  Image,
  ScrollView,
  Share,
  Switch,
  Keyboard,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from "@react-navigation/native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  ChevronLeft,
  Globe,
  Lock,
  Radio,
  Search,
} from "lucide-react-native";
import { Type } from "@/components/ui/Type";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { followTeam } from "@/lib/follows";
import { backfillTeamContent } from "@/lib/roomContent";
import { postAdminWelcome } from "@/lib/teamHuddle";
import {
  DEV_ROOMS_STORAGE_KEY,
  DEV_TEAMS,
  normalizeLeague,
} from "@/config/devData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { colors } from "@/theme/colors";
import { type } from "@/theme/type";
import type { RootStackParamList } from "@/navigation/types";

type Route = RouteProp<RootStackParamList, "CreateSideHuddle">;

type Team = {
  id: string;
  name: string;
  city: string;
  logoUrl: string | null;
  league: string;
};

const LEAGUES = ["NFL", "NBA", "NHL", "NCAAF", "MLB"] as const;

function useTeamsList() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["teams-list", user?.app_metadata?.provider],
    queryFn: async (): Promise<Team[]> => {
      if (user?.app_metadata?.provider === "dev_test") {
        return DEV_TEAMS;
      }

      const { data, error } = await supabase
        .from("teams")
        .select("id, name, city, logo_url, league")
        .eq("status", "active")
        .order("name");
      if (error || !data || data.length === 0) return DEV_TEAMS;
      return data.map((t) => ({
        id: t.id,
        name: t.name,
        city: t.city,
        logoUrl: t.logo_url,
        league: normalizeLeague(t.league),
      }));
    },
  });
}

export function CreateSideHuddleScreen() {
  const navigation = useNavigation();
  const route = useRoute<Route>();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: teams } = useTeamsList();
  const [name, setName] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(
    route.params?.teamId ?? null,
  );
  const [filterLeague, setFilterLeague] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  // Off by default: an open room is the norm, and discovery is already scoped
  // to people you know. This is for someone who wants the door locked too.
  // Private by default. The line under the name field promised "only people
  // you invite can join" while this defaulted to false, so every room made
  // from this screen was public and the screen said otherwise. Home's own
  // subtitle is "Friend rooms only. No public room directory." — that is the
  // product's position, and the default now matches it.
  /**
   * Private is OFF by default.
   *
   * Every huddle started as invite-only, which means every new huddle was a
   * room of one that nobody could reach — in an app whose entire premise is
   * the people you already know. Friends can walk in; strangers cannot find
   * it either way, because nothing lists it.
   */
  const [askToJoin, setAskToJoin] = useState(false);

  const filtered = teams?.filter((t) => {
    if (filterLeague && t.league.toUpperCase() !== filterLeague) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      if (
        !t.name.toLowerCase().includes(q) &&
        !t.city.toLowerCase().includes(q)
      )
        return false;
    }
    return true;
  });

  const handleCreate = async () => {
    if (!user || !name.trim() || !selectedTeamId) return;

    setCreating(true);
    try {
      if (user.app_metadata?.provider === "dev_test") {
        const selectedTeam = teams?.find((t) => t.id === selectedTeamId);
        const roomId = `dev-room-${Date.now()}`;
        const stored = await AsyncStorage.getItem(DEV_ROOMS_STORAGE_KEY);
        const existingRooms = stored ? JSON.parse(stored) : [];
        await AsyncStorage.setItem(
          DEV_ROOMS_STORAGE_KEY,
          JSON.stringify([
            {
              id: roomId,
              name: name.trim(),
              teamId: selectedTeamId,
              teamName: selectedTeam?.name ?? null,
              teamCity: selectedTeam?.city ?? null,
              teamLogoUrl: selectedTeam?.logoUrl ?? null,
              relationship: "owner",
              accessMode: "link",
              memberCount: 1,
              createdAt: new Date().toISOString(),
            },
            ...existingRooms,
          ]),
        );

        queryClient.invalidateQueries({ queryKey: ["user-huddles"] });
        queryClient.invalidateQueries({ queryKey: ["game-night-communities"] });
        navigation.navigate("MainTabs" as any);
        return;
      }

      // You cannot own a room for a team you don't follow. Enforced by making
      // it true rather than by refusing: picking a team here IS an expression
      // of interest, so blocking with "follow this team first" would be asking
      // the user to say the same thing twice.
      //
      // The invariant this buys: every huddle's team is followed by whoever
      // created it, so a room's team always means something.
      await followTeam(selectedTeamId);

      const { data, error } = await supabase
        .from("huddles")
        .insert({
          name: name.trim(),
          owner_id: user.id,
          team_id: selectedTeamId,
          // WAS: hardcoded false, which meant no room could ever be private —
          // so the request-to-join flow and its whole approve/deny admin UI
          // were unreachable dead code.
          is_private: askToJoin,
          is_official_team_huddle: false,
          is_verified: false,
          member_count: 1,
        })
        .select("id")
        .single();

      if (error) {
        Alert.alert("Error", "Failed to create crew room.");
        return;
      }

      // Add creator as member
      await supabase.from("huddle_members").insert({
        huddle_id: data.id,
        user_id: user.id,
      });

      // Backfill last 24h of bot content from the official team huddle, then
      // greet the admin. The welcome goes LAST so it lands at the bottom of the
      // thread — it's the first thing they should read, and the room is
      // anchored to its newest message.
      const systemUserId = await backfillTeamContent(data.id, selectedTeamId);
      const selectedTeam = teams?.find((t) => t.id === selectedTeamId);
      await postAdminWelcome(
        data.id,
        name.trim(),
        selectedTeam
          ? [selectedTeam.city, selectedTeam.name].filter(Boolean).join(" ").trim()
          : null,
        systemUserId,
      );

      queryClient.invalidateQueries({ queryKey: ["user-huddles"] });
      queryClient.invalidateQueries({ queryKey: ["game-night-communities"] });

      // Offer to share invite link via the real RPC-minted code.
      Alert.alert(
        "Room created 🎉",
        "Send your crew the invite link?",
        [
          {
            text: "Share Invite",
            onPress: async () => {
              try {
                const { data: inviteRow, error: inviteErr } = await (
                  supabase.rpc as any
                )("create_room_invite_code", { p_huddle_id: data.id });
                if (inviteErr) throw inviteErr;
                const row = Array.isArray(inviteRow)
                  ? inviteRow[0]
                  : inviteRow;
                const code: string | undefined = row?.invite_code;
                // https link so invitees without the app get a real page,
                // not dead custom-scheme text.
                const inviteLink = code
                  ? `https://www.sidehuddlesports.com/i/${code}`
                  : `https://www.sidehuddlesports.com/h/${data.id}`;
                // Same as PullInFriendsModal: the URL goes in `url`, never
                // also in `message`, or iOS sends it twice and Messages drops
                // the rich preview.
                await Share.share({
                  message: `Jump in: ${name.trim()} on Side Huddle.`,
                  url: inviteLink,
                });
              } catch (err) {
                const msg =
                  (err as any)?.message ??
                  (typeof err === "string" ? err : "Unknown error");
                Alert.alert("Couldn't generate invite link", msg);
              } finally {
                navigation.reset({
                  index: 1,
                  routes: [
                    { name: "MainTabs" as any },
                    { name: "Huddle" as any, params: { huddleId: data.id } },
                  ],
                });
              }
            },
          },
          {
            text: "Skip",
            style: "cancel",
            onPress: () => {
              navigation.reset({
                index: 1,
                routes: [
                  { name: "MainTabs" as any },
                  { name: "Huddle" as any, params: { huddleId: data.id } },
                ],
              });
            },
          },
        ],
      );
    } catch {
      Alert.alert("Error", "Something went wrong.");
    } finally {
      setCreating(false);
    }
  };

  const selectedTeam = teams?.find((t) => t.id === selectedTeamId);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <View className="flex-row items-center gap-3 px-4 py-3">
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <ChevronLeft color={colors.foreground} size={24} />
        </Pressable>
        <Type variant="heading" className="flex-1">
          Start a huddle
        </Type>
      </View>

      <View className="flex-1">
        <View className="px-4">
          {/* Step 1 — name. Big target, zero jargon. */}
          <Type variant="eyebrow" tone="primary">
            1 · Name your huddle
          </Type>
          <View className="mt-2">
            <Input
              placeholder={
                selectedTeam ? `${selectedTeam.name} crew` : "Game day crew"
              }
              value={name}
              onChangeText={setName}
              maxLength={50}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
              blurOnSubmit
              className="rounded-[14px] px-4"
              style={{
                color: colors.foreground,
                backgroundColor: colors.card,
                borderColor: name.trim() ? colors.primary : colors.border,
                fontFamily: type.bodyStrong.fontFamily,
                fontSize: 21,
                // A fixed h-14 with 22pt type clipped the descenders — "Browns
                // crew" lost the bottom of its own letters. Let the padding
                // set the height instead of fighting it.
                lineHeight: 27,
                paddingVertical: 14,
                letterSpacing: 0,
              }}
            />
          </View>
          {/* Follows the toggle at the bottom of the screen rather than
              stating one thing while the control says another. */}
          <View className="mt-1.5 flex-row items-center gap-1.5">
            {askToJoin ? (
              <Lock color={colors.mutedForeground} size={12} />
            ) : (
              <Globe color={colors.mutedForeground} size={12} />
            )}
            <Type variant="caption" tone="muted">
              {askToJoin
                ? "Locked — invitation and request to join only."
                : "Your friends can walk straight in."}
            </Type>
          </View>

          {/* Step 2 — team. One line, then visual picker. */}
          <View className="mt-6 flex-row items-center gap-2">
            <Type variant="eyebrow" tone="primary">
              2 · Pick your team
            </Type>
            {/* It read as a gold badge with a team name in it and no word
                saying what it was — especially arriving pre-filled from a tap
                on a live game, where nobody chose it on this screen. */}
            {selectedTeam ? (
              <View className="flex-row items-center gap-1.5 rounded-full bg-primary/15 px-2.5 py-1">
                <Check color={colors.primary} size={12} />
                <Type variant="data" tone="primary" style={{ fontSize: 12 }}>
                  {selectedTeam.name} picked
                </Type>
              </View>
            ) : null}
          </View>

          {/* Team search — explicit height so the input isn't clipped. */}
          <View className="mt-2 h-12 flex-row items-center gap-2 rounded-lg border border-input bg-muted px-3">
            <Search color={colors.mutedForeground} size={16} />
            <Input
              placeholder="Search teams..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              className="h-full flex-1 border-0 bg-transparent px-0"
              style={{ height: "100%" }}
            />
          </View>
        </View>

        {/* League filter */}
        <View style={{ paddingVertical: 8 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
          >
            <Pressable
              className={cn(
                "rounded-full px-4 py-2",
                !filterLeague
                  ? "bg-primary"
                  : "border border-border bg-transparent",
              )}
              onPress={() => {
                Keyboard.dismiss();
                setFilterLeague(null);
              }}
            >
              <Type variant="data" tone={!filterLeague ? "onPrimary" : "muted"}>
                All
              </Type>
            </Pressable>
            {LEAGUES.map((l) => (
              <Pressable
                key={l}
                className={cn(
                  "rounded-full px-4 py-2",
                  filterLeague === l
                    ? "bg-primary"
                    : "border border-border bg-transparent",
                )}
                onPress={() => {
                  Keyboard.dismiss();
                  setFilterLeague(filterLeague === l ? null : l);
                }}
              >
                <Type variant="data" tone={filterLeague === l ? "onPrimary" : "muted"}>
                  {l}
                </Type>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Team grid */}
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 8,
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: 120,
          }}
        >
          {filtered?.map((team) => {
            const selected = team.id === selectedTeamId;
            return (
              <Pressable
                key={team.id}
                className={cn(
                  "w-[30%] items-center gap-1.5 rounded-xl border p-3 active:opacity-80",
                  selected
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card",
                )}
                onPress={() => {
                  // The name field autofocuses, so the keyboard is up when you
                  // reach the grid. Without this it stayed up over the teams
                  // and the first tap was spent dismissing it.
                  Keyboard.dismiss();
                  setSelectedTeamId(selected ? null : team.id);
                }}
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
                      <Type variant="captionStrong" tone="muted">
                        {team.name.slice(0, 2)}
                      </Type>
                    )}
                  </View>
                  {selected && (
                    <View className="absolute -right-1 -top-1 h-4 w-4 items-center justify-center rounded-full bg-primary">
                      <Check color={colors.primaryForeground} size={10} />
                    </View>
                  )}
                </View>
                <Type center variant="caption" numberOfLines={1}>
                  {team.name}
                </Type>
                {/* Nicknames are not unique. Baylor and Chicago both render as
                    "Bears", and so do the Wildcats, Tigers and Eagles of a
                    dozen schools — two identical tiles side by side, told apart
                    only by a logo at 40px. The city disambiguates, and the
                    league catches the rest. */}
                <Type center variant="data" tone="tertiary" numberOfLines={1}>
                  {team.city || team.league || ""}
                </Type>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Bottom CTA */}
      <View className="absolute bottom-0 left-0 right-0 border-t border-border bg-background px-4 pb-8 pt-4">
        <View className="mb-3 flex-row items-center justify-between">
          <View className="flex-1 pr-3">
            {/* The heading is the room's tier, not the name of the switch. A
                label that says "Private" while the room is the friends-tier
                one describes the control instead of the thing being made. */}
            <Type variant="captionStrong">
              {askToJoin ? "Locked" : "Friends"}
            </Type>
            <Type variant="caption" tone="muted">
              {askToJoin
                ? "Invitation and request to join only."
                : "Your friends can walk straight in."}
            </Type>
          </View>
          <Switch
            value={askToJoin}
            onValueChange={setAskToJoin}
            trackColor={{ true: colors.success, false: colors.muted }}
          />
        </View>

        <Button
          size="lg"
          onPress={handleCreate}
          disabled={creating || !name.trim() || !selectedTeamId}
        >
          {creating
            ? "Creating..."
            : !name.trim()
              ? "Name your huddle to continue"
              : !selectedTeamId
                ? "Pick a team to continue"
                : "Create room"}
        </Button>
      </View>
    </SafeAreaView>
  );
}
