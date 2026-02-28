import { useState, useEffect } from "react";
import { View, Text, Alert, Image, Pressable, Share } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRoute, useNavigation, type RouteProp } from "@react-navigation/native";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Crown, Trash2, LogOut, Bot, X, Share2 } from "lucide-react-native";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useHuddleDetails } from "@/hooks/useHuddleDetails";
import { useHuddleMembers } from "@/hooks/useHuddleMembers";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ScreenWrapper } from "@/components/ui/screen-wrapper";
import { colors } from "@/theme/colors";
import type { RootStackParamList } from "@/navigation/types";

type Route = RouteProp<RootStackParamList, "HuddleSettings">;

export function HuddleSettingsScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { huddleId } = route.params;
  const { data: huddle, isLoading } = useHuddleDetails(huddleId);
  const { data: members } = useHuddleMembers(
    huddleId,
    huddle?.ownerId ?? "",
  );

  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);

  const isOwner = user?.id === huddle?.ownerId;

  useEffect(() => {
    if (huddle?.bio) setBio(huddle.bio);
  }, [huddle?.bio]);

  if (isLoading || !huddle) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <LoadingSpinner className="flex-1" />
      </SafeAreaView>
    );
  }

  const saveBio = async () => {
    setSaving(true);
    await supabase
      .from("huddles")
      .update({ bio: bio.trim() || null })
      .eq("id", huddleId);
    queryClient.invalidateQueries({ queryKey: ["huddle-details", huddleId] });
    setSaving(false);
    Alert.alert("Saved", "Side Huddle bio updated.");
  };

  const removeMember = (memberId: string, name: string) => {
    Alert.alert("Remove Member", `Remove ${name} from this Side Huddle?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          await supabase
            .from("huddle_members")
            .delete()
            .eq("huddle_id", huddleId)
            .eq("user_id", memberId);
          queryClient.invalidateQueries({
            queryKey: ["huddle-members", huddleId],
          });
          queryClient.invalidateQueries({
            queryKey: ["huddle-details", huddleId],
          });
        },
      },
    ]);
  };

  const leaveHuddle = () => {
    Alert.alert("Leave Side Huddle", `Leave ${huddle.name}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Leave",
        style: "destructive",
        onPress: async () => {
          if (!user) return;
          await supabase
            .from("huddle_members")
            .delete()
            .eq("huddle_id", huddleId)
            .eq("user_id", user.id);
          queryClient.invalidateQueries({ queryKey: ["user-huddles"] });
          navigation.navigate("MainTabs", { screen: "Home" });
        },
      },
    ]);
  };

  const ownerLeaveHuddle = () => {
    Alert.alert(
      "Leave Side Huddle",
      "You are the creator. Leaving will delete this Side Huddle and all messages.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Leave & Delete",
          style: "destructive",
          onPress: async () => {
            await supabase.from("huddles").delete().eq("id", huddleId);
            queryClient.invalidateQueries({ queryKey: ["user-huddles"] });
            navigation.navigate("MainTabs", { screen: "Home" });
          },
        },
      ],
    );
  };

  const deleteHuddle = () => {
    Alert.alert(
      "Delete Side Huddle",
      "This will permanently delete this Side Huddle and all messages. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await supabase.from("huddles").delete().eq("id", huddleId);
            queryClient.invalidateQueries({ queryKey: ["user-huddles"] });
            navigation.navigate("MainTabs", { screen: "Home" });
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center gap-3 px-4 py-3">
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <ChevronLeft color={colors.foreground} size={24} />
        </Pressable>
        <Text className="flex-1 text-lg font-bold text-foreground">
          Side Huddle Settings
        </Text>
        {isOwner && (
          <Button
            variant="outline"
            size="sm"
            onPress={() =>
              navigation.navigate("HuddleCoachSettings", { huddleId })
            }
          >
            <View className="flex-row items-center gap-1.5">
              <Bot color={colors.secondary} size={16} />
              <Text className="text-sm font-medium text-foreground">Coach</Text>
            </View>
          </Button>
        )}
      </View>

      <ScreenWrapper scroll className="gap-4 pt-2">
        {/* Bio */}
        {isOwner && (
          <Card>
            <CardHeader>
              <CardTitle>Side Huddle Bio</CardTitle>
            </CardHeader>
            <CardContent className="gap-3">
              <Textarea
                value={bio}
                onChangeText={(t) => setBio(t.slice(0, 280))}
                placeholder="Describe your Side Huddle..."
                maxLength={280}
              />
              <View className="flex-row items-center justify-between">
                <Text className="text-xs text-muted-foreground">
                  {bio.length}/280
                </Text>
                <Button size="sm" onPress={saveBio} disabled={saving}>
                  {saving ? "Saving..." : "Save"}
                </Button>
              </View>
            </CardContent>
          </Card>
        )}

        {/* Members */}
        <Card>
          <CardHeader>
            <CardTitle>
              Members ({huddle.memberCount})
            </CardTitle>
          </CardHeader>
          <CardContent className="gap-2">
            {members?.map((m) => (
              <View
                key={m.userId}
                className="flex-row items-center gap-3 py-1.5"
              >
                <View className="h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-muted">
                  {m.avatarUrl ? (
                    <Image
                      source={{ uri: m.avatarUrl }}
                      className="h-full w-full"
                    />
                  ) : (
                    <Text className="text-xs font-bold text-muted-foreground">
                      {(m.displayName ?? m.username ?? "U").charAt(0)}
                    </Text>
                  )}
                </View>
                <View className="flex-1">
                  <View className="flex-row items-center gap-1.5">
                    <Text className="text-sm font-medium text-foreground">
                      {m.displayName ?? m.username ?? "User"}
                    </Text>
                    {m.isOwner && <Crown color={colors.primary} size={14} />}
                  </View>
                </View>
                {isOwner && !m.isOwner && m.userId !== user?.id && (
                  <Pressable
                    onPress={() =>
                      removeMember(
                        m.userId,
                        m.displayName ?? m.username ?? "this member",
                      )
                    }
                    hitSlop={8}
                  >
                    <X color={colors.mutedForeground} size={16} />
                  </Pressable>
                )}
              </View>
            ))}
          </CardContent>
        </Card>

        {/* Invite Link */}
        <Button
          variant="outline"
          onPress={() => {
            const inviteLink = `sidehuddle://join-huddle/${huddleId}`;
            Share.share({
              message: `Join my Side Huddle "${huddle.name}" on Side Huddle Sports! ${inviteLink}`,
              url: inviteLink,
            });
          }}
        >
          <View className="flex-row items-center gap-2">
            <Share2 color={colors.primary} size={16} />
            <Text className="text-sm font-medium text-primary">
              Invite Friends
            </Text>
          </View>
        </Button>

        <Separator />

        {/* Actions */}
        <View className="gap-3 pb-8">
          {!isOwner && (
            <Button variant="outline" onPress={leaveHuddle}>
              <View className="flex-row items-center gap-2">
                <LogOut color={colors.foreground} size={16} />
                <Text className="text-sm font-medium text-foreground">
                  Leave Side Huddle
                </Text>
              </View>
            </Button>
          )}
          {isOwner && (
            <>
              <Button variant="outline" onPress={ownerLeaveHuddle}>
                <View className="flex-row items-center gap-2">
                  <LogOut color={colors.foreground} size={16} />
                  <Text className="text-sm font-medium text-foreground">
                    Leave Side Huddle
                  </Text>
                </View>
              </Button>
              <Button variant="destructive" onPress={deleteHuddle}>
                <View className="flex-row items-center gap-2">
                  <Trash2 color={colors.destructiveForeground} size={16} />
                  <Text className="text-sm font-medium text-destructive-foreground">
                    Delete Side Huddle
                  </Text>
                </View>
              </Button>
            </>
          )}
        </View>
      </ScreenWrapper>
    </SafeAreaView>
  );
}
