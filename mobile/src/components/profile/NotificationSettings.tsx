// One list for every notification the app can send you.
//
// Storage is split across two tables for rollout-safety reasons (game pings
// live on profiles because the shipped app already writes them there; the rest
// live on notification_preferences). That split is deliberate and invisible —
// as far as anyone using this screen is concerned it is one set of switches.

import { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Pressable, Switch, Text, View } from "react-native";
import { Type } from "@/components/ui/Type";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { colors } from "@/theme/colors";

type Prefs = {
  presence_active_enabled: boolean;
  friend_joined_enabled: boolean;
  room_invite_enabled: boolean;
  game_pings_enabled: boolean;
};

const DEFAULTS: Prefs = {
  presence_active_enabled: true,
  friend_joined_enabled: true,
  room_invite_enabled: true,
  game_pings_enabled: true,
};

const ROWS: { key: keyof Prefs; label: string; hint: string }[] = [
  {
    key: "presence_active_enabled",
    label: "Friend watching now",
    hint: "When someone you know checks into a room you're in.",
  },
  {
    key: "friend_joined_enabled",
    label: "Someone you know joins",
    hint: "When a person from your contacts signs up.",
  },
  {
    key: "game_pings_enabled",
    label: "Game-day pings",
    hint: "When someone rallies your huddle around game time.",
  },
  {
    key: "room_invite_enabled",
    label: "Room invites",
    hint: "When someone pulls you into a room.",
  },
];

export function NotificationSettings() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      const [prefRes, profileRes] = await Promise.all([
        supabase
          .from("notification_preferences")
          .select(
            "presence_active_enabled, friend_joined_enabled, room_invite_enabled",
          )
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("profiles")
          .select("game_pings_enabled")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);

      if (cancelled) return;

      const p = (prefRes.data ?? {}) as any;
      setPrefs({
        // A missing row means "never customised", which is the same as on.
        presence_active_enabled: p.presence_active_enabled !== false,
        friend_joined_enabled: p.friend_joined_enabled !== false,
        room_invite_enabled: p.room_invite_enabled !== false,
        game_pings_enabled:
          (profileRes.data as any)?.game_pings_enabled !== false,
      });
      setLoaded(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const toggle = async (key: keyof Prefs, value: boolean) => {
    // Optimistic: a switch that lags feels broken.
    setPrefs((prev) => ({ ...prev, [key]: value }));
    if (!user) return;

    if (key === "game_pings_enabled") {
      await supabase
        .from("profiles")
        .update({ game_pings_enabled: value } as any)
        .eq("user_id", user.id);
      return;
    }

    // upsert, not update: the row should exist after the migration, but a
    // failed write here would silently do nothing at all.
    await (supabase as any)
      .from("notification_preferences")
      .upsert({ user_id: user.id, [key]: value }, { onConflict: "user_id" });
  };

  if (!loaded) {
    return (
      <View className="py-6">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View className="gap-4">
      {ROWS.map((row) => (
        <View key={row.key} className="flex-row items-center justify-between">
          <View className="flex-1 pr-3">
            <Type variant="captionStrong">
              {row.label}
            </Type>
            <Type variant="caption" tone="muted">{row.hint}</Type>
          </View>
          <Switch
            value={prefs[row.key]}
            onValueChange={(v) => toggle(row.key, v)}
            trackColor={{ true: colors.success, false: colors.muted }}
          />
        </View>
      ))}

      {/* Banner style, sounds and badges are iOS-level and can't be set from
          in here — so point at where they actually live instead of pretending. */}
      <Pressable
        onPress={() => Linking.openSettings()}
        className="mt-1 active:opacity-70"
      >
        <Type variant="caption" tone="muted">
          Banners, sounds and badges are controlled by iOS.{" "}
          <Type variant="bodyStrong" tone="primary">Open iOS Settings →</Type>
        </Type>
      </Pressable>
    </View>
  );
}
