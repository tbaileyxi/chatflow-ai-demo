import { useState, useEffect } from "react";
import { View, Text, Pressable, Alert, Switch } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRoute, useNavigation, type RouteProp } from "@react-navigation/native";
import { ChevronLeft, Bot, Info } from "lucide-react-native";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ScreenWrapper } from "@/components/ui/screen-wrapper";
import { cn } from "@/lib/utils";
import { colors } from "@/theme/colors";
import type { RootStackParamList } from "@/navigation/types";

type Route = RouteProp<RootStackParamList, "HuddleCoachSettings">;

const PERSONALITIES = [
  { value: "hype", label: "Hype", emoji: "🔥", desc: "Energetic and passionate" },
  { value: "analytical", label: "Analytical", emoji: "📊", desc: "Strategic and data-driven" },
  { value: "casual", label: "Casual", emoji: "😎", desc: "Laid-back and friendly" },
] as const;

export function HuddleCoachSettingsScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation();
  const { user } = useAuth();
  const { huddleId } = route.params;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [personality, setPersonality] = useState("hype");

  useEffect(() => {
    loadSettings();
  }, [huddleId]);

  const loadSettings = async () => {
    const { data } = await supabase
      .from("huddle_chatbot_settings")
      .select("is_enabled, personality")
      .eq("huddle_id", huddleId)
      .maybeSingle();

    if (data) {
      setIsEnabled(data.is_enabled);
      setPersonality(data.personality ?? "hype");
    }
    setLoading(false);
  };

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("huddle_chatbot_settings").upsert({
      huddle_id: huddleId,
      is_enabled: isEnabled,
      personality,
    });

    if (error) {
      Alert.alert("Error", "Failed to save settings.");
    } else {
      Alert.alert("Saved", "Coach settings updated.");
    }
    setSaving(false);
  };

  const testCoach = async () => {
    if (!user) return;
    await supabase.from("huddle_messages").insert({
      huddle_id: huddleId,
      user_id: user.id,
      content: "@coach test - what's happening with the team?",
    });
    Alert.alert("Sent", "Test message sent to the Side Huddle.");
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <LoadingSpinner className="flex-1" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center gap-3 px-4 py-3">
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <ChevronLeft color={colors.foreground} size={24} />
        </Pressable>
        <Bot color={colors.secondary} size={22} />
        <Text className="flex-1 text-lg font-bold text-foreground">
          Coach Settings
        </Text>
      </View>

      <ScreenWrapper scroll className="gap-4 pt-2">
        {/* Enable toggle */}
        <Card>
          <CardHeader>
            <CardTitle>Coach Chatbot</CardTitle>
            <CardDescription>
              AI-powered coach that answers questions in your Side Huddle
            </CardDescription>
          </CardHeader>
          <CardContent>
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <View
                  className={cn(
                    "h-2.5 w-2.5 rounded-full",
                    isEnabled ? "bg-success" : "bg-muted-foreground",
                  )}
                />
                <Text className="text-sm font-medium text-foreground">
                  {isEnabled ? "Enabled" : "Disabled"}
                </Text>
              </View>
              <Switch
                value={isEnabled}
                onValueChange={setIsEnabled}
                trackColor={{
                  false: colors.muted,
                  true: colors.primary,
                }}
                thumbColor={colors.foreground}
              />
            </View>
          </CardContent>
        </Card>

        {/* Personality */}
        <Card>
          <CardHeader>
            <CardTitle>Personality</CardTitle>
          </CardHeader>
          <CardContent className="gap-2">
            {PERSONALITIES.map((p) => (
              <Pressable
                key={p.value}
                className={cn(
                  "flex-row items-center gap-3 rounded-lg border p-3",
                  personality === p.value
                    ? "border-primary bg-primary/10"
                    : "border-border",
                )}
                onPress={() => setPersonality(p.value)}
              >
                <Text className="text-xl">{p.emoji}</Text>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-foreground">
                    {p.label}
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    {p.desc}
                  </Text>
                </View>
              </Pressable>
            ))}
          </CardContent>
        </Card>

        {/* Usage hint */}
        <View className="flex-row items-start gap-2 rounded-lg border border-border bg-muted/50 p-3">
          <Info color={colors.mutedForeground} size={16} />
          <View className="flex-1">
            <Text className="text-sm text-muted-foreground">
              Members can use <Text className="font-semibold text-secondary">@coach</Text> followed by a question in the chat.
            </Text>
          </View>
        </View>

        {/* Actions */}
        <View className="gap-3 pb-8">
          <Button
            variant="outline"
            onPress={testCoach}
            disabled={!isEnabled}
          >
            Test Coach
          </Button>
          <Button onPress={save} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </View>
      </ScreenWrapper>
    </SafeAreaView>
  );
}
