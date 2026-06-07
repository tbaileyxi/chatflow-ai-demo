import { View, Text, Image, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRoute, useNavigation, type RouteProp } from "@react-navigation/native";
import { useQueryClient } from "@tanstack/react-query";
import { Users, MessageSquare } from "lucide-react-native";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useHuddleDetails } from "@/hooks/useHuddleDetails";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { colors } from "@/theme/colors";
import type { RootStackParamList } from "@/navigation/types";

type Route = RouteProp<RootStackParamList, "JoinHuddle">;

export function JoinHuddleScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { huddleId } = route.params;
  const { data: huddle, isLoading } = useHuddleDetails(huddleId);

  if (isLoading || !huddle) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <LoadingSpinner className="flex-1" />
      </SafeAreaView>
    );
  }

  const displayName = huddle.isOfficialTeam
    ? huddle.teamName ?? huddle.name
    : huddle.name;

  const handleJoin = async () => {
    if (!user) return;

    if (huddle.isPrivate) {
      const { error } = await supabase
        .from("huddle_join_requests")
        .upsert({
          huddle_id: huddleId,
          user_id: user.id,
          status: "pending",
          message: null,
        });

      if (error) {
        Alert.alert("Error", "Could not request access. Please try again.");
        return;
      }

      Alert.alert(
        "Request sent",
        "The huddle admins will see your request and can approve you.",
      );
      return;
    }

    const { error } = await supabase
      .from("huddle_members")
      .insert({ huddle_id: huddleId, user_id: user.id });

    if (error) {
      Alert.alert("Error", "Failed to join Side Huddle.");
      return;
    }

    queryClient.invalidateQueries({ queryKey: ["huddle-details", huddleId] });
    queryClient.invalidateQueries({ queryKey: ["user-huddles"] });

    // Notify the huddle captain
    const memberName = profile?.displayName ?? profile?.username ?? "Someone";
    supabase.functions
      .invoke("send-push-notification", {
        body: { type: "member_joined", huddleId, memberName },
      })
      .catch(() => {});

    navigation.navigate("Huddle", { huddleId });
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 items-center justify-center px-8">
        <Card className="w-full">
          <CardContent className="items-center gap-4 pt-6">
            {/* Team logo */}
            <View className="h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-muted">
              {huddle.teamLogoUrl ? (
                <Image
                  source={{ uri: huddle.teamLogoUrl }}
                  className="h-full w-full"
                  resizeMode="cover"
                />
              ) : (
                <Text className="text-2xl font-bold text-muted-foreground">
                  {displayName.charAt(0)}
                </Text>
              )}
            </View>

            <Text className="text-xl font-bold text-foreground">
              {displayName}
            </Text>

            {huddle.teamCity && huddle.teamName && (
              <Text className="text-sm text-muted-foreground">
                {huddle.teamCity} {huddle.teamName}
              </Text>
            )}

            {/* Stats */}
            <View className="flex-row items-center gap-4">
              <View className="flex-row items-center gap-1">
                <Users color={colors.mutedForeground} size={14} />
                <Text className="text-sm text-muted-foreground">
                  {huddle.memberCount} members
                </Text>
              </View>
              <View className="flex-row items-center gap-1">
                <MessageSquare color={colors.success} size={14} />
                <Text className="text-sm text-success">Active chat</Text>
              </View>
            </View>

            {/* Action */}
            {huddle.isMember ? (
              <View className="w-full gap-2">
                <Text className="text-center text-sm text-muted-foreground">
                  You're already a member
                </Text>
                <Button
                  size="lg"
                  onPress={() =>
                    navigation.navigate("Huddle", { huddleId })
                  }
                >
                  Go to Side Huddle
                </Button>
              </View>
            ) : huddle.isPrivate ? (
              <View className="w-full gap-2">
                <Text className="text-center text-sm text-muted-foreground">
                  This Official Huddle uses approval membership.
                </Text>
                <Button size="lg" className="w-full" onPress={handleJoin}>
                  Request Access
                </Button>
              </View>
            ) : (
              <Button size="lg" className="w-full" onPress={handleJoin}>
                Join Side Huddle
              </Button>
            )}

            <Button
              variant="ghost"
              onPress={() => navigation.goBack()}
            >
              Maybe Later
            </Button>
          </CardContent>
        </Card>
      </View>
    </SafeAreaView>
  );
}
