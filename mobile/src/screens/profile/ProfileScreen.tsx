import { useState, useEffect } from "react";
import { View, Text, Image, Alert, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { LogOut, Camera, Shield } from "lucide-react-native";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ScreenWrapper } from "@/components/ui/screen-wrapper";
import { Badge } from "@/components/ui/badge";
import { colors } from "@/theme/colors";

export function ProfileScreen() {
  const navigation = useNavigation();
  const { user, userRole, hasAdminAccess, signOut } = useAuth();
  const { data: profile, isLoading, updateProfile } = useProfile();

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);

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
    setSaving(true);
    const { error } = await updateProfile({
      display_name: displayName.trim(),
      username: username.trim(),
      bio: bio.trim(),
    });

    if (error) {
      Alert.alert(
        "Error",
        error.message?.includes("unique")
          ? "Username is already taken."
          : "Failed to save profile.",
      );
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

  const initial = (displayName || username || user?.phone || "U")
    .charAt(0)
    .toUpperCase();

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
          <View className="h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-muted">
            {profile?.avatarUrl ? (
              <Image
                source={{ uri: profile.avatarUrl }}
                className="h-full w-full"
              />
            ) : (
              <Text className="text-3xl font-bold text-muted-foreground">
                {initial}
              </Text>
            )}
          </View>
          <Text className="text-sm text-muted-foreground">
            {user?.phone ?? user?.email ?? ""}
          </Text>
        </View>

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
            />
            <Input
              label="Username"
              value={username}
              onChangeText={(t) => setUsername(t.toLowerCase().replace(/\s/g, ""))}
              placeholder="username"
              autoCapitalize="none"
            />
            <Textarea
              label="Bio"
              value={bio}
              onChangeText={(t) => setBio(t.slice(0, 280))}
              placeholder="Tell us about yourself..."
              maxLength={280}
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

        {/* Account */}
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
          </CardHeader>
          <CardContent className="gap-3">
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
            <Button variant="destructive" onPress={handleSignOut}>
              <View className="flex-row items-center gap-2">
                <LogOut color={colors.destructiveForeground} size={16} />
                <Text className="text-sm font-medium text-destructive-foreground">
                  Sign Out
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
