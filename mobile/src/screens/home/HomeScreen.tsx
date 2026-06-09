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
import { HuddleCard } from "@/components/home/HuddleCard";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useInAppNotifications } from "@/hooks/useInAppNotifications";
import { useUserHuddles } from "@/hooks/useUserHuddles";
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
  const inviteFriends = useCallback(() => {
    Share.share({
      message:
        "Join me on Side Huddle. We can jump into game rooms when friends are watching.",
    });
  }, []);

  return (
    <View className="px-4">
      <View className="mb-3 flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <View className="h-2 w-2 rounded-full bg-muted-foreground" />
          <Text className="text-sm font-black uppercase tracking-widest text-foreground">
            Friends Now
          </Text>
        </View>
        <Pressable className="flex-row items-center gap-1" onPress={inviteFriends}>
          <UserPlus color={colors.primary} size={14} />
          <Text className="text-xs font-black text-primary">Invite</Text>
        </Pressable>
      </View>
      <View className="rounded-2xl border border-border bg-card p-4">
        <Text className="text-base font-black text-foreground">
          No friends watching yet
        </Text>
        <Text className="mt-2 text-sm leading-5 text-muted-foreground">
          When a friend checks into a room, it appears here so you can jump in
          without searching.
        </Text>
      </View>
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
  const { unreadCount } = useInAppNotifications(8);
  const [refreshing, setRefreshing] = useState(false);

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
          <MonogramAvatar name={user?.user_metadata?.display_name ?? "You"} size={42} />
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
