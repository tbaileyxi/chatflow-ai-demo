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
import { SectionLabel, Type } from "@/components/ui/Type";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useHuddleDetails } from "@/hooks/useHuddleDetails";
import { useHuddleMembers } from "@/hooks/useHuddleMembers";
import { OfficialUpgradePaywall } from "@/components/paywall/OfficialUpgradePaywall";
import { OFFICIAL_HUDDLES_ENABLED } from "@/config/features";
import { PullInFriendsModal } from "@/components/huddle/PullInFriendsModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ScreenWrapper } from "@/components/ui/screen-wrapper";
import { blockUser, reportUser } from "@/lib/moderation";
import { colors } from "@/theme/colors";
import { useRoomPhoto } from "@/hooks/useRoomPhoto";
import { backfillIfEmpty } from "@/lib/roomContent";
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
  const roomPhoto = useRoomPhoto(huddleId);
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
        : "Revert this huddle to a regular one? Locks the Official-only features.",
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
    // WAS: gated behind the Official Huddle upgrade, so a regular owner got a
    // paywall or a "coming soon" alert and could never lock their own room.
    // Controlling who is in your room is not a premium feature — it is the
    // baseline for a room being yours. Free for every owner now.
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
    // Same reason as the invite-link join: whoever was just let in shouldn't
    // arrive at a blank room. No-ops if anything has been said in here.
    await backfillIfEmpty(huddleId, huddle.teamId);

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

  /**
   * Tap anyone in the roster.
   *
   * Reporting and blocking used to live only behind a long-press on a message
   * and on the person's profile page. Nobody opens a profile to report
   * somebody — you look at the list of who is in the room and act on the name.
   * That is also where an admin already works, so the two sit together.
   *
   * Open to every member, not just admins: blocking is a personal wall, and
   * needing permission to stop seeing someone would defeat it.
   */
  /**
   * TAPPING A PERSON OPENS THE PERSON.
   *
   * This put up a menu first — View profile / Report / Block — so the common
   * thing (who is this?) sat behind a list whose other two entries almost
   * nobody will ever use. Report and block live on the profile, which is also
   * where you would have gone to decide you wanted them.
   *
   * Long-press still reaches the menu directly, for the case where you know
   * exactly what you want and do not need to look at them first.
   */
  const openMemberProfile = (memberId: string, name: string) => {
    if (memberId === user?.id) {
      navigation.navigate("Profile" as never);
      return;
    }
    (navigation as any).navigate("PublicProfile", { userId: memberId, knownAs: name });
  };

  const openMemberActions = (memberId: string, name: string) => {
    if (memberId === user?.id) {
      navigation.navigate("Profile" as never);
      return;
    }

    Alert.alert(name, undefined, [
      {
        text: "View profile",
        onPress: () =>
          (navigation as any).navigate("PublicProfile", {
            userId: memberId,
            knownAs: name,
          }),
      },
      {
        text: "Report",
        style: "destructive",
        onPress: () => {
          Alert.alert(
            `Report ${name}?`,
            "Two reports hide it automatically, and the huddle owner is told.",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Report",
                style: "destructive",
                onPress: async () => {
                  await reportUser({ userId: memberId });
                  Alert.alert(
                    "Reported",
                    "If somebody else reports them too, it disappears and the owner is told.",
                  );
                },
              },
            ],
          );
        },
      },
      {
        text: `Block ${name}`,
        style: "destructive",
        onPress: () => {
          Alert.alert(
            `Block ${name}?`,
            "You won't see them anywhere in Side Huddle, in any huddle. They aren't told.",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Block",
                style: "destructive",
                onPress: async () => {
                  if (await blockUser(memberId)) {
                    Alert.alert("Blocked", `You won't see ${name} again.`);
                  }
                },
              },
            ],
          );
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
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

  /**
   * The owner leaving used to delete the room and every message in it, with no
   * other option. In a room with eight other people that means one person
   * walking away destroys everybody else's history — and an owner who simply
   * wants out had no way to take it that wasn't destructive.
   *
   * Now it hands over. Ownership goes to whoever has been in the room longest
   * after the owner, which is the closest thing to "the next most invested
   * person" the data actually knows. Deleting is still available, separately,
   * as a deliberate act rather than a side effect of leaving.
   */
  const ownerLeaveHuddle = async () => {
    if (!user) return;

    const { data: heirs } = await supabase
      .from("huddle_members")
      .select("user_id, joined_at")
      .eq("huddle_id", huddleId)
      .neq("user_id", user.id)
      .order("joined_at", { ascending: true })
      .limit(1);

    const heir = heirs?.[0];

    // Last one out really does turn off the lights — there is nobody to hand
    // an empty room to, and keeping it would just be litter.
    if (!heir) {
      Alert.alert(
        "Leave Side Huddle",
        `You're the only one in ${huddle.name}. Leaving deletes it.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Leave & delete",
            style: "destructive",
            onPress: async () => {
              await supabase.from("huddles").delete().eq("id", huddleId);
              queryClient.invalidateQueries({ queryKey: ["user-huddles"] });
              navigation.navigate("MainTabs", { screen: "Home" });
            },
          },
        ],
      );
      return;
    }

    const { data: heirProfile } = await supabase
      .from("profiles")
      .select("display_name, username")
      .eq("user_id", heir.user_id)
      .maybeSingle();

    const heirName =
      heirProfile?.display_name ?? heirProfile?.username ?? "the next member";

    Alert.alert(
      "Leave Side Huddle",
      `${heirName} will take over ${huddle.name}. The room and its messages stay.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Leave & hand over",
          onPress: async () => {
            const { error: handoverError } = await supabase
              .from("huddles")
              .update({ owner_id: heir.user_id })
              .eq("id", huddleId);

            // Don't leave until the handover lands, or the room is orphaned —
            // owned by someone who isn't in it and administrable by nobody.
            if (handoverError) {
              Alert.alert(
                "Couldn't hand over",
                "The huddle still belongs to you. Try again in a moment.",
              );
              return;
            }

            await supabase
              .from("huddle_members")
              .delete()
              .eq("huddle_id", huddleId)
              .eq("user_id", user.id);

            supabase.functions
              .invoke("send-push-notification", {
                body: {
                  user_ids: [heir.user_id],
                  notification_type: "join_request",
                  title: `${huddle.name} is yours now`,
                  body: "The previous owner left and handed it to you.",
                },
              })
              .catch(() => {});

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
    <SafeAreaView
      className="flex-1"
      edges={["top"]}
      style={{ backgroundColor: colors.huddleGround }}
    >
      {/* Header */}
      {/* items-start, not items-center: the title is two lines and a 29pt
          face, so centring the row pushed the chevron down into the name. */}
      <View className="flex-row items-start gap-2 px-4 py-3">
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={10}
          style={{ paddingTop: 4 }}
        >
          <ChevronLeft color={colors.foreground} size={24} />
        </Pressable>
        <View className="flex-1">
          <Type variant="title" numberOfLines={1} style={{ fontSize: 25 }}>
            {huddle.name}
          </Type>
          <Type variant="data" tone="tertiary">
            Huddle settings
          </Type>
        </View>
        {isOwner && (
          <ShieldCheck color={colors.primary} size={22} />
        )}
      </View>

      <ScreenWrapper scroll className="gap-4 pt-2">
        {/* THE ROOM'S PICTURE. Owner or admin only — the storage policy enforces
            the same rule, so a member who gets here sees nothing rather than a
            button that fails. */}
        {isRoomAdmin && (
          <Card>
            <CardContent className="gap-3 pt-4">
              <SectionLabel>Huddle photo</SectionLabel>
              <View className="h-40 w-full overflow-hidden rounded-xl bg-muted">
                {huddle.photoUrl ? (
                  <Image
                    source={{ uri: huddle.photoUrl }}
                    className="h-full w-full"
                    resizeMode="cover"
                  />
                ) : (
                  <View className="h-full w-full items-center justify-center">
                    <Type variant="caption" tone="muted" className="px-8 text-center">
                      Your bar, last year's tailgate, the chapter banner — it sits
                      behind every message in here.
                    </Type>
                  </View>
                )}
              </View>
              <View className="flex-row gap-2">
                <Pressable
                  disabled={roomPhoto.uploading}
                  onPress={async () => {
                    const res = await roomPhoto.pick();
                    if (res.ok)
                      queryClient.invalidateQueries({
                        queryKey: ["huddle-details", huddleId],
                      });
                  }}
                  className="flex-1 items-center rounded-xl bg-primary px-4 py-3"
                >
                  <Type variant="captionStrong" tone="onPrimary">
                    {roomPhoto.uploading
                      ? "Uploading..."
                      : huddle.photoUrl
                        ? "Change photo"
                        : "Add a photo"}
                  </Type>
                </Pressable>
                {huddle.photoUrl && (
                  <Pressable
                    disabled={roomPhoto.uploading}
                    onPress={async () => {
                      if (await roomPhoto.clear())
                        queryClient.invalidateQueries({
                          queryKey: ["huddle-details", huddleId],
                        });
                    }}
                    className="items-center rounded-xl border border-border px-4 py-3"
                  >
                    <Type variant="captionStrong">Remove</Type>
                  </Pressable>
                )}
              </View>
            </CardContent>
          </Card>
        )}

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
                  <Type variant="heading" tone="muted">
                    {huddle.name.charAt(0)}
                  </Type>
                )}
              </View>
              <View className="flex-1">
                <Type variant="title">
                  {huddle.name}
                </Type>
                <Type variant="caption" tone="muted">
                  {huddle.memberCount} member{huddle.memberCount === 1 ? "" : "s"}
                </Type>
              </View>
              {isOfficial ? (
                <View className="rounded-full border border-primary/40 bg-primary/10 px-2 py-1">
                  <Type variant="captionStrong" tone="primary">Official</Type>
                </View>
              ) : null}
            </View>
            {bio ? (
              <Type variant="caption" tone="muted" className="leading-5">
                {bio}
              </Type>
            ) : null}
            {websiteUrl ? (
              <View className="flex-row items-center gap-2">
                <Globe color={colors.mutedForeground} size={14} />
                <Type variant="captionStrong" tone="primary">
                  {websiteUrl}
                </Type>
              </View>
            ) : null}
          </CardContent>
        </Card>

        {/* Official Huddle upgrade — owner only. Hidden for 1.0: the paid
            subscription isn't set up in App Store Connect yet, so no purchase
            can be started. Re-enabled by the OFFICIAL_HUDDLES_ENABLED flag. */}
        {OFFICIAL_HUDDLES_ENABLED && isOwner && !isOfficial && (
          <Card>
            <CardContent className="gap-2 pt-4">
              <View className="flex-row items-center gap-2">
                <ShieldCheck color={colors.primary} size={18} />
                <Type variant="heading">
                  Make this an Official Huddle
                </Type>
              </View>
              <Type variant="caption" tone="muted" className="leading-5">
                Unlocks website link, multiple admins, approval-only membership,
                and discoverability in Search. $29/mo.
              </Type>
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
                <Type variant="captionStrong">
                  Official status: {huddle.officialStatus}
                </Type>
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
              <CardTitle>About this huddle</CardTitle>
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
                <Type variant="caption" tone="muted">
                  {bio.length}/280
                </Type>
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
                  {/* A setting is a STATE the room is in, not an instruction to
                      the person reading it. "Ask to join" told the owner to do
                      something he isn't the one doing — it is the visitor who
                      asks. It stays as the visitor's button on the join screen,
                      where it is the right words for the right person. */}
                  <Type variant="bodyStrong">
                    {huddle.isPrivate ? "Private" : "Open"}
                  </Type>
                  {/* WAS: "Open by Invite", which wasn't true — an open room can
                      be joined by anyone who finds it, invite or not. */}
                  <Type variant="caption" tone="muted" className="leading-5">
                    {huddle.isPrivate
                      ? "You decide who comes in."
                      : "Friends can jump in. Strangers can't find it."}
                  </Type>
                </View>
                <Button variant="outline" size="sm" onPress={togglePrivate}>
                  {huddle.isPrivate ? "Make it open" : "Make it private"}
                </Button>
              </View>

              {huddle.isPrivate && joinRequests.length === 0 ? (
                <Type variant="caption" tone="muted">
                  Nobody's waiting to get in.
                </Type>
              ) : null}

              {huddle.isPrivate && joinRequests.length > 0 ? (
                <View className="gap-2">
                  <SectionLabel>Requests</SectionLabel>
                  {joinRequests.map((request) => (
                    <View
                      key={request.id}
                      className="flex-row items-center gap-3 rounded-xl border border-border bg-muted p-3"
                    >
                      <View className="h-9 w-9 items-center justify-center rounded-full bg-card">
                        <Type variant="captionStrong" tone="muted">
                          {(request.profile?.display_name ?? request.profile?.username ?? "U").charAt(0)}
                        </Type>
                      </View>
                      <Type variant="bodyStrong" className="flex-1">
                        {request.profile?.display_name ?? request.profile?.username ?? "User"}
                      </Type>
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
                        <Type variant="captionStrong" tone="muted">
                          {(admin.profiles?.display_name ?? admin.profiles?.username ?? "A").charAt(0)}
                        </Type>
                      </View>
                      <Type variant="bodyStrong" className="flex-1">
                        {admin.profiles?.display_name ?? admin.profiles?.username ?? "Admin"}
                      </Type>
                    </View>
                  ))}
                </View>
              ) : (
                <Type variant="caption" tone="muted">
                  Add admins to help monitor requests and members.
                </Type>
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
                    <Type variant="bodyStrong" tone="onPrimary">Add</Type>
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
              <Pressable
                key={m.userId}
                onPress={() =>
                  openMemberProfile(
                    m.userId,
                    m.displayName ?? m.username ?? "This member",
                  )
                }
                onLongPress={() =>
                  openMemberActions(
                    m.userId,
                    m.displayName ?? m.username ?? "This member",
                  )
                }
                className="flex-row items-center gap-3 py-1.5 active:opacity-70"
              >
                <View className="h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-muted">
                  {m.avatarUrl ? (
                    <Image
                      source={{ uri: m.avatarUrl }}
                      className="h-full w-full"
                    />
                  ) : (
                    <Type variant="captionStrong" tone="muted">
                      {(m.displayName ?? m.username ?? "U").charAt(0)}
                    </Type>
                  )}
                </View>
                <View className="flex-1">
                  <View className="flex-row items-center gap-1.5">
                    <Type variant="captionStrong">
                      {m.displayName ?? m.username ?? "User"}
                    </Type>
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
              </Pressable>
            ))}
          </CardContent>
        </Card>

        {/* One invite surface — the modal handles share-link + in-app friends. */}
        <Button variant="outline" onPress={() => setShowPullIn(true)}>
          <View className="flex-row items-center gap-2">
            <Share2 color={colors.primary} size={16} />
            <Type variant="captionStrong" tone="primary">
              Invite people
            </Type>
          </View>
        </Button>

        <Separator />

        {/* Actions */}
        <View className="gap-3 pb-8">
          {!isOwner && (
            <Button variant="outline" onPress={leaveHuddle}>
              <View className="flex-row items-center gap-2">
                <LogOut color={colors.foreground} size={16} />
                <Type variant="captionStrong">
                  Leave Side Huddle
                </Type>
              </View>
            </Button>
          )}
          {isOwner && (
            <>
              <Button variant="outline" onPress={ownerLeaveHuddle}>
                <View className="flex-row items-center gap-2">
                  <LogOut color={colors.foreground} size={16} />
                  <Type variant="captionStrong">
                    Leave this room
                  </Type>
                </View>
              </Button>
              <Button variant="destructive" onPress={deleteHuddle}>
                <View className="flex-row items-center gap-2">
                  <Trash2 color={colors.destructiveForeground} size={16} />
                  <Type variant="captionStrong" className="text-destructive-foreground">
                    Delete room
                  </Type>
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
