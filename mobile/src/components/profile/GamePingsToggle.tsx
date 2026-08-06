import { useEffect, useState } from "react";
import { View, Text, Switch } from "react-native";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { colors } from "@/theme/colors";

// Settings toggle for game-day "Rally the huddle" pings. Writes
// profiles.game_pings_enabled, which the huddle-ping function honors.
export function GamePingsToggle() {
  const { user } = useAuth();
  const [enabled, setEnabled] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    supabase
      .from("profiles")
      .select("game_pings_enabled")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setEnabled((data as any)?.game_pings_enabled !== false);
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const toggle = async (val: boolean) => {
    setEnabled(val);
    if (!user) return;
    await supabase
      .from("profiles")
      .update({ game_pings_enabled: val } as any)
      .eq("user_id", user.id);
  };

  return (
    <View className="flex-row items-center justify-between">
      <View className="flex-1 pr-3">
        <Text className="text-sm font-medium text-foreground">Game-day pings</Text>
        <Text className="text-xs text-muted-foreground">
          Get a notification when someone rallies your huddle around game time.
        </Text>
      </View>
      <Switch
        value={enabled}
        onValueChange={toggle}
        disabled={!loaded}
        trackColor={{ true: colors.success, false: colors.muted }}
      />
    </View>
  );
}
