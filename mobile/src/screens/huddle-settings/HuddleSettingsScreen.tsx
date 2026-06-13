import { useState, useEffect } from "react";
import { View, Text, Alert, Image, Pressable, Share } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRoute, useNavigation, type RouteProp } from "@react-navigation/native";
import { useQueryClient } from "@tanstack/react-query";
import {
  Ban,
  Check,
  ChevronLeft,
  Crown,
  Globe,
  Lock,
  LogOut,
  ShieldCheck,
  Trash2,
  Unlock,
  UserPlus,
  X,
  Share2,
} from "lucide-react-native";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useHuddleDetails } from "@/hooks/useHuddleDetails";
import { useHuddleMembers } from "@/hooks/useHuddleMembers";
import { OfficialUpgradePaywall } from "@/components/paywall/OfficialUpgradePaywall";
import { PullInFriendsModal } from "@/components/huddle/PullInFriendsModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [adminUsername, setAdminUsername] = useState("");
  const [joinRequests, setJoinRequests] = useState<any[]>([]);
  const [admins, setAdmins] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showPullIn, setShowPullIn] = useState(false);

  const { data: profile } = useProfile();
  const isOwner = user?.id === huddle?.ownerId;
  const isRoomAdmin =
    isOwner || admins.some((admin) => admin.user_id === user?.id);
  const isOfficial = !!huddle?.isOfficial;
  const isAppAdmin = !!profile?.isAppAdmin;
  const canFlipOfficial = isAppAdmin && isOwner;

  useEffect(() => {
    if (huddle?.bio) setBio(huddle.bio);
  }, [huddle?.bio]);

  useEffect(() => {
    const loadOfficialMeta = async () => {
      if (!huddleId) return;

      const { data: meta } = await (supabase as any)
        .from("huddles")
        .select("website_url")
        .eq("id", huddleId)
        .maybeSingle();
      setWebsiteUrl(meta?.website_url ?? "");

      const { data: adminRows } = await (supabase as any)
        .from("huddle_admins")
        .select(
          `
          user_id,
          created_at,
          profiles!user_id (display_name, username, avatar_url)
        `,
        )
        .eq("huddle_id", huddleId);
      setAdmins(adminRows ?? []);

      const { data: requests } = await supabase
        .from("huddle_join_requests")
        .select(
          `
          id,
          user_id,
          message,
          status,
          created_at
        `,
        )
        .eq("huddle_id", huddleId)
        .eq("status", "pending")
        .order("created_at", { ascending: true });

      if (!requests?.length) {
        setJoinRequests([]);
        return;
      }

      const requestUserIds = requests.map((request) => request.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, username, avatar_url")
        .in("user_id", requestUserIds);
      const profileMap = new Map((profiles ?? []).map((profile) => [profile.user_id, profile]));
      setJoinRequests(
        requests.map((request) => ({
          ...request,
          profile: profileMap.get(request.user_id) ?? null,
        })),
      );
    };

    loadOfficialMeta();
  }, [huddleId]);

  if (isLoading || !huddle) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <LoadingSpinner className="flex-1" />
      </SafeAreaView>
    );
  }

  const saveAbout = async () => {
    setSaving(true);
    const { error } = await (supabase as any)
      .from("huddles")
      .update({
        bio: bio.trim() || null,
        website_url: websiteUrl.trim() || null,
      })
      .eq("id", huddleId);
    queryClient.invalidateQueries({ queryKey: ["huddle-details", huddleId] });
    setSaving(false);
    if (error) {
      Alert.alert(
        "Not saved",
        "The Official Huddle backend fields need to be migrated before this can save.",
      );
      return;
    }
    Alert.alert("Saved", "Official Huddle details updated.");
  };

  const flipOfficialStatus = async (next: "active" | "inactive") => {
    if (!canFlipOfficial) return;
    const verb = next === "active" ? "Make Official" : "Revert to regular";
    Alert.alert(
      verb,
      next === "active"
        ? "Flip this huddle to Official? Unlocks website, multiple admins, approval mode, and listing in search."
        : "Revert this huddle to a regular room? Locks the Official-only features.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: next === "active" ? "Make Official" : "Revert",
          onPress: async () => {
            const { error } = await (supabase.rpc as any)(
              "flip_huddle_official_status",
              { p_huddle_id: huddleId, p_status: next },
            );
            if (error) {
              Alert.alert("Could not change status", error.message);
              return;
            }
            queryClient.invalidateQueries({ queryKey: ["huddle-details", huddleId] });
            queryClient.invalidateQueries({ queryKey: ["user-huddles"] });
            queryClient.invalidateQueries({ queryKey: ["huddle-search"] });
          },
        },
      ],
    );
  };

  const togglePrivate = async () => {
    if (!isRoomAdmin) return;
    // Private mode is an Official Huddle feature — gate behind the upgrade.
    if (!isOfficial && !huddle.isPrivate) {
      setShowPaywall(true);
      return;
    }
    const next = !huddle.isPrivate;
    await supabase
      .from("huddles")
      .update({ is_private: next })
      .eq("id", huddleId);
    queryClient.invalidateQueries({ queryKey: ["huddle-details", huddleId] });
    queryClient.invalidateQueries({ queryKey: ["huddle-search"] });
  };

  const approveRequest = async (request: any) => {
    if (!user) return;
    await supabase
      .from("huddle_members")
      .insert({ huddle_id: huddleId, user_id: request.user_id });
    await supabase
      .from("huddle_join_requests")
      .update({
        status: "approved",
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", request.id);
    await supabase
      .from("huddles")
      .update({ member_count: huddle.memberCount + 1 })
      .eq("id", huddleId);
    setJoinRequests((current) => current.filter((item) => item.id !== request.id));
    queryClient.invalidateQueries({ queryKey: ["huddle-members", huddleId] });
    queryClient.invalidateQueries({ queryKey: ["huddle-details", huddleId] });
  };

  const denyRequest = async (request: any) => {
    if (!user) return;
    await supabase
      .from("huddle_join_requests")
      .update({
        status: "denied",
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", request.id);
    setJoinRequests((current) => current.filter((item) => item.id !== request.id));
  };

  const addAdmin = async () => {
    if (!isOwner || !adminUsername.trim()) return;
    const username = adminUsername.trim().replace(/^@/, "").toLowerCase();
    const { data: profile } = await supabase
      .from("profiles")
      .select("user_id, display_name, username")
      .eq("username", username)
      .maybeSingle();

    if (!profile) {
      Alert.alert("Not found", "No user found with that username.");
      return;
    }

    const { error } = await (supabase as any).from("huddle_admins").upsert({
      huddle_id: huddleId,
      user_id: profile.user_id,
      created_by: user?.id,
    });
    if (error) {
      Alert.alert(
        "Admin not added",
        "The Official Huddle admin table needs to be migrated before this can work.",
      );
      return;
    }
    setAdminUsername("");
    queryClient.invalidateQueries({ queryKey: ["huddle-details", huddleId] });
    const { data: adminRows } = await (supabase as any)
      .from("huddle_admins")
      .select("user_id, created_at, profiles!user_id (display_name, username, avatar_url)")
      .eq("huddle_id", huddleId);
    setAdmins(adminRows ?? []);
  };

  const removeMember = (memberId: string, name: string, ban = false) => {
    Alert.alert("Remove Member", `Remove ${name} from this Side Huddle?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: ban ? "Ban" : "Remove",
        style: "destructive",
        onPress: async () => {
          if (ban) {
            await (supabase as any).from("huddle_bans").upsert({
              huddle_id: huddleId,
              user_id: memberId,
              banned_by: user?.id,
            });
          }
          await supabase
            .from("huddle_members")
            .delete()
            .eq("huddle_id", huddleId)
            .eq("user_id", memberId);
          await supabase
            .from("huddles")
            .update({ member_count: Math.max(0, huddle.memberCount - 1) })
            .eq("id", huddleId);
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
          <ShieldCheck color={colors.primary} size={22} />
        )}
      </View>

      <ScreenWrapper scroll className="gap-4 pt-2">
        <Card>
          <CardContent className="gap-3 pt-4">
            <View className="flex-row items-center gap-3">
              <View className="h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-muted">
                {huddle.teamLogoUrl ? (
                  <Image
                    source={{ uri: huddle.teamLogoUrl }}
                    className="h-full w-full"
                  />
                ) : (
                  <Text className="text-base font-black text-muted-foreground">
                    {huddle.name.charAt(0)}
                  </Text>
                )}
              </View>
              <View className="flex-1">
                <Text className="text-lg font-black text-foreground">
                  {huddle.name}
                </Text>
                <Text className="text-sm text-muted-foreground">
                  {huddle.memberCount} member{huddle.memberCount === 1 ? "" : "s"}
                </Text>
              </View>
              {isOfficial ? (
                <View className="rounded-full border border-primary/40 bg-primary/10 px-2 py-1">
                  <Text className="text-xs font-black text-primary">Official</Text>
                </View>
              ) : null}
            </View>
            {bio ? (
              <Text className="text-sm leading-5 text-muted-foreground">
                {bio}
              </Text>
            ) : null}
            {websiteUrl ? (
              <View className="flex-row items-center gap-2">
                <Globe color={colors.mutedForeground} size={14} />
                <Text className="text-sm font-semibold text-primary">
                  {websiteUrl}
                </Text>
              </View>
            ) : null}
          </CardContent>
        </Card>

        {/* Official Huddle upgrade — owner only.
            Today only app admins can flip. Real paywall lands separately. */}
        {isOwner && !isOfficial && (
          <Card>
            <CardContent className="gap-2 pt-4">
              <View className="flex-row items-center gap-2">
                <ShieldCheck color={colors.primary} size={18} />
                <Text className="text-base font-black text-foreground">
                  Make this an Official Huddle
                </Text>
              </View>
              <Text className="text-sm leading-5 text-muted-foreground">
                Unlocks website link, multiple admins, approval-only membership,
                and discoverability in Search. $29/mo.
              </Text>
              {canFlipOfficial ? (
                <Button onPress={() => flipOfficialStatus("active")}>
                  Make Official (admin override)
                </Button>
              ) : (
                <Button onPress={() => setShowPaywall(true)}>
                  Make Official — $29/mo
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Official status badge + revert option for app admin */}
        {isOwner && isOfficial && canFlipOfficial && (
          <Card>
            <CardContent className="gap-2 pt-4">
              <View className="flex-row items-center gap-2">
                <ShieldCheck color={colors.primary} size={18} />
                <Text className="text-sm font-bold text-foreground">
                  Official status: {huddle.officialStatus}
                </Text>
              </View>
              {!huddle.isOfficialTeam && (
                <Button
                  variant="outline"
                  size="sm"
                  onPress={() => flipOfficialStatus("inactive")}
                >
                  Revert to regular (admin)
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {isRoomAdmin && (
          <Card>
            <CardHeader>
              <CardTitle>About This Huddle</CardTitle>
            </CardHeader>
            <CardContent className="gap-3">
              <Input
                label="Room Name"
                value={huddle.name}
                editable={false}
              />
              <Textarea
                value={bio}
                onChangeText={(t) => setBio(t.slice(0, 280))}
                placeholder="Tell people who runs this huddle and what it is for..."
                maxLength={280}
              />
              {/* Website URL is an Official-only perk */}
              {isOfficial ? (
                <Input
                  label="Website"
                  value={websiteUrl}
                  onChangeText={setWebsiteUrl}
                  placeholder="https://..."
                  autoCapitalize="none"
                />
              ) : null}
              <View className="flex-row items-center justify-between">
                <Text className="text-xs text-muted-foreground">
                  {bio.length}/280
                </Text>
                <Button size="sm" onPress={saveAbout} disabled={saving}>
                  {saving ? "Saving..." : "Save"}
                </Button>
              </View>
            </CardContent>
          </Card>
        )}

        {isRoomAdmin && (
          <Card>
            <CardHeader>
              <CardTitle>Access</CardTitle>
            </CardHeader>
            <CardContent className="gap-3">
              <View className="flex-row items-center gap-3">
                {huddle.isPrivate ? (
                  <Lock color={colors.primary} size={18} />
                ) : (
                  <Unlock color={colors.mutedForeground} size={18} />
                )}
                <View className="flex-1">
                  <Text className="font-bold text-foreground">
                    {huddle.isPrivate ? "Private / Approval" : "Open by Invite"}
                  </Text>
                  <Text className="text-sm leading-5 text-muted-foreground">
                    Private huddles require approval before someone can enter.
                  </Text>
                </View>
                <Button variant="outline" size="sm" onPress={togglePrivate}>
                  {huddle.isPrivate ? "Make Open" : "Make Private"}
                </Button>
              </View>

              {huddle.isPrivate && joinRequests.length > 0 ? (
                <View className="gap-2">
                  <Text className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                    Requests
                  </Text>
                  {joinRequests.map((request) => (
                    <View
                      key={request.id}
                      className="flex-row items-center gap-3 rounded-xl border border-border bg-muted p-3"
                    >
                      <View className="h-9 w-9 items-center justify-center rounded-full bg-card">
                        <Text className="text-xs font-black text-muted-foreground">
                          {(request.profile?.display_name ?? request.profile?.username ?? "U").charAt(0)}
                        </Text>
                      </View>
                      <Text className="flex-1 font-bold text-foreground">
                        {request.profile?.display_name ?? request.profile?.username ?? "User"}
                      </Text>
                      <Pressable onPress={() => approveRequest(request)} hitSlop={8}>
                        <Check color={colors.success} size={18} />
                      </Pressable>
                      <Pressable onPress={() => denyRequest(request)} hitSlop={8}>
                        <X color={colors.destructive} size={18} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : null}
            </CardContent>
          </Card>
        )}

        {isOwner && isOfficial ? (
          <Card>
            <CardHeader>
              <CardTitle>Admins</CardTitle>
            </CardHeader>
            <CardContent className="gap-3">
              {admins.length > 0 ? (
                <View className="gap-2">
                  {admins.map((admin) => (
                    <View key={admin.user_id} className="flex-row items-center gap-3">
                      <View className="h-9 w-9 items-center justify-center rounded-full bg-muted">
                        <Text className="text-xs font-black text-muted-foreground">
                          {(admin.profiles?.display_name ?? admin.profiles?.username ?? "A").charAt(0)}
                        </Text>
                      </View>
                      <Text className="flex-1 font-bold text-foreground">
                        {admin.profiles?.display_name ?? admin.profiles?.username ?? "Admin"}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text className="text-sm text-muted-foreground">
                  Add admins to help monitor requests and members.
                </Text>
              )}
              <View className="flex-row gap-2">
                <View className="flex-1">
                  <Input
                    placeholder="@username"
                    value={adminUsername}
                    onChangeText={setAdminUsername}
                    autoCapitalize="none"
                  />
                </View>
                <Button onPress={addAdmin}>
                  <View className="flex-row items-center gap-1.5">
                    <UserPlus color={colors.primaryForeground} size={15} />
                    <Text className="font-bold text-primary-foreground">Add</Text>
                  </View>
                </Button>
              </View>
            </CardContent>
          </Card>
        ) : null}

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
                {isRoomAdmin && !m.isOwner && m.userId !== user?.id && (
                  <View className="flex-row items-center gap-3">
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
                    <Pressable
                      onPress={() =>
                        removeMember(
                          m.userId,
                          m.displayName ?? m.username ?? "this member",
                          true,
                        )
                      }
                      hitSlop={8}
                    >
                      <Ban color={colors.destructive} size={16} />
                    </Pressable>
                  </View>
                )}
              </View>
            ))}
          </CardContent>
        </Card>

        {/* One invite surface — the modal handles share-link + in-app friends. */}
        <Button variant="outline" onPress={() => setShowPullIn(true)}>
          <View className="flex-row items-center gap-2">
            <Share2 color={colors.primary} size={16} />
            <Text className="text-sm font-medium text-primary">
              Invite people
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
                    Leave this room
                  </Text>
                </View>
              </Button>
              <Button variant="destructive" onPress={deleteHuddle}>
                <View className="flex-row items-center gap-2">
                  <Trash2 color={colors.destructiveForeground} size={16} />
                  <Text className="text-sm font-medium text-destructive-foreground">
                    Delete room
                  </Text>
                </View>
              </Button>
            </>
          )}
        </View>
      </ScreenWrapper>

      <OfficialUpgradePaywall
        visible={showPaywall}
        huddleId={huddleId}
        huddleName={huddle.name}
        onClose={() => setShowPaywall(false)}
        onActivated={() => {
          queryClient.invalidateQueries({ queryKey: ["huddle-details", huddleId] });
          queryClient.invalidateQueries({ queryKey: ["user-huddles"] });
        }}
      />

      <PullInFriendsModal
        visible={showPullIn}
        huddleId={huddleId}
        huddleName={huddle.name}
        onClose={() => setShowPullIn(false)}
      />
    </SafeAreaView>
  );
}
