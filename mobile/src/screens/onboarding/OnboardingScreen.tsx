import { useEffect, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useQueryClient } from "@tanstack/react-query";

import { Type } from "@/components/ui/Type";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { FindYourPeople } from "@/components/profile/FindYourPeople";
import { ClaimRoomBox } from "@/components/onboarding/ClaimRoomBox";
import { TeamPicker } from "@/components/profile/TeamPicker";
import { peekPendingInvite } from "@/hooks/useInviteHandler";
import { PRIVACY_URL, TOS_URL } from "@/lib/legal";
import { RippleGlyph } from "@/components/brand/RippleGlyph";
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
  // Supabase puts the verified number on the auth user for SMS sign-ins, and
  // leaves it empty for email ones. That is the only honest way to know which
  // door somebody came through.
  const signedInByPhone = !!user?.phone;
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();

  const slides = [
    {
      title: "See friends watching.",
      body: "Friends Now shows who is already in a room so you can jump in fast.",
    },
    {
      title: "Start a room.",
      body: "Pick a team or event, invite people, and the room stays hidden from strangers.",
    },
  ];

  // Someone a friend invited is not a cold visitor and shouldn't be treated
  // like one. They arrived because a specific person wanted them in a specific
  // room, and every screen between the tap and that room is a chance to lose
  // them — so an invited user gets ONE question, their name, and then goes
  // straight in. Teams and contacts can be asked for later, from inside a room
  // with people in it, which is a far better place to ask from.
  //
  // Peeked, not taken: RootNavigator still redeems the code once
  // onboarding_completed flips.
  const [invited, setInvited] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const code = await peekPendingInvite();
      if (cancelled || !code) return;
      setInvited(true);
      // Skip the marketing slides — they came for a room, not a pitch.
      setStep(slides.length);
    })();
    return () => {
      cancelled = true;
    };
    // slides.length is a constant; this runs once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Slides, then: name/phone → pick a team → find your people.
  const profileStep = slides.length;
  const teamStep = slides.length + 1;
  const contactsStep = slides.length + 2;
  const onProfileStep = step === profileStep;
  const onTeamStep = step === teamStep;
  const onContactsStep = step === contactsStep;
  const activeSlide =
    onProfileStep || onTeamStep || onContactsStep ? null : slides[step];

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

      // Invited: that was the only question. Finishing here flips
      // onboarding_completed, which is what lets RootNavigator redeem the
      // pending code and drop them into the room they were sent to.
      if (invited) {
        await enterApp();
        return;
      }

      setStep(teamStep);
    } finally {
      setSaving(false);
    }
  };

  // Set when a code was redeemed during onboarding, so the last step can drop
  // them into their own room rather than the generic home tab.
  const claimedRoom = useRef<{ huddleId: string; huddleName: string } | null>(null);

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
      const claimed = claimedRoom.current;
      navigation.reset({
        index: 0,
        routes: claimed
          ? [
              { name: "MainTabs" },
              // The route takes huddleId only (see navigation/types.ts); the
              // screen reads the name from useHuddleDetails.
              { name: "Huddle", params: { huddleId: claimed.huddleId } },
            ]
          : [{ name: "MainTabs" }],
      });
    } finally {
      setSaving(false);
    }
  };

  const primaryLabel = saving
    ? "Saving..."
    : onProfileStep
      ? invited
        ? "Take me in"
        : "Continue"
      : "Next";

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
              {/* The mark, drawn. This was a 56px raster crop of the App
                  Store icon — a white rounded square on a black screen, which
                  is what that icon looks like outside the plate iOS draws it
                  in. Same shape as the opening screen and the favicon. */}
              <RippleGlyph size={44} />

              <View className="mt-14 min-h-[360px] justify-center">
                {onContactsStep ? (
                  <FindYourPeople onDone={enterApp} />
                ) : onTeamStep ? (
                  <>
                    {/* No skip. This no longer joins anything — it records
                        which teams you follow, and rooms get made later from a
                        game or an invite where there are actually people. But
                        it still can't be skipped: follows are what decide which
                        games surface, which rooms find you, and which team's
                        voice talks in a room you make. Skip it and the app has
                        nothing to work with. (59 of the first 72 accounts
                        skipped the old version and landed with no room and
                        nobody in it.) */}
                    <TeamPicker onDone={() => setStep(contactsStep)} />
                    {/* A president with a code does not want the generic team
                        room — he wants his chapter's, which does not exist until
                        he claims it. Sits under the team picker because that is
                        the step where "which room am I in" is being decided, and
                        stays collapsed because almost nobody has a code. */}
                    <ClaimRoomBox
                      onClaimed={(huddleId, huddleName) => {
                        claimedRoom.current = { huddleId, huddleName };
                        setStep(contactsStep);
                      }}
                    />
                  </>
                ) : onProfileStep ? (
                  <>
                    <Type variant="display">
                      What should we call you?
                    </Type>
                    {/* Invited people are one tap from a room full of people
                        who already know them. Saying so makes this read as
                        walking through a door rather than filling in a form. */}
                    {invited ? (
                      <Type variant="heading" tone="muted" className="mt-3">
                        Last thing — this is the name on every message you send.
                        Then you're in.
                      </Type>
                    ) : null}

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
                    <Type variant="caption" tone="muted" className="mt-2">
                      This is what people see in rooms.
                    </Type>

                    {/* Only for people who signed in with an email.
                        Sign-in is by SMS code now, so anybody who arrived that
                        way already gave us this number a screen ago — asking
                        again reads as the app not paying attention. And the old
                        copy said "We never text you. Ever." directly underneath
                        a flow whose entire first step is texting you a code. */}
                    {!signedInByPhone ? (
                      <>
                        <Type variant="title" className="mt-8">
                          Phone number
                          <Type variant="body" tone="muted"> (optional)</Type>
                        </Type>

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
                        <Type variant="caption" tone="muted" className="mt-2">
                          Only so people who already have your number can find
                          you here. We won't text you anything but a sign-in
                          code.
                        </Type>
                      </>
                    ) : null}
                  </>
                ) : (
                  <>
                    {/* The icon tile is gone. A generic glyph in a rounded
                        square is the house style of every onboarding deck ever
                        shipped, and it said nothing this screen doesn't say in
                        words. The eyebrow does the work instead: it numbers
                        the step, in the same mono that labels every section in
                        the app. */}
                    <Type variant="eyebrow" tone="primary">
                      {`Step ${step + 1} of ${slides.length}`}
                    </Type>
                    <Type variant="display" className="mt-4">
                      {activeSlide?.title}
                    </Type>
                    <Type variant="title" tone="muted" className="mt-4">
                      {activeSlide?.body}
                    </Type>
                  </>
                )}

                {/* Hidden for invited users: they have exactly one step, and
                    five dots with the third lit would say "you're 3 of 5" to
                    someone who is actually one tap from done. */}
                <View
                  className="mt-10 flex-row gap-2"
                  style={invited ? { opacity: 0 } : undefined}
                  pointerEvents="none"
                >
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
                  <Type center variant="heading" tone="onPrimary">
                    {primaryLabel}
                  </Type>
                </Pressable>
              )}

              {/* App Store guideline 1.2 wants the terms AGREED to, not merely
                  available somewhere — a reviewer walks the signup looking for
                  exactly this line. It sits on the name step because that is
                  the moment an account actually comes into existence.

                  The zero-tolerance clause it points at is the other half, and
                  it has to be live at /terms before submitting. See
                  APP_STORE_UGC.md. */}
              {onProfileStep ? (
                <Type center variant="data" tone="muted" className="px-2">
                  By continuing you agree to the{" "}
                  <Type variant="bodyStrong" tone="primary"
                    
                    onPress={() =>
                      Linking.openURL(TOS_URL)
                    }
                  >
                    Terms
                  </Type>{" "}
                  and{" "}
                  <Type variant="bodyStrong" tone="primary"
                    
                    onPress={() =>
                      Linking.openURL(PRIVACY_URL)
                    }
                  >
                    Privacy Policy
                  </Type>
                  . Side Huddle has zero tolerance for objectionable content.
                </Type>
              ) : null}
              {/* Not for invited users. They start at the name step, so Back
                  would rewind them into the marketing slides they were
                  deliberately skipped past — offering to show someone a pitch
                  for a product they've already decided to join. */}
              {step > 0 && !invited ? (
                <Pressable
                  className="rounded-full px-5 py-3 active:opacity-80"
                  disabled={saving}
                  onPress={() => setStep((value) => Math.max(0, value - 1))}
                >
                  <Type center variant="captionStrong" tone="muted">
                    Back
                  </Type>
                </Pressable>
              ) : null}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
