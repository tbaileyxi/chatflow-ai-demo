import { useState } from "react";
import { Alert, Image, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useQueryClient } from "@tanstack/react-query";
import { Bot, Radio, Users } from "lucide-react-native";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { colors } from "@/theme/colors";

export function OnboardingScreen() {
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(0);
  const { user, completeDevOnboarding } = useAuth();
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const slides = [
    {
      icon: Users,
      title: "See friends watching.",
      body: "Friends Now shows who is already in a room so you can jump in fast.",
    },
    {
      icon: Radio,
      title: "Start a room.",
      body: "Pick a team or event, invite people, and the room stays hidden from strangers.",
    },
    {
      icon: Bot,
      title: "Follow teams when you want.",
      body: "Teams is your feed for scores, news, and prediction markets.",
    },
  ];
  const activeSlide = slides[step];
  const ActiveIcon = activeSlide.icon;

  const enterApp = async () => {
    if (!user) return;

    setSaving(true);
    try {
      if (user.app_metadata?.provider === "dev_test") {
        await completeDevOnboarding();
      } else {
        const { error } = await supabase
          .from("profiles")
          .update({ onboarding_completed: true })
          .eq("user_id", user.id);

        if (error) {
          Alert.alert("Error", "Could not finish setup. Please try again.");
          return;
        }
      }

      await queryClient.invalidateQueries({ queryKey: ["profile"] });
      await queryClient.invalidateQueries({ queryKey: ["user-huddles"] });
      await queryClient.invalidateQueries({ queryKey: ["super-huddle-feed"] });
      navigation.reset({
        index: 0,
        routes: [{ name: "MainTabs" }],
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 justify-between px-6 pb-8 pt-8">
        <View>
          <Image
            source={require("../../../assets/sh-logo-master.png")}
            style={{ width: 56, height: 56, borderRadius: 14 }}
            resizeMode="cover"
          />

          <View className="mt-14 min-h-[360px] justify-center">
            <View className="h-16 w-16 items-center justify-center rounded-2xl bg-primary/15">
              <ActiveIcon color={colors.primary} size={30} />
            </View>
            <Text className="mt-8 text-4xl font-black leading-tight text-foreground">
              {activeSlide.title}
            </Text>
            <Text className="mt-4 text-xl leading-8 text-muted-foreground">
              {activeSlide.body}
            </Text>

            <View className="mt-10 flex-row gap-2">
              {slides.map((slide, index) => (
                <View
                  key={slide.title}
                  className={
                    index === step
                      ? "h-2.5 w-8 rounded-full bg-primary"
                      : "h-2.5 w-2.5 rounded-full bg-muted"
                  }
                />
              ))}
            </View>
          </View>
        </View>

        <View className="gap-3">
          <Pressable
            className="rounded-full bg-primary px-5 py-4 active:opacity-80"
            disabled={saving}
            onPress={() => {
              if (step < slides.length - 1) {
                setStep((value) => value + 1);
              } else {
                enterApp();
              }
            }}
          >
            <Text className="text-center text-base font-black text-primary-foreground">
              {saving ? "Opening..." : step < slides.length - 1 ? "Next" : "Go"}
            </Text>
          </Pressable>
          {step > 0 ? (
            <Pressable
              className="rounded-full px-5 py-3 active:opacity-80"
              disabled={saving}
              onPress={() => setStep((value) => Math.max(0, value - 1))}
            >
              <Text className="text-center text-sm font-black text-muted-foreground">
                Back
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </SafeAreaView>
  );
}
