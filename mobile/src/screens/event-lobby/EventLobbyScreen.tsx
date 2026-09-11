import { Pressable, ScrollView, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Bot, CalendarDays, Plus, Users } from "lucide-react-native";
import { Type } from "@/components/ui/Type";
import { DEV_ROOMS_STORAGE_KEY } from "@/config/devData";
import { FEATURED_EVENTS, getFeaturedEventById } from "@/config/featuredEvents";
import { useAuth } from "@/hooks/useAuth";
import type { RootStackParamList } from "@/navigation/types";
import { colors } from "@/theme/colors";

type Route = NativeStackScreenProps<RootStackParamList, "EventLobby">["route"];

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function AvatarStack({ names }: { names: string[] }) {
  return (
    <View className="flex-row">
      {names.slice(0, 4).map((name, index) => (
        <View
          key={name}
          className="h-9 w-9 items-center justify-center rounded-full border-2 border-card bg-muted"
          style={index > 0 ? { marginLeft: -9 } : undefined}
        >
          <Type variant="captionStrong">
            {initials(name)}
          </Type>
        </View>
      ))}
    </View>
  );
}

export function EventLobbyScreen() {
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const route = useRoute<Route>();
  const { user } = useAuth();
  const isDevTestUser = user?.app_metadata?.provider === "dev_test";
  const event =
    getFeaturedEventById(route.params.eventId) ?? FEATURED_EVENTS[0];

  const enterEventRoom = async ({
    huddleId,
    name,
    relationship,
    memberCount,
  }: {
    huddleId: string;
    name: string;
    relationship: "owner" | "joined";
    memberCount: number;
  }) => {
    if (isDevTestUser) {
      const stored = await AsyncStorage.getItem(DEV_ROOMS_STORAGE_KEY);
      const current = stored ? JSON.parse(stored) : [];
      const exists = current.some((item: any) => item.id === huddleId);
      if (!exists) {
        await AsyncStorage.setItem(
          DEV_ROOMS_STORAGE_KEY,
          JSON.stringify([
            {
              id: huddleId,
              name,
              teamCity: event.name,
              teamName: "Event",
              teamLogoUrl: null,
              relationship,
              accessMode: "link",
              memberCount,
              createdAt: new Date().toISOString(),
            },
            ...current,
          ]),
        );
        await queryClient.invalidateQueries({ queryKey: ["user-huddles"] });
      }
    }
    navigation.navigate("Huddle", { huddleId });
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <View className="flex-row items-center gap-3 border-b border-border px-4 pb-4 pt-2">
        <Pressable
          className="h-11 w-11 items-center justify-center rounded-full bg-card active:opacity-80"
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft color={colors.primary} size={24} />
        </Pressable>
        <View className="flex-1">
          <Type variant="eyebrow" tone="primary">
            Event lobby
          </Type>
          <Type variant="title"  numberOfLines={1}>
            {event.name}
          </Type>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 14 }}
      >
        <View className="rounded-2xl border border-primary/30 bg-primary/10 p-4">
          <View className="flex-row items-center gap-2">
            <Bot color={colors.primary} size={18} />
            <Type variant="heading">
              {event.botLabel} loads automatically
            </Type>
          </View>
          <Type variant="caption" tone="muted" className="mt-2 leading-5">
            You never enter a room with strangers. Jump into a friend's room or
            start your own event room and invite your people.
          </Type>
        </View>

        <View>
          <View className="mb-3 flex-row items-center justify-between">
            <Type variant="eyebrow" tone="muted">
              Friends with rooms
            </Type>
            <Type variant="captionStrong" tone="muted">
              {event.rooms.length} active
            </Type>
          </View>

          {event.rooms.length > 0 ? (
            <View className="gap-3">
              {event.rooms.map((room) => (
                <Pressable
                  key={room.id}
                  className="rounded-2xl border border-border bg-card p-4 active:opacity-80"
                  onPress={() =>
                    enterEventRoom({
                      huddleId: room.id,
                      name: room.name,
                      relationship: "joined",
                      memberCount: room.friends.length + 1,
                    })
                  }
                >
                  <View className="flex-row items-center gap-3">
                    <AvatarStack names={room.friends} />
                    <View className="flex-1">
                      <Type variant="title"  numberOfLines={1}>
                        {room.name}
                      </Type>
                      <Type variant="caption" tone="muted"  numberOfLines={1}>
                        {room.friends.join(", ")} are watching
                      </Type>
                    </View>
                  </View>
                  <View className="mt-4 rounded-full bg-primary px-4 py-3">
                    <Type variant="captionStrong" tone="onPrimary" className="text-center">
                      Jump in
                    </Type>
                  </View>
                </Pressable>
              ))}
            </View>
          ) : (
            <View className="rounded-2xl border border-border bg-card p-4">
              <View className="flex-row items-center gap-2">
                <Users color={colors.mutedForeground} size={18} />
                <Type variant="heading">
                  No friends here yet
                </Type>
              </View>
              <Type variant="caption" tone="muted" className="mt-2 leading-5">
                Start the first room. Your friends see you in Friends Now and
                can jump in from there.
              </Type>
            </View>
          )}
        </View>

        <Pressable
          className="rounded-2xl border border-primary/40 bg-card p-4 active:opacity-80"
          onPress={() =>
            enterEventRoom({
              huddleId: `dev-room-${event.id}-my-room`,
              name: `My ${event.name} Room`,
              relationship: "owner",
              memberCount: 1,
            })
          }
        >
          <View className="flex-row items-center gap-3">
            <View className="h-11 w-11 items-center justify-center rounded-full bg-primary">
              <Plus color={colors.primaryForeground} size={22} />
            </View>
            <View className="flex-1">
              <Type variant="title">
                Start your own room
              </Type>
              <Type variant="caption" tone="muted">
                Sends the presence loop: you are watching, friends can jump in.
              </Type>
            </View>
          </View>
        </Pressable>

        <View className="rounded-2xl border border-border bg-card p-4">
          <View className="flex-row items-center gap-2">
            <CalendarDays color={colors.primary} size={17} />
            <Type variant="eyebrow" tone="primary">
              {event.startsAtLabel}
            </Type>
          </View>
          <Type variant="caption" tone="muted" className="mt-2 leading-5">
            {event.subtitle}
          </Type>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
