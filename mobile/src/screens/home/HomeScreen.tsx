import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useQueryClient } from "@tanstack/react-query";
import {
  Lock,
  Plus,
  Radio,
  Users,
  UserPlus,
} from "lucide-react-native";
import { Image } from "react-native";
import { HuddleCard } from "@/components/home/HuddleCard";
import { CompleteProfileCard } from "@/components/home/CompleteProfileCard";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useInAppNotifications } from "@/hooks/useInAppNotifications";
import { useUserHuddles } from "@/hooks/useUserHuddles";
import { useRoomGames, type RoomGame } from "@/hooks/useRoomGames";
import { GamesStrip } from "@/components/home/GamesStrip";
import { useKnownPeople } from "@/hooks/useFriends";
import { useAutoContactMatch } from "@/hooks/useAutoContactMatch";
import { useContactMatch } from "@/hooks/useContactMatch";
import { useGlobalPresence } from "@/contexts/GlobalPresenceContext";
import { supabase } from "@/integrations/supabase/client";
import { Eyebrow, Type } from "@/components/ui/Type";
import { fonts } from "@/theme/type";
import { colors } from "@/theme/colors";

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return (parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : name.slice(0, 2)).toUpperCase();
}

function personColors(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) {
    h = (h * 31 + name.charCodeAt(i)) % 360;
  }
  return {
    bg: `hsl(${h}, 26%, 19%)`,
    fg: `hsl(${h}, 48%, 74%)`,
    line: `hsl(${h}, 24%, 30%)`,
  };
}

function MonogramAvatar({ name, size = 36 }: { name: string; size?: number }) {
  const palette = personColors(name);
  return (
    <View
      className="items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        backgroundColor: palette.bg,
        borderColor: palette.line,
        borderWidth: 1,
      }}
    >
      <Text style={{ color: palette.fg, fontSize: size * 0.34, fontFamily: fonts.display }}>
        {initials(name)}
      </Text>
    </View>
  );
}

