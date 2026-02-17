import { View, Text, Image, Pressable, Alert } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { ChevronLeft, Users, Globe, Lock, UserPlus, UserMinus, Settings } from "lucide-react-native";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { colors } from "@/theme/colors";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import type { HuddleDetails } from "@/hooks/useHuddleDetails";

type Props = {
  huddle: HuddleDetails;
};

export function HuddleHeader({ huddle }: Props) {
  const navigation = useNavigation();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const displayName = huddle.isOfficialTeam
    ? huddle.teamName ?? huddle.name
    : huddle.name;

  const toggleMembership = async () => {
    if (!user) return;

    if (huddle.isMember) {
      Alert.alert("Leave Huddle", `Leave ${displayName}?`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Leave",
          style: "destructive",
          onPress: async () => {
            await supabase
              .from("huddle_members")
              .delete()
              .eq("huddle_id", huddle.id)
              .eq("user_id", user.id);
            queryClient.invalidateQueries({
              queryKey: ["huddle-details", huddle.id],
            });
            queryClient.invalidateQueries({ queryKey: ["user-huddles"] });
          },
        },
      ]);
    } else {
      await supabase.from("huddle_members").insert({
        huddle_id: huddle.id,
        user_id: user.id,
      });
      queryClient.invalidateQueries({
        queryKey: ["huddle-details", huddle.id],
      });
      queryClient.invalidateQueries({ queryKey: ["user-huddles"] });
    }
  };

  return (
    <View className="flex-row items-center gap-3 border-b border-border bg-background px-4 py-3">
      {/* Back */}
      <Pressable
        onPress={() => navigation.goBack()}
        className="active:opacity-60"
        hitSlop={8}
      >
        <ChevronLeft color={colors.foreground} size={24} />
      </Pressable>

      {/* Team logo */}
      <View className="h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-muted">
        {huddle.teamLogoUrl ? (
          <Image
            source={{ uri: huddle.teamLogoUrl }}
            className="h-full w-full"
            resizeMode="cover"
          />
        ) : (
          <Text className="text-sm font-bold text-muted-foreground">
            {displayName.charAt(0)}
          </Text>
        )}
      </View>

      {/* Name + info */}
      <View className="flex-1 gap-0.5">
        <Text className="text-base font-semibold text-foreground" numberOfLines={1}>
          {displayName}
        </Text>
        <View className="flex-row items-center gap-2">
          {huddle.isOfficialTeam ? (
            <Globe color={colors.secondary} size={12} />
          ) : (
            <Lock color={colors.mutedForeground} size={12} />
          )}
          <View className="flex-row items-center gap-1">
            <Users color={colors.mutedForeground} size={12} />
            <Text className="text-xs text-muted-foreground">
              {huddle.memberCount}
            </Text>
          </View>
        </View>
      </View>

      {/* Follow/Unfollow */}
      {user && (
        <Pressable
          onPress={toggleMembership}
          className="active:opacity-60"
          hitSlop={8}
        >
          {huddle.isMember ? (
            <UserMinus color={colors.mutedForeground} size={20} />
          ) : (
            <UserPlus color={colors.primary} size={20} />
          )}
        </Pressable>
      )}

      {/* Settings */}
      {user && huddle.isMember && (
        <Pressable
          onPress={() =>
            navigation.navigate("HuddleSettings", { huddleId: huddle.id })
          }
          className="active:opacity-60"
          hitSlop={8}
        >
          <Settings color={colors.mutedForeground} size={20} />
        </Pressable>
      )}
    </View>
  );
}
