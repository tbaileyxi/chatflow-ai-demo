// The one place the app asks for location.
//
// Not at launch, not on a foreground, not the first time you open a game room
// — here, on a switch you flipped yourself, under a line explaining what it
// does. An app that asks for location out of nowhere gets refused by the
// person and questioned by review, and it deserves both.

import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, Switch, View } from "react-native";
import * as Location from "expo-location";
import { useQueryClient } from "@tanstack/react-query";
import { Type } from "@/components/ui/Type";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { recheckAtVenue } from "@/hooks/useAtVenue";
import { colors } from "@/theme/colors";

export function AtTheGameSetting() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [on, setOn] = useState<boolean | null>(null);
  const [granted, setGranted] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      if (!user?.id) return;
      const [{ data }, perm] = await Promise.all([
        (supabase as any).from("profiles").select("share_at_venue").eq("user_id", user.id).maybeSingle(),
        Location.getForegroundPermissionsAsync(),
      ]);
      if (!alive) return;
      setOn((data as any)?.share_at_venue ?? true);
      setGranted(perm.status === Location.PermissionStatus.GRANTED);
    })();
    return () => { alive = false; };
  }, [user?.id]);

  const toggle = useCallback(async (next: boolean) => {
    if (!user?.id) return;
    setOn(next);

    if (!next) {
      // Off means gone, now — not "stops updating". Anyone looking at your
      // name should lose the badge the moment you decide they should.
      await (supabase as any).from("profiles").update({ share_at_venue: false }).eq("user_id", user.id);
      await (supabase.rpc as any)("check_out_of_venue");
      queryClient.invalidateQueries({ queryKey: ["venue-presence"] });
      return;
    }

    await (supabase as any).from("profiles").update({ share_at_venue: true }).eq("user_id", user.id);

    const { status } = await Location.requestForegroundPermissionsAsync();
    const ok = status === Location.PermissionStatus.GRANTED;
    setGranted(ok);
    if (ok) {
      // Look straight away rather than waiting for the next foreground.
      recheckAtVenue();
    } else {
      // iOS only shows that dialog once. After a denial the switch is on and
      // does nothing, which looks broken unless we say why — so say why, and
      // point at the only place that can undo it.
      Alert.alert(
        "Location is turned off",
        "The switch is on, but iOS won't share your location until you allow it in Settings. Nothing will show until then.",
        [
          { text: "Not now", style: "cancel" },
          { text: "Open Settings", onPress: () => void Linking.openSettings() },
        ],
      );
    }
  }, [user?.id, queryClient]);

  if (on === null) {
    return <View className="py-4"><ActivityIndicator color={colors.primary} /></View>;
  }

  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between">
        <View className="flex-1 pr-3">
          <Type variant="captionStrong">Show when I'm at the game</Type>
          <Type variant="caption" tone="muted">
            Friends you're connected to see the stadium next to your name. Nobody else does.
          </Type>
        </View>
        <Switch
          value={on}
          onValueChange={(v) => void toggle(v)}
          trackColor={{ true: colors.success, false: colors.muted }}
        />
      </View>

      {/* Worth one plain sentence. "Shares your location" is what people
          expect this to mean, and it is not what it does. */}
      <Type variant="caption" tone="tertiary">
        Your phone works out which stadium you're near and sends only the name.
        Your location itself never leaves the device, and nothing runs in the
        background — it checks while you have the app open.
      </Type>

      {on && granted === false ? (
        <Pressable onPress={() => void Linking.openSettings()} className="active:opacity-70">
          <Type variant="caption" tone="muted">
            iOS is blocking location.{" "}
            <Type variant="bodyStrong" tone="primary">Open iOS Settings →</Type>
          </Type>
        </Pressable>
      ) : null}
    </View>
  );
}
