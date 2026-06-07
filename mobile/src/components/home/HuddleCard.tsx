import { Pressable, View, Text, Image } from "react-native";
import { Crown, Users } from "lucide-react-native";
import { cn } from "@/lib/utils";
import { colors } from "@/theme/colors";
import type { UserHuddle } from "@/hooks/useUserHuddles";

type Props = {
  huddle: UserHuddle;
  onPress: () => void;
};

export function HuddleCard({ huddle, onPress }: Props) {
  return (
    <Pressable
      className="flex-row items-center gap-3 rounded-lg border border-border bg-card p-3 active:opacity-80"
      onPress={onPress}
    >
      {/* Avatar */}
      <View
        className={cn(
          "h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-muted",
          huddle.hasUnread && "border-2 border-success",
        )}
      >
        {huddle.teamLogoUrl ? (
          <Image
            source={{ uri: huddle.teamLogoUrl }}
            className="h-full w-full"
            resizeMode="cover"
          />
        ) : (
          <Text className="text-lg font-bold text-muted-foreground">
            {huddle.name.charAt(0)}
          </Text>
        )}
      </View>

      {/* Content */}
      <View className="flex-1 gap-1">
        <View className="flex-row items-center gap-2">
          <Text className="flex-1 text-base font-semibold text-foreground" numberOfLines={1}>
            {huddle.name}
          </Text>
          {huddle.roomRole === "owner" ? (
            <View className="flex-row items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5">
              <Crown color={colors.primary} size={10} />
              <Text className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Owner
              </Text>
            </View>
          ) : null}
        </View>

        <View className="flex-row items-center gap-1">
          <Users color={colors.mutedForeground} size={11} />
          <Text className="text-xs text-muted-foreground">
            {huddle.memberCount} people
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
