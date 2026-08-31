import { useState } from "react";
import { Pressable, Text, ActivityIndicator } from "react-native";
import { Megaphone } from "lucide-react-native";
import { cn } from "@/lib/utils";
import { colors } from "@/theme/colors";
import { supabase } from "@/integrations/supabase/client";

type PingState = "idle" | "sending" | "done" | "already" | "nogame";

// "Rally the huddle" pill. Only shown during a game window (gameState !== none).
// One ping per huddle per game is enforced server-side; this just reflects state.
//
// Rally is two halves of one intention: ping the people who are already in the
// room, then offer the people who aren't. onRallied fires after a successful
// ping so the host can open the pull-in sheet — pinging a three-person room and
// stopping there was never what "rally" meant.
export function PingButton({
  huddleId,
  gameState,
  onRallied,
}: {
  huddleId: string;
  gameState: "pregame" | "live" | "postgame" | "none";
  onRallied?: () => void;
}) {
  const [state, setState] = useState<PingState>("idle");

  if (gameState === "none") return null;

  const onPress = async () => {
    if (state !== "idle") return;
    setState("sending");
    try {
      const { data, error } = await supabase.functions.invoke("huddle-ping", {
        body: { huddleId },
      });
      if (error) throw error;
      const res = data as { ok?: boolean; code?: string };
      if (res?.ok) {
        setState("done");
        onRallied?.();
      } else if (res?.code === "already_pinged") {
        // The room is capped for this game, but pulling in people who aren't
        // here yet still makes sense — that half has no cap.
        setState("already");
        onRallied?.();
      } else if (res?.code === "no_game") setState("nogame");
      else setState("idle");
    } catch {
      setState("idle");
    }
  };

  if (state === "nogame") return null;

  const done = state === "done" || state === "already";
  const label =
    state === "done" ? "Rallied ✓"
      : state === "already" ? "Already rallied"
        : "Rally the huddle";

  return (
    <Pressable
      onPress={onPress}
      disabled={state !== "idle"}
      hitSlop={6}
      className={cn(
        "flex-row items-center gap-1.5 rounded-full border px-3 py-1.5 active:opacity-80",
        done ? "border-border bg-muted" : "border-success/50 bg-success/15",
      )}
    >
      {state === "sending" ? (
        <ActivityIndicator size="small" color={colors.success} />
      ) : (
        <>
          <Megaphone size={13} color={done ? colors.mutedForeground : colors.success} />
          <Text
            className={cn(
              "text-xs font-bold",
              done ? "text-muted-foreground" : "text-success",
            )}
          >
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}
