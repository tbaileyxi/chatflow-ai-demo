// "Have a code?" — where a chapter president turns an email into his own room.
//
// This exists because Apple does not carry a URL through an App Store install.
// Tap the link in the email, install, open, and Linking.getInitialURL() returns
// null — the token is gone at precisely the moment it mattered, since the whole
// reason for emailing a president is that he does not have the app. A typed code
// survives that. It is one extra screen and it is the difference between the
// outreach working and silently leaking every person who installs.
//
// Deliberately optional and quiet: almost nobody signing up has a code, and the
// field should not read like something you are failing to have.

import { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, Alert } from "react-native";
import { supabase } from "@/integrations/supabase/client";
import { colors } from "@/theme/colors";

export function ClaimRoomBox({
  onClaimed,
}: {
  /** Called with the room the code opened, so the caller can go straight there. */
  onClaimed: (huddleId: string, huddleName: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const clean = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (clean.length < 4) {
      Alert.alert("Check the code", "It's six characters, from the email we sent you.");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await (supabase.rpc as any)("claim_chapter_huddle", {
        p_code: clean,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row?.huddle_id) throw new Error("That code didn't open anything.");
      onClaimed(row.huddle_id, row.huddle_name ?? "your room");
    } catch (e: any) {
      // The database raises these in plain English on purpose — an unknown code,
      // or a team we haven't set up yet — so show what it said rather than a
      // generic failure.
      Alert.alert("Couldn't claim that", e?.message ?? "Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <Pressable onPress={() => setOpen(true)} hitSlop={8} className="mt-6 items-center">
        <Text className="text-sm font-semibold text-muted-foreground underline">
          Have a code?
        </Text>
      </Pressable>
    );
  }

  return (
    <View className="mt-6 gap-3 rounded-2xl border border-border p-4">
      <Text className="text-sm font-bold text-foreground">
        Enter your code
      </Text>
      <Text className="text-xs leading-4 text-muted-foreground">
        If we emailed you about your chapter, the code is in that email. It sets up
        your room and makes you the owner.
      </Text>
      <TextInput
        value={code}
        onChangeText={setCode}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={8}
        placeholder="ABC123"
        placeholderTextColor={colors.mutedForeground}
        className="rounded-xl border border-border px-4 py-3 text-lg font-black tracking-[4px] text-foreground"
      />
      <Pressable
        disabled={busy}
        onPress={submit}
        className={`items-center rounded-xl px-4 py-3 ${busy ? "bg-muted" : "bg-primary"}`}
      >
        {busy ? (
          <ActivityIndicator color={colors.primaryForeground} />
        ) : (
          <Text className="text-sm font-black text-primary-foreground">
            Claim my room
          </Text>
        )}
      </Pressable>
    </View>
  );
}