function FriendsNowSection() {
  const navigation = useNavigation<any>();
  const { presentUsers } = useGlobalPresence();
  const { data: knownPeople } = useKnownPeople();
  const [expanded, setExpanded] = useState(false);

  const { data: myHuddles } = useUserHuddles();

  // Invite someone to a ROOM, not to the homepage.
  //
  // This used to share "Join me on Side Huddle … sidehuddlesports.com" — the
  // marketing page. Three things wrong with it, all of which the room invite in
  // PullInFriendsModal had already solved and this one never picked up: the
  // link went nowhere in particular, so a person who installed the app arrived
  // as a stranger with no room and no connection to whoever asked them; the URL
  // sat inside the message text, which stops iMessage building a preview card,
  // so it sent as a bare grey link; and it carried no invite code, so nothing
  // tied the two people together on the other end.
  const inviteFriends = useCallback(async () => {
    const all = myHuddles ?? [];
    // A room you own reads as an invitation from a person. The team's community
    // room reads as a mailing list. Prefer yours; fall back to whichever room
    // has been talking most recently.
    const owned = all.filter((h) => h.roomRole === "owner" && !h.isOfficialTeam);
    const pool = owned.length > 0 ? owned : all;
    const pick = [...pool].sort(
      (a, b) =>
        new Date(b.lastMessageAt ?? 0).getTime() -
        new Date(a.lastMessageAt ?? 0).getTime(),
    )[0];

    // No room means there is nothing to invite anyone TO. Sending the homepage
    // anyway is what the old version did, and it is why nobody ever joined from
    // it. Send the person to find a room instead of sending a link that cannot
    // work.
    if (!pick) {
      navigation.navigate("MainTabs", { screen: "Search" });
      return;
    }

    try {
      const { data, error } = await (supabase.rpc as any)(
        "create_room_invite_code",
        { p_huddle_id: pick.id },
      );
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      const code: string | undefined = row?.invite_code;
      if (!code) throw new Error("no invite code");

      // Message and URL passed SEPARATELY, and the link is not repeated in the
      // text — see the note in PullInFriendsModal. Both together is what breaks
      // the preview card.
      await Share.share({
        message: `Jump into ${pick.name} on Side Huddle.`,
        url: `https://www.sidehuddlesports.com/i/${code}`,
      });
    } catch (err) {
      console.warn("[invite] could not mint a code", err);
      Alert.alert(
        "Couldn't make an invite",
        "Try again in a moment, or invite from inside the room.",
      );
    }
  }, [myHuddles, navigation]);

  // The whole roster, live ones first. This used to render ONLY people who
  // were in a room at that exact second, so it was blank almost always — you
  // had to be looking at the moment a friend walked in or you missed it.
  // Now everyone you know is here; presence just decides how they look.
  const liveById = new Map(
    presentUsers.filter((u) => u.huddleId).map((u) => [u.userId, u]),
  );

  const roster = (knownPeople ?? [])
    .map((person) => {
      const live = liveById.get(person.userId);
      return {
        userId: person.userId,
        name: person.displayName || person.username || "Friend",
        avatarUrl: person.avatarUrl,
        huddleId: live?.huddleId ?? null,
        huddleName: live?.huddleName ?? null,
        isLive: !!live,
      };
    })
    .sort((a, b) => {
      if (a.isLive !== b.isLive) return a.isLive ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

  const anyLive = roster.some((p) => p.isLive);

  // People from your contacts who are here but not in your list yet. The sweep
  // runs itself once a day; this is only the result of it.
  const { newPeople, forget, granted, offer } = useAutoContactMatch();
  const { connect, run, state: matchState } = useContactMatch();

  // A permanent way in, the way WhatsApp and Telegram keep one, rather than a
  // single onboarding step you either take or lose forever. Most people skip at
  // signup because they want to see the app first — and on iOS that choice is
  // one-way: tapping "Not now" leaves permission undetermined and askable, but
  // an actual denial at the system dialog can never be re-asked in-app. So this
  // stays available for as long as it has not been granted, and disappears the
  // moment it has, because after that the daily sweep does it silently.
  const findFriends = useCallback(async () => {
    const found = await run();
    offer(found);
  }, [run, offer]);

  const scanning = matchState === "requesting" || matchState === "scanning";

  // A denial is the one state the button cannot fix on its own: iOS will not
  // show the dialog a second time, so run() returns immediately with nothing
  // and the tap looks broken. Say where the switch is instead.
  useEffect(() => {
    if (matchState !== "denied") return;
    Alert.alert(
      "Contacts are turned off",
      "Side Huddle needs contacts access to find people you already know. You can turn it on in Settings.",
      [
        { text: "Not now", style: "cancel" },
        { text: "Open Settings", onPress: () => void Linking.openSettings() },
      ],
    );
  }, [matchState]);

  // Cap the collapsed list. The roster is unbounded — at 5+ friends it pushed
  // Your Rooms off the screen entirely, which is the wrong trade: the roster is
  // reference, your rooms are the thing you came to open.
  //
  // The cap never hides someone who is LIVE. Those are the actionable rows and
  // the entire reason this section exists; a "show more" that buries a friend
  // currently watching would defeat it.
  const COLLAPSED_MAX = 4;
  const liveCount = roster.filter((p) => p.isLive).length;
  const collapsedCount = Math.max(COLLAPSED_MAX, liveCount);
  const visible = expanded ? roster : roster.slice(0, collapsedCount);
  const hiddenCount = roster.length - visible.length;

  return (
    <View className="px-4">
      <View className="mb-3 flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <View
            className={`h-2 w-2 rounded-full ${anyLive ? "bg-primary" : "bg-muted-foreground"}`}
          />
          <Eyebrow tone="default">Friends Now</Eyebrow>
        </View>
        <Pressable className="flex-row items-center gap-1" onPress={inviteFriends}>
          <UserPlus color={colors.primary} size={14} />
          <Type variant="captionStrong" tone="primary">Invite</Type>
        </Pressable>
      </View>

      {granted === false && newPeople.length === 0 ? (
        <Pressable
          onPress={findFriends}
          disabled={scanning}
          className="mb-4 flex-row items-center gap-3 rounded-2xl border border-primary/40 bg-primary/5 p-3 active:opacity-80"
        >
          <View className="h-9 w-9 items-center justify-center rounded-full bg-primary/15">
            <UserPlus color={colors.primary} size={18} />
          </View>
          <View className="flex-1">
            <Type variant="heading">
              {scanning ? "Looking..." : "Find friends you know"}
            </Type>
            <Type variant="caption" tone="muted">
              Checked on your phone. Nothing is stored.
            </Type>
          </View>
        </Pressable>
      ) : null}

      {newPeople.length > 0 ? (
        <View className="mb-4 gap-2">
          <Type variant="eyebrow" tone="primary">
            {newPeople.length === 1
              ? "Someone you know is here"
              : `${newPeople.length} people you know are here`}
          </Type>
          {newPeople.slice(0, 5).map((m) => {
            // Their Side Huddle name can be anything, or "User". What you have
            // them saved as in your own phone is the name that identifies them.
            const label = m.contactName ?? m.displayName ?? "Someone";
            return (
              <View
                key={m.userId}
                className="flex-row items-center gap-3 rounded-2xl border border-primary/40 bg-card p-3"
              >
                {m.avatarUrl ? (
                  <Image source={{ uri: m.avatarUrl }} className="h-9 w-9 rounded-full" />
                ) : (
                  <MonogramAvatar name={label} size={36} />
                )}
                <View className="flex-1">
                  <Type variant="heading"  numberOfLines={1}>
                    {label}
                  </Type>
                  <Type variant="caption" tone="muted"  numberOfLines={1}>
                    From your contacts
                  </Type>
                </View>
                <Pressable
                  onPress={async () => {
                    await connect(m.userId);
                    forget(m.userId);
                  }}
                  hitSlop={8}
                  className="rounded-full bg-primary px-4 py-1.5 active:opacity-80"
                >
                  <Type variant="captionStrong" tone="onPrimary">Add</Type>
                </Pressable>
              </View>
            );
          })}
        </View>
      ) : null}

      {roster.length > 0 ? (
        /**
         * A ROW, not a stack. Five friends as full-width cards pushed the
         * games and your own rooms below the fold — the roster is the least
         * urgent thing on Home and it was eating the most screen. Sideways it
         * costs one band whether you know five people or fifty.
         */
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 10 }}
        >
          {visible.map((f) => (
            <Pressable
              key={f.userId}
              // Every tile taps through. Offline tiles used to be disabled
              // outright, so a name you did not recognise — and "User" is what
              // the database calls anyone who never finished onboarding — was a
              // dead end with no way to find out who it was.
              onPress={() =>
                f.isLive && f.huddleId
                  ? navigation.navigate("Huddle", { huddleId: f.huddleId })
                  : navigation.navigate("PublicProfile", {
                      userId: f.userId,
                      knownAs: f.name,
                    })
              }
              className="w-[88px] items-center active:opacity-80"
              // Offline people stay on the list but read as background.
              style={f.isLive ? undefined : { opacity: 0.45 }}
            >
              <View
                className={
                  f.isLive
                    ? "rounded-full border-2 border-success p-0.5"
                    : "rounded-full border-2 border-transparent p-0.5"
                }
              >
                {f.avatarUrl ? (
                  <Image
                    source={{ uri: f.avatarUrl }}
                    className="h-14 w-14 rounded-full"
                  />
                ) : (
                  <MonogramAvatar name={f.name} size={56} />
                )}
              </View>
              <Type variant="captionStrong" className="mt-1.5 text-center"
                
                numberOfLines={1}>
                {f.name.split(/\s+/)[0]}
              </Type>
              <Text
                className={
                  f.isLive
                    ? "text-center text-[10px] font-bold text-success"
                    : "text-center text-[10px] text-muted-foreground"
                }
                numberOfLines={1}
              >
                {f.isLive ? "watching" : "not watching"}
              </Text>
            </Pressable>
          ))}

          {hiddenCount > 0 || expanded ? (
            <Pressable
              onPress={() => setExpanded((v) => !v)}
              className="w-[88px] items-center justify-center active:opacity-70"
            >
              <View className="h-14 w-14 items-center justify-center rounded-full border border-border bg-card">
                <Type variant="captionStrong" tone="primary">
                  {expanded ? "−" : `+${hiddenCount}`}
                </Type>
              </View>
              <Type variant="captionStrong" tone="primary" className="mt-1.5 text-center">
                {expanded ? "Less" : "All"}
              </Type>
            </Pressable>
          ) : null}
        </ScrollView>
      ) : (
        <View className="rounded-2xl border border-border bg-card p-4">
          <Type variant="heading">
            Nobody here yet
          </Type>
          <Type variant="caption" tone="muted" className="mt-2 leading-5">
            Invite someone, or find people you already know. When they check
            into a room it shows up here so you can jump in.
          </Type>
          {/* "find people you already know" was the right thing to say and did
              nothing — it was a sentence, not a control. Someone looking at an
              empty friends list is the most willing they will ever be to hand
              over contacts, and this is that moment. */}
          {granted === false ? (
            <Pressable
              onPress={findFriends}
              disabled={scanning}
              className="mt-4 self-start rounded-full bg-primary px-5 py-3 active:opacity-80"
            >
              <Type variant="captionStrong" tone="onPrimary">
                {scanning ? "Looking..." : "Find people you know"}
              </Type>
            </Pressable>
          ) : null}
        </View>
      )}
    </View>
  );
}

