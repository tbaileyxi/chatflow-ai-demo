import { useState, useEffect } from "react";
import { View, Text, Image, Alert, Pressable, Keyboard, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import {
  Bell,
  Camera,
  Crown,
  FileText,
  Lock,
  LogOut,
  Shield,
  Megaphone,
  X,
} from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { useAuth } from "@/hooks/useAuth";
import { useInAppNotifications } from "@/hooks/useInAppNotifications";
import { consumeInvite, extractInviteCode } from "@/hooks/useInviteHandler";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { GamePingsToggle } from "@/components/profile/GamePingsToggle";
import { Separator } from "@/components/ui/separator";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ScreenWrapper } from "@/components/ui/screen-wrapper";
import { Badge } from "@/components/ui/badge";
import { colors } from "@/theme/colors";
import { PRIVACY_URL, TERMS_URL } from "@/lib/legal";
import { OFFICIAL_HUDDLES_ENABLED } from "@/config/features";

const BASE64_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function base64ToUint8Array(base64: string) {
  const clean = base64.replace(/=+$/, "");
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;

  for (const char of clean) {
    const value = BASE64_CHARS.indexOf(char);
    if (value < 0) continue;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }

  return new Uint8Array(bytes);
}

export function ProfileScreen() {
  const navigation = useNavigation();
  const {
    user,
    userRole,
    hasAdminAccess,
    signOut,
  } = useAuth();
  const { data: profile, isLoading, updateProfile } = useProfile();
  const {
    notifications,
    unreadCount,
    markRead,
    markAllRead,
    isLoading: notificationsLoading,
  } = useInAppNotifications(8);

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName ?? "");
      setUsername(profile.username ?? "");
      setBio(profile.bio ?? "");
    }
  }, [profile]);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <LoadingSpinner className="flex-1" />
      </SafeAreaView>
    );
  }

  const handleSave = async () => {
    Keyboard.dismiss();
    setSaving(true);
    const trimmedUsername = username.trim();
    const updates: Parameters<typeof updateProfile>[0] = {
      display_name: displayName.trim() || null,
      bio: bio.trim() || null,
    };

    if (trimmedUsername) {
      updates.username = trimmedUsername;
    }

    const { error } = await updateProfile(updates);

    if (error) {
      // Surface the actual error so we can debug the silent save failures
      // users have been hitting.
      const msg =
        error.message?.includes("unique")
          ? "Username is already taken."
          : (error as any).message || (error as any).code || "Failed to save profile.";
      console.warn("[profile] save failed", error);
      Alert.alert("Couldn't save profile", msg);
    } else {
      Alert.alert("Saved", "Profile updated.");
    }
    setSaving(false);
  };

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: signOut,
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "This permanently deletes your account, picks, chips, and profile. This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase.functions.invoke("delete-account");
              if (error) throw error;
              await signOut();
            } catch (e: any) {
              Alert.alert("Couldn't delete account", e?.message || "Please try again.");
            }
          },
        },
      ],
    );
  };

  const handlePickAvatar = async () => {
    if (!user) return;

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== "granted") {
      Alert.alert("Permission needed", "Allow photo access to upload a profile photo.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });

    if (result.canceled || !result.assets[0]) return;

    setUploadingAvatar(true);
    try {
      const asset = result.assets[0];

      // Use the auth session's CURRENT user id (not the React context user) so
      // it matches what RLS sees in auth.uid().  Avoids "new row violates RLS"
      // when the React user object is stale.
      const { data: authData } = await supabase.auth.getUser();
      const authUid = authData?.user?.id;
      if (!authUid) {
        throw new Error("Not signed in. Sign out and back in to upload.");
      }

      const base64 = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: "base64",
      });
      const ext = asset.uri.split(".").pop()?.toLowerCase()?.split("?")[0] ?? "jpg";
      const contentType = ext === "png" ? "image/png" : "image/jpeg";
      const path = `${authUid}/avatar-${Date.now()}.${ext === "png" ? "png" : "jpg"}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, base64ToUint8Array(base64), {
          contentType,
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const { error } = await updateProfile({ avatar_url: data.publicUrl });
      if (error) throw error;
    } catch (error: any) {
      Alert.alert(
        "Avatar upload failed",
        error?.message?.includes("Bucket not found")
          ? "Supabase needs an avatars storage bucket before uploads can work."
          : error?.message ?? "Could not upload the profile photo.",
      );
    } finally {
      setUploadingAvatar(false);
    }
  };

  const initial = (displayName || username || user?.phone || "U")
    .charAt(0)
    .toUpperCase();

  const handleOpenNotification = async (notificationId: string) => {
    const notification = notifications.find((n) => n.id === notificationId);
    if (!notification) return;

    if (!notification.readAt) {
      await markRead(notification.id);
    }

    const data = notification.data;
    const obj =
      data && typeof data === "object" && !Array.isArray(data)
        ? (data as { huddleId?: string; url?: string })
        : null;

    // Room invite: accept it (join + friend-connect) then route in. The invite
    // notification carries a deep-link url and no huddleId, so without this the
    // tap did nothing — the whole "join my huddle" flow was dead.
    const inviteCode = obj?.url ? extractInviteCode(obj.url) : null;
    if (inviteCode) {
      const res = await consumeInvite(inviteCode, navigation as any);
      if (!res.ok) {
        Alert.alert(
          "Couldn't join",
          res.error?.includes("expired")
            ? "That invite has expired — ask for a fresh one."
            : // Surface the real reason so failures are diagnosable in the field
              // instead of a dead-end "didn't work". (e.g. "invite not found".)
              `This invite link didn't work. Ask them to re-send it.\n\n[${res.error ?? "unknown error"}] code: ${inviteCode}`,
        );
      }
      return;
    }

    const huddleId = notification.huddleId ?? obj?.huddleId ?? null;
    if (huddleId) {
      navigation.navigate("Huddle" as any, { huddleId });
      return;
    }

    if (notification.type.includes("kalshi") || notification.type.includes("pick")) {
      navigation.navigate("Ledger" as any);
    }
  };

  const formatNotificationTime = (createdAt: string | null) => {
    if (!createdAt) return "";
    const diffMs = Date.now() - new Date(createdAt).getTime();
    const diffMinutes = Math.max(1, Math.floor(diffMs / 60000));
    if (diffMinutes < 60) return `${diffMinutes}m`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h`;
    return `${Math.floor(diffHours / 24)}d`;
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <ScreenWrapper scroll className="gap-4 pt-2">
        {/* Header */}
        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-bold text-foreground">Profile</Text>
          {hasAdminAccess && (
            <Badge variant="secondary">
              {userRole === "admin" ? "Admin" : "Content Admin"}
            </Badge>
          )}
        </View>

        {/* Avatar */}
        <View className="items-center gap-2 py-4">
          <Pressable
            className="h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-muted active:opacity-80"
            onPress={handlePickAvatar}
            disabled={uploadingAvatar}
          >
            {profile?.avatarUrl ? (
              <Image
                source={{ uri: profile.avatarUrl }}
                className="h-full w-full"
                resizeMode="cover"
              />
            ) : (
              <Text className="text-3xl font-bold text-muted-foreground">
                {initial}
              </Text>
            )}
            <View className="absolute bottom-0 right-0 h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-primary">
              <Camera color={colors.primaryForeground} size={16} />
            </View>
          </Pressable>
          <Text className="text-xs font-semibold text-primary">
            {uploadingAvatar ? "Uploading..." : "Tap photo to upload"}
          </Text>
          <Text className="text-sm text-muted-foreground">
            {user?.phone ?? user?.email ?? ""}
          </Text>
        </View>

        {OFFICIAL_HUDDLES_ENABLED && (
          <Card className="border-primary/25 bg-primary/5">
            <CardContent className="gap-3 pt-4">
              <View className="flex-row items-center gap-2">
                <Crown color={colors.primary} size={18} />
                <Text className="text-base font-bold text-foreground">
                  Official Huddles
                </Text>
                <Badge variant="outline" className="ml-auto">
                  $29/mo
                </Badge>
              </View>
              <Text className="text-sm leading-5 text-muted-foreground">
                Verified badge, team-page listing, multiple admins, approval
                membership, and an about page with links.
              </Text>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="gap-3 pt-4">
            <View className="flex-row items-center gap-2">
              <Bell color={colors.primary} size={18} />
              <Text className="text-base font-bold text-foreground">
                Notifications Center
              </Text>
              {unreadCount > 0 && (
                <Badge variant="secondary" className="ml-auto">
                  {`${unreadCount} unread`}
                </Badge>
              )}
            </View>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="self-start px-0"
                onPress={() => markAllRead()}
              >
                Mark all read
              </Button>
            )}
            {notificationsLoading ? (
              <Text className="text-sm text-muted-foreground">
                Loading alerts...
              </Text>
            ) : notifications.length === 0 ? (
              <Text className="text-sm leading-5 text-muted-foreground">
                Friend check-ins, game alerts, bot drops, invites, and pick results will collect here.
              </Text>
            ) : (
              <View className="gap-2">
                {notifications.map((notification) => {
                  const d = notification.data;
                  const isInvite =
                    notification.type === "room_invite" ||
                    (!!d &&
                      typeof d === "object" &&
                      !Array.isArray(d) &&
                      typeof (d as { url?: string }).url === "string");
                  return (
                    <Pressable
                      key={notification.id}
                      className={`rounded-xl border p-3 active:opacity-80 ${
                        notification.readAt
                          ? "border-border bg-muted/20"
                          : "border-primary/35 bg-primary/10"
                      }`}
                      onPress={() => handleOpenNotification(notification.id)}
                    >
                      <View className="flex-row items-start gap-2">
                        {!notification.readAt && (
                          <View className="mt-2 h-2 w-2 rounded-full bg-primary" />
                        )}
                        <View className="flex-1">
                          <View className="flex-row items-start justify-between gap-2">
                            <Text className="flex-1 text-sm font-bold text-foreground">
                              {notification.title}
                            </Text>
                            <Text className="text-xs font-semibold text-muted-foreground">
                              {formatNotificationTime(notification.createdAt)}
                            </Text>
                          </View>
                          <Text className="mt-1 text-sm leading-5 text-muted-foreground">
                            {notification.body}
                          </Text>

                          {/* Pending invite: explicit Join + Dismiss so it's
                              obvious how to act (not a guess-the-tap). */}
                          {isInvite && !notification.readAt && (
                            <View className="mt-2.5 flex-row items-center gap-2">
                              <Pressable
                                onPress={() => handleOpenNotification(notification.id)}
                                className="flex-1 items-center rounded-lg bg-primary py-2 active:opacity-80"
                              >
                                <Text
                                  className="text-sm font-bold"
                                  style={{ color: colors.primaryForeground }}
                                >
                                  Join huddle
                                </Text>
                              </Pressable>
                              <Pressable
                                onPress={() => markRead(notification.id)}
                                className="h-9 w-9 items-center justify-center rounded-lg border border-border active:opacity-70"
                                hitSlop={8}
                              >
                                <X color={colors.mutedForeground} size={16} />
                              </Pressable>
                            </View>
                          )}
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </CardContent>
        </Card>

        {/* Profile Fields */}
        <Card>
          <CardHeader>
            <CardTitle>Edit Profile</CardTitle>
          </CardHeader>
          <CardContent className="gap-4">
            <Input
              label="Display Name"
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Your name"
              returnKeyType="next"
            />
            <Input
              label="Username"
              value={username}
              onChangeText={(t) => setUsername(t.toLowerCase().replace(/\s/g, ""))}
              placeholder="username"
              autoCapitalize="none"
              returnKeyType="next"
            />
            <Textarea
              label="Bio"
              value={bio}
              onChangeText={(t) => setBio(t.slice(0, 280))}
              placeholder="Tell us about yourself..."
              maxLength={280}
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
            />
            <View className="flex-row items-center justify-between">
              <Text className="text-xs text-muted-foreground">
                {bio.length}/280
              </Text>
              <Button size="sm" onPress={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </View>
          </CardContent>
        </Card>

        <Separator />

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
          </CardHeader>
          <CardContent>
            <GamePingsToggle />
          </CardContent>
        </Card>

        {/* Account */}
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
          </CardHeader>
          <CardContent className="gap-3">
            {/* The ONLY route to team management now that the Teams tab is
                gone. ManageTeams was reachable exclusively from TeamsScreen,
                so removing that tab without this would have stranded following
                and unfollowing teams entirely. */}
            <Button
              variant="outline"
              onPress={() => navigation.navigate("ManageTeams" as any)}
            >
              <View className="flex-row items-center gap-2">
                <Shield color={colors.primary} size={16} />
                <Text className="text-sm font-medium text-foreground">
                  My Teams
                </Text>
              </View>
            </Button>
            {hasAdminAccess && (
              <Button
                variant="outline"
                onPress={() => navigation.navigate("Admin")}
              >
                <View className="flex-row items-center gap-2">
                  <Shield color={colors.primary} size={16} />
                  <Text className="text-sm font-medium text-foreground">
                    Admin Panel
                  </Text>
                </View>
              </Button>
            )}
            <Button
              variant="outline"
              onPress={() =>
                Linking.openURL("https://www.sidehuddlesports.com/sponsors").catch(
                  () => {},
                )
              }
            >
              <View className="flex-row items-center gap-2">
                <Megaphone color={colors.primary} size={16} />
                <Text className="text-sm font-medium text-foreground">
                  Sponsor a team
                </Text>
              </View>
            </Button>
            <Button
              variant="outline"
              onPress={() => Linking.openURL(TERMS_URL).catch(() => {})}
            >
              <View className="flex-row items-center gap-2">
                <FileText color={colors.primary} size={16} />
                <Text className="text-sm font-medium text-foreground">
                  Terms of Use (EULA)
                </Text>
              </View>
            </Button>
            <Button
              variant="outline"
              onPress={() => Linking.openURL(PRIVACY_URL).catch(() => {})}
            >
              <View className="flex-row items-center gap-2">
                <Lock color={colors.primary} size={16} />
                <Text className="text-sm font-medium text-foreground">
                  Privacy Policy
                </Text>
              </View>
            </Button>
            <Button variant="destructive" onPress={handleSignOut}>
              <View className="flex-row items-center gap-2">
                <LogOut color={colors.destructiveForeground} size={16} />
                <Text className="text-sm font-medium text-destructive-foreground">
                  Sign Out
                </Text>
              </View>
            </Button>
            <Button variant="ghost" onPress={handleDeleteAccount}>
              <View className="flex-row items-center gap-2">
                <X color={colors.destructive} size={16} />
                <Text className="text-sm font-medium text-destructive">
                  Delete Account
                </Text>
              </View>
            </Button>
          </CardContent>
        </Card>

        <View className="h-8" />
      </ScreenWrapper>
    </SafeAreaView>
  );
}
