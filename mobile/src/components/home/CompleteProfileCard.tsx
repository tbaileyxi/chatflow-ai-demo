// One-time nudge for people who signed up before onboarding asked for a name.
//
// handle_new_user defaults display_name to the literal string 'User' and the
// old auth flow never collected a name or a phone, so every account created
// before this build is called "User" with no match key. Those people already
// have onboarding_completed = true, so the new onboarding screen will never run
// for them — without this card they stay anonymous forever, unfindable by
// contact matching and unrecognisable in anyone's roster.
//
// Shows until a real name is set. The phone stays optional and can be skipped
// for good.

import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { UserCircle, X } from "lucide-react-native";
import { Type } from "@/components/ui/Type";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { normalizePhone } from "@/lib/contactMatch";
import { colors } from "@/theme/colors";

// 'User' is the trigger default, not something anyone typed.
function needsName(displayName: string | null | undefined): boolean {
  const n = (displayName ?? "").trim();
  return n === "" || n.toLowerCase() === "user";
}

export function CompleteProfileCard() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  const missingName = needsName(profile?.displayName);
  const missingPhone = !profile?.phoneNumber;

  if (!profile || (!missingName && !missingPhone)) return null;

  const save = async () => {
    if (!user) return;
    const trimmed = name.trim();
    if (missingName && !trimmed) {
      Alert.alert("Name needed", "Add a name so your friends recognise you.");
      return;
    }

    setSaving(true);
    try {
      const normalizedPhone = normalizePhone(phone);
      const updates: Record<string, unknown> = {};
      if (trimmed) updates.display_name = trimmed;
      if (normalizedPhone) updates.phone_number = normalizedPhone;

      if (Object.keys(updates).length === 0) {
        setOpen(false);
        return;
      }

      let { error } = await (supabase as any)
        .from("profiles")
        .update(updates)
        .eq("user_id", user.id);

      // phone_number is UNIQUE — if it belongs to another account, keep the
      // name rather than losing the whole edit.
      if (error && normalizedPhone && (error as any).code === "23505") {
        delete updates.phone_number;
        if (Object.keys(updates).length > 0) {
          ({ error } = await (supabase as any)
            .from("profiles")
            .update(updates)
            .eq("user_id", user.id));
        } else {
          error = null;
        }
      }

      if (error) {
        Alert.alert("Couldn't save", "Please try again.");
        return;
      }

      await queryClient.invalidateQueries({ queryKey: ["profile"] });
      await queryClient.invalidateQueries({ queryKey: ["known-people"] });
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Pressable
        onPress={() => {
          setName(missingName ? "" : (profile.displayName ?? ""));
          setOpen(true);
        }}
        className="mx-4 mb-4 flex-row items-center gap-3 rounded-2xl border border-primary/40 bg-primary/10 p-4 active:opacity-80"
      >
        <UserCircle color={colors.primary} size={22} />
        <View className="flex-1">
          <Type variant="heading">
            {missingName ? "Add your name" : "Add your number"}
          </Type>
          <Type variant="caption" tone="muted" className="mt-0.5 leading-5">
            {missingName
              ? "You're showing up as \"User\" to everyone. Takes a second."
              : "So people who have your number can find you here. We never text you."}
          </Type>
        </View>
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <View className="flex-1 justify-end bg-black/60">
          <View className="rounded-t-3xl border-t border-border bg-background px-5 pb-10 pt-4">
            <View className="mb-4 flex-row items-center">
              <View className="flex-1 items-center">
                <View className="h-1.5 w-12 rounded-full bg-muted" />
              </View>
              <Pressable onPress={() => setOpen(false)} hitSlop={8}>
                <X color={colors.mutedForeground} size={22} />
              </Pressable>
            </View>

            {missingName ? (
              <>
                <Type variant="title">
                  What should we call you?
                </Type>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Your name"
                  placeholderTextColor={colors.mutedForeground}
                  autoCapitalize="words"
                  autoCorrect={false}
                  className="mt-4 rounded-xl border border-border bg-muted px-4 py-3.5 text-lg text-foreground"
                  style={{ color: colors.foreground }}
                />
                <Type variant="caption" tone="muted" className="mt-2">
                  This is what people see in rooms.
                </Type>
              </>
            ) : null}

            <Text
              className={`${missingName ? "mt-7" : ""} text-xl font-black text-foreground`}
            >
              Phone number
              <Type variant="body" tone="muted"> (optional)</Type>
            </Text>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="(216) 555-0123"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="phone-pad"
              className="mt-3 rounded-xl border border-border bg-muted px-4 py-3.5 text-lg text-foreground"
              style={{ color: colors.foreground }}
            />
            <Type variant="caption" tone="muted" className="mt-2 leading-5">
              We never text you. Ever. It is only so people who already have
              your number can find you here.
            </Type>

            <Pressable
              onPress={save}
              disabled={saving}
              className="mt-7 rounded-full bg-primary px-5 py-4 active:opacity-80"
            >
              {saving ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <Type variant="heading" tone="onPrimary" className="text-center">
                  Save
                </Type>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}