function YourRoomsSection() {
  const navigation = useNavigation<any>();
  const { data: huddles, isLoading } = useUserHuddles();
  const unsorted = (huddles ?? []).filter((huddle) => !huddle.isOfficialTeam);

  // The game each room is about — ONE query for every room, not one per room.
  const { data: gamesByTeam } = useRoomGames(unsorted.map((r) => r.teamId));

  // Who is in which room right now, from the presence channel the app already
  // runs. This is the half the list never had: it could say a room has three
  // members and not that one of them is in it at this second.
  const { presentUsers } = useGlobalPresence();
  const hereByRoom = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const u of presentUsers) {
      if (!u.huddleId) continue;
      const first = (u.displayName ?? "Someone").split(/\s+/)[0];
      m.set(u.huddleId, [...(m.get(u.huddleId) ?? []), first]);
    }
    return m;
  }, [presentUsers]);

  /**
   * Order: a game on, then people in, then whatever spoke last.
   *
   * The list used to arrive in whatever order the query returned, which meant
   * the one room with a game live in it could sit sixth. Both live states
   * count and they are independent — see HuddleCard — so a room scores for
   * each, and a room with a game AND people in it beats both.
   */
  const rooms = useMemo(() => {
    const score = (r: (typeof unsorted)[number]) => {
      const gameOn =
        r.teamId && gamesByTeam?.get(r.teamId)?.status === "live" ? 2 : 0;
      const peopleIn = (hereByRoom.get(r.id)?.length ?? 0) > 0 ? 1 : 0;
      return gameOn + peopleIn;
    };
    return [...unsorted].sort((a, b) => {
      const diff = score(b) - score(a);
      if (diff !== 0) return diff;
      return (
        new Date(b.lastMessageAt ?? 0).getTime() -
        new Date(a.lastMessageAt ?? 0).getTime()
      );
    });
  }, [unsorted, gamesByTeam, hereByRoom]);

  return (
    <View className="px-4">
      <View className="mb-3 flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <Users color={colors.primary} size={17} />
          <Eyebrow tone="default">Your Rooms</Eyebrow>
        </View>
        {/* Was "+ New". You don't decide to make a room, you decide to bring
            somebody — and the room exists because of that. Same destination
            for now; the word is what changes what people expect of it. */}
        <Pressable onPress={() => navigation.navigate("CreateSideHuddle")}>
          <Type variant="captionStrong" tone="primary">＋ Invite</Type>
        </Pressable>
      </View>

      {isLoading ? (
        <View className="gap-3">
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
        </View>
      ) : rooms.length > 0 ? (
        <View className="gap-3">
          {rooms.map((room) => (
            <HuddleCard
              key={room.id}
              huddle={room}
              game={room.teamId ? gamesByTeam?.get(room.teamId) : undefined}
              hereNow={hereByRoom.get(room.id)}
              onPress={() =>
                navigation.navigate("Huddle", {
                  huddleId: room.id,
                })
              }
            />
          ))}
        </View>
      ) : (
        <View className="rounded-2xl border border-border bg-card p-4">
          <View className="flex-row items-center gap-2">
            <Lock color={colors.primary} size={17} />
            <Type variant="heading">
              No rooms yet
            </Type>
          </View>
          <Type variant="caption" tone="muted" className="mt-2 leading-5">
            Create a room anchored to a team. Invite-only — only people with
            your link can join.
          </Type>
        </View>
      )}
    </View>
  );
}

