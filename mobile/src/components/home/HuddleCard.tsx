import { Pressable, View, Text, Image } from "react-native";
import { Lock, Users } from "lucide-react-native";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
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
      <View className="flex-1 gap-0.5">
        <View className="flex-row items-center gap-1.5">
          <Lock color={colors.mutedForeground} size={14} />
          <Text className="flex-1 text-base font-semibold text-foreground" numberOfLines={1}>
            {huddle.name}
          </Text>
          {huddle.hasUnread && <Badge variant="default">New</Badge>}
        </View>

        {huddle.latestMessage && (
          <Text className="text-sm text-muted-foreground" numberOfLines={1}>
            {huddle.latestMessageIsBot ? "🤖 " : ""}
            {huddle.latestMessage}
          </Text>
        )}

        <View className="flex-row items-center gap-1">
          <Users color={colors.mutedForeground} size={11} />
          <Text className="text-xs text-muted-foreground">
            {huddle.memberCount}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
