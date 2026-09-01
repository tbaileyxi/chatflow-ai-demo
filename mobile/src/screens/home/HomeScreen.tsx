import { useCallback, useState } from "react";
import {
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
import { useKnownPeople } from "@/hooks/useFriends";
import { useAutoContactMatch } from "@/hooks/useAutoContactMatch";
import { useContactMatch } from "@/hooks/useContactMatch";
import { useGlobalPresence } from "@/contexts/GlobalPresenceContext";
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
      <Text style={{ color: palette.fg, fontSize: size * 0.34, fontWeight: "800" }}>
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

  const inviteFriends = useCallback(() => {
    Share.share({
      message:
        "Join me on Side Huddle. We can jump into game rooms when friends are watching. https://www.sidehuddlesports.com",
    });
  }, []);

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
  const { newPeople, forget } = useAutoContactMatch();
  const { connect } = useContactMatch();

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
          <Text className="text-sm font-black uppercase tracking-widest text-foreground">
            Friends Now
          </Text>
        </View>
        <Pressable className="flex-row items-center gap-1" onPress={inviteFriends}>
          <UserPlus color={colors.primary} size={14} />
          <Text className="text-xs font-black text-primary">Invite</Text>
        </Pressable>
      </View>

      {newPeople.length > 0 ? (
        <View className="mb-4 gap-2">
          <Text className="text-xs font-black uppercase tracking-widest text-primary">
            {newPeople.length === 1
              ? "Someone you know is here"
              : `${newPeople.length} people you know are here`}
          </Text>
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
                  <Text className="text-base font-black text-foreground" numberOfLines={1}>
                    {label}
                  </Text>
                  <Text className="text-sm text-muted-foreground" numberOfLines={1}>
                    From your contacts
                  </Text>
                </View>
                <Pressable
                  onPress={async () => {
                    await connect(m.userId);
                    forget(m.userId);
                  }}
                  hitSlop={8}
                  className="rounded-full bg-primary px-4 py-1.5 active:opacity-80"
                >
                  <Text className="text-xs font-black text-primary-foreground">Add</Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      ) : null}

      {roster.length > 0 ? (
        <View className="gap-2">
          {visible.map((f) => (
            <Pressable
              key={f.userId}
              // Every row taps through now. Offline rows used to be disabled
              // outright, so a name you did not recognise — and "User" is what
              // the database calls anyone who never finished onboarding — was a
              // dead end with no way to find out who it was.
              onPress={() =>
                navigation.navigate("PublicProfile", { userId: f.userId, knownAs: f.name })
              }
              className={`flex-row items-center gap-3 rounded-2xl border border-border bg-card p-3 ${
                f.isLive ? "active:opacity-80" : ""
              }`}
              // Offline people stay on the list but read as background: dimmed
              // avatar and name, no tap target. The list is a roster you can
              // count on, with presence as the layer on top.
              style={f.isLive ? undefined : { opacity: 0.45 }}
            >
              {f.avatarUrl ? (
                <Image
                  source={{ uri: f.avatarUrl }}
                  className="h-9 w-9 rounded-full"
                />
              ) : (
                <MonogramAvatar name={f.name} size={36} />
              )}
              <View className="flex-1">
                <Text className="text-base font-black text-foreground" numberOfLines={1}>
                  {f.name}
                </Text>
                <Text className="text-sm text-muted-foreground" numberOfLines={1}>
                  {f.isLive ? `in ${f.huddleName ?? "a huddle"}` : "not watching"}
                </Text>
              </View>
              {f.isLive && f.huddleId ? (
                <Pressable
                  onPress={() =>
                    navigation.navigate("Huddle", { huddleId: f.huddleId! })
                  }
                  hitSlop={10}
                  className="active:opacity-70"
                >
                  <Text className="text-xs font-black text-primary">Jump in →</Text>
                </Pressable>
              ) : null}
            </Pressable>
          ))}

          {hiddenCount > 0 || expanded ? (
            <Pressable
              onPress={() => setExpanded((v) => !v)}
              className="py-2 active:opacity-70"
            >
              <Text className="text-sm font-black text-primary">
                {expanded ? "Show less" : `Show all ${roster.length}`}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <View className="rounded-2xl border border-border bg-card p-4">
          <Text className="text-base font-black text-foreground">
            Nobody here yet
          </Text>
          <Text className="mt-2 text-sm leading-5 text-muted-foreground">
            Invite someone, or find people you already know. When they check
            into a room it shows up here so you can jump in.
          </Text>
        </View>
      )}
    </View>
  );
}

function YourRoomsSection() {
  const navigation = useNavigation<any>();
  const { data: huddles, isLoading } = useUserHuddles();
  const rooms = (huddles ?? []).filter((huddle) => !huddle.isOfficialTeam);

  return (
    <View className="px-4">
      <View className="mb-3 flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <Users color={colors.primary} size={17} />
          <Text className="text-sm font-black uppercase tracking-widest text-foreground">
            Your Rooms
          </Text>
        </View>
        <Pressable onPress={() => navigation.navigate("CreateSideHuddle")}>
          <Text className="text-sm font-black text-primary">+ New</Text>
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
            <Text className="text-base font-black text-foreground">
              No rooms yet
            </Text>
          </View>
          <Text className="mt-2 text-sm leading-5 text-muted-foreground">
            Create a room anchored to a team. Invite-only — only people with
            your link can join.
          </Text>
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
  const [refreshing, setRefreshing] = useState(false);

  const myName =
    profile?.displayName ??
    profile?.username ??
    (user?.user_metadata?.display_name as string | undefined) ??
    "You";

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
            <Text className="text-3xl font-black text-foreground">
              Side Huddle
            </Text>
          </View>
          <Text className="mt-1 text-sm text-muted-foreground">
            Friend rooms only. No public room directory.
          </Text>
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
              <Text className="text-[10px] font-black text-destructive-foreground">
                {unreadCount > 9 ? "9+" : unreadCount}
              </Text>
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