export function HomeScreen() {
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { unreadCount } = useInAppNotifications(8);
  const { data: myHuddles } = useUserHuddles();
  const [refreshing, setRefreshing] = useState(false);

  const myName =
    profile?.displayName ??
    profile?.username ??
    (user?.user_metadata?.display_name as string | undefined) ??
    "You";

  /**
   * Tapping a game takes you to the room for it.
   *
   * The strip was decorative: six cards you could press that did nothing. A
   * score is only interesting because of where you'd go to talk about it, so
   * the tap resolves to your room for that team — and when you don't have one,
   * to making it, with the team already chosen.
   *
   * It deliberately does NOT open a public room full of strangers. That's the
   * empty-room problem, and it's the reason there is no game-room directory.
   */
  const handlePickGame = useCallback(
    (game: RoomGame) => {
      const mine = (myHuddles ?? []).find(
        (h) => h.teamId === game.us.teamId || h.teamId === game.them.teamId,
      );
      if (mine) {
        navigation.navigate("Huddle", { huddleId: mine.id });
        return;
      }
      navigation.navigate("CreateSideHuddle", { teamId: game.us.teamId });
    },
    [myHuddles, navigation],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ["user-huddles"] });
    await queryClient.invalidateQueries({ queryKey: ["super-huddle-feed"] });
    await queryClient.invalidateQueries({ queryKey: ["in-app-notifications"] });
    setRefreshing(false);
  }, [queryClient]);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <View className="flex-row items-center justify-between px-4 pb-4 pt-2">
        <View>
          <View className="flex-row items-center gap-2">
            <Radio color={colors.primary} size={18} />
            <Type variant="display">Side Huddle</Type>
          </View>
          <Type variant="caption" tone="muted" style={{ marginTop: 2 }}>
            Friend rooms only. No public room directory.
          </Type>
        </View>

        <Pressable
          className="active:opacity-80"
          onPress={() => navigation.navigate("Profile")}
        >
          {profile?.avatarUrl ? (
            <Image
              source={{ uri: profile.avatarUrl }}
              style={{ width: 42, height: 42, borderRadius: 21 }}
            />
          ) : (
            <MonogramAvatar name={myName} size={42} />
          )}
          {unreadCount > 0 ? (
            <View className="absolute -right-1 -top-1 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 py-0.5">
              <Type variant="dataStrong" className="text-destructive-foreground">
                {unreadCount > 9 ? "9+" : unreadCount}
              </Type>
            </View>
          ) : null}
        </Pressable>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ gap: 24, paddingBottom: 36 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <CompleteProfileCard />
        <FriendsNowSection />
        {/* Who's around, then what's on, then where you'd go. The strip
            removes itself entirely when nothing is playing — in July, Home is
            just your rooms. */}
        <GamesStrip onPickGame={handlePickGame} />
        <YourRoomsSection />
      </ScrollView>

      <Pressable
        className="absolute bottom-6 right-6 h-14 w-14 items-center justify-center rounded-full bg-primary shadow-lg active:opacity-80"
        onPress={() => navigation.navigate("CreateSideHuddle")}
      >
        <Plus color={colors.primaryForeground} size={28} />
      </Pressable>
    </SafeAreaView>
  );
}
