import { useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useQueryClient } from "@tanstack/react-query";
import { Bot, Radio, Users } from "lucide-react-native";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { FindYourPeople } from "@/components/profile/FindYourPeople";
import { TeamPicker } from "@/components/profile/TeamPicker";
import { colors } from "@/theme/colors";

// Phone is stored ONLY as a match key so people who already have your number
// can find you. Nothing sends to it — there is no outbound SMS in the product.
// Normalise to E.164 so two people who typed the same number different ways
// still match: "(216) 555-0123", "216-555-0123" and "+12165550123" all collapse
// to the same string.
function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  // Anything else is either incomplete or a country we don't format yet —
  // better to store nothing than to store a key that can never match.
  return null;
}

export function OnboardingScreen() {
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const { user } = useAuth();
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

  // Slides, then: name/phone → pick a team → find your people.
  const profileStep = slides.length;
  const teamStep = slides.length + 1;
  const contactsStep = slides.length + 2;
  const onProfileStep = step === profileStep;
  const onTeamStep = step === teamStep;
  const onContactsStep = step === contactsStep;
  const activeSlide =
    onProfileStep || onTeamStep || onContactsStep ? null : slides[step];
  const ActiveIcon = activeSlide?.icon;

  // Save name + phone, then move to contact matching. The phone has to land
  // BEFORE we match so this user is findable by the people they're about to
  // scan for.
  const saveProfileAndContinue = async () => {
    if (!user) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert("Name needed", "Add a name so your friends recognise you.");
      return;
    }

    setSaving(true);
    try {
      const normalizedPhone = normalizePhone(phone);

      const baseUpdates = { display_name: trimmedName };

      let { error } = await supabase
        .from("profiles")
        .update(
          normalizedPhone
            ? { ...baseUpdates, phone_number: normalizedPhone }
            : baseUpdates,
        )
        .eq("user_id", user.id);

      // profiles.phone_number is UNIQUE. If this number is already on another
      // account, save the name anyway rather than trapping them in onboarding —
      // the phone is optional and never worth blocking entry over.
      if (error && normalizedPhone && (error as any).code === "23505") {
        ({ error } = await supabase
          .from("profiles")
          .update(baseUpdates)
          .eq("user_id", user.id));
      }

      if (error) {
        Alert.alert("Error", "Could not save your details. Please try again.");
        return;
      }

      await queryClient.invalidateQueries({ queryKey: ["profile"] });
      setStep(teamStep);
    } finally {
      setSaving(false);
    }
  };

  const enterApp = async () => {
    if (!user) return;

    setSaving(true);
    try {
      await supabase
        .from("profiles")
        .update({ onboarding_completed: true })
        .eq("user_id", user.id);

      await queryClient.invalidateQueries({ queryKey: ["profile"] });
      await queryClient.invalidateQueries({ queryKey: ["known-people"] });
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

  const primaryLabel = saving ? "Saving..." : onProfileStep ? "Continue" : "Next";

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="flex-1 justify-between px-6 pb-8 pt-8">
            <View>
              <Image
                source={require("../../../assets/sh-logo-master.png")}
                style={{ width: 56, height: 56, borderRadius: 14 }}
                resizeMode="cover"
              />

              <View className="mt-14 min-h-[360px] justify-center">
                {onContactsStep ? (
                  <FindYourPeople onDone={enterApp} />
                ) : onTeamStep ? (
                  <TeamPicker
                    onJoined={() => setStep(contactsStep)}
                    onSkip={() => setStep(contactsStep)}
                  />
                ) : onProfileStep ? (
                  <>
                    <Text className="text-4xl font-black leading-tight text-foreground">
                      What should we call you?
                    </Text>

                    <TextInput
                      value={name}
                      onChangeText={setName}
                      placeholder="Your name"
                      placeholderTextColor={colors.mutedForeground}
                      autoCapitalize="words"
                      autoCorrect={false}
                      returnKeyType="next"
                      className="mt-6 rounded-xl border border-border bg-muted px-4 py-3.5 text-lg text-foreground"
                      style={{ color: colors.foreground }}
                    />
                    <Text className="mt-2 text-sm text-muted-foreground">
                      This is what people see in rooms.
                    </Text>

                    <Text className="mt-8 text-xl font-black text-foreground">
                      Phone number
                      <Text className="text-muted-foreground"> (optional)</Text>
                    </Text>

                    <TextInput
                      value={phone}
                      onChangeText={setPhone}
                      placeholder="(216) 555-0123"
                      placeholderTextColor={colors.mutedForeground}
                      keyboardType="phone-pad"
                      returnKeyType="done"
                      className="mt-3 rounded-xl border border-border bg-muted px-4 py-3.5 text-lg text-foreground"
                      style={{ color: colors.foreground }}
                    />
                    <Text className="mt-2 text-sm leading-5 text-muted-foreground">
                      We never text you. Ever. It is only so people who already
                      have your number can find you here.
                    </Text>
                  </>
                ) : (
                  <>
                    <View className="h-16 w-16 items-center justify-center rounded-2xl bg-primary/15">
                      {ActiveIcon ? (
                        <ActiveIcon color={colors.primary} size={30} />
                      ) : null}
                    </View>
                    <Text className="mt-8 text-4xl font-black leading-tight text-foreground">
                      {activeSlide?.title}
                    </Text>
                    <Text className="mt-4 text-xl leading-8 text-muted-foreground">
                      {activeSlide?.body}
                    </Text>
                  </>
                )}

                <View className="mt-10 flex-row gap-2">
                  {[
                    ...slides,
                    { title: "__profile__" },
                    { title: "__team__" },
                    { title: "__contacts__" },
                  ].map((slide, index) => (
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
              {/* Contacts and team steps ship their own buttons, so the shared
                  CTA would be a second, conflicting one. */}
              {onContactsStep || onTeamStep ? null : (
                <Pressable
                  className="rounded-full bg-primary px-5 py-4 active:opacity-80"
                  disabled={saving}
                  onPress={() => {
                    if (step < profileStep) {
                      setStep((value) => value + 1);
                    } else {
                      saveProfileAndContinue();
                    }
                  }}
                >
                  <Text className="text-center text-base font-black text-primary-foreground">
                    {primaryLabel}
                  </Text>
                </Pressable>
              )}
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
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
