import { useCallback, useEffect, useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { Type } from "@/components/ui/Type";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { colors } from "@/theme/colors";

/**
 * The pre-game room.
 *
 * A huddle is at its deadest in the hours before kickoff, which is exactly
 * when it should be busiest — that's when people decide where they're watching
 * and who with. The room had nothing to offer then: a score bar with no score
 * in it, a reaction rail reacting to nothing, and a thread waiting for someone
 * else to speak first.
 *
 * So the pre-game screen is not the live screen with the numbers missing. It
 * asks the one question that matters before a game and shows the answer
 * building up: who's in.
 *
 * Degrades to nothing if huddle_game_rsvps hasn't been created yet
 * (RUN_THIS_GAME_RSVP.sql) — a missing table hides the strip rather than
 * breaking the room.
 */

type Attendee = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
};

function kickoffIn(startTime: string): string {
  const mins = Math.round((new Date(startTime).getTime() - Date.now()) / 60000);
  if (mins <= 0) return "any minute";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return mins % 60 === 0 ? `${hrs}h` : `${hrs}h ${mins % 60}m`;
  return `${Math.round(hrs / 24)}d`;
}

export function PregameStrip({
  huddleId,
  gameId,
  startTime,
}: {
  huddleId: string;
  gameId: string | null | undefined;
  startTime: string | null | undefined;
}) {
  const { user } = useAuth();
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [supported, setSupported] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!gameId) return;
    const { data, error } = await supabase
      .from("huddle_game_rsvps")
      .select("user_id")
      .eq("huddle_id", huddleId)
      .eq("game_id", gameId);

    if (error) {
      // 42P01 = table missing. The migration hasn't been run; say nothing
      // rather than showing a broken strip.
      setSupported(false);
      return;
    }

    const ids = (data ?? []).map((r: any) => r.user_id);
    if (ids.length === 0) {
      setAttendees([]);
      return;
    }

    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, display_name, username, avatar_url")
      .in("user_id", ids);

    setAttendees(
      (profiles ?? []).map((p: any) => ({
        userId: p.user_id,
        displayName: p.display_name ?? p.username ?? "Someone",
        avatarUrl: p.avatar_url ?? null,
      })),
    );
  }, [huddleId, gameId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!supported || !gameId || !user) return null;

  const mine = attendees.some((a) => a.userId === user.id);

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (mine) {
        await supabase
          .from("huddle_game_rsvps")
          .delete()
          .eq("huddle_id", huddleId)
          .eq("game_id", gameId)
          .eq("user_id", user.id);
      } else {
        await supabase.from("huddle_game_rsvps").insert({
          huddle_id: huddleId,
          game_id: gameId,
          user_id: user.id,
        });
      }
      await load();
    } finally {
      setBusy(false);
    }
  };

  const others = attendees.filter((a) => a.userId !== user.id);

  return (
    <View className="border-b border-border bg-primary/[0.06] px-4 py-2.5">
      <View className="flex-row items-center gap-3">
        <View className="flex-1">
          <Type variant="captionStrong">
            {attendees.length === 0
              ? "Nobody's said they're watching yet"
              : mine && others.length === 0
                ? "You're in. Nobody else yet."
                : `${others.length === 1 ? others[0].displayName : `${others.length} others`} ${
                    others.length === 1 ? "is" : "are"
                  } in${mine ? " with you" : ""}`}
          </Type>
          {startTime ? (
            <Type variant="data" tone="muted" className="mt-0.5">
              Kicks in {kickoffIn(startTime)}
            </Type>
          ) : null}
        </View>

        {others.length > 0 ? (
          <View className="flex-row">
            {others.slice(0, 4).map((a, i) => (
              <View
                key={a.userId}
                className="h-7 w-7 items-center justify-center overflow-hidden rounded-full border-2 border-background bg-muted"
                style={i > 0 ? { marginLeft: -8 } : undefined}
              >
                {a.avatarUrl ? (
                  <Image
                    source={{ uri: a.avatarUrl }}
                    className="h-full w-full"
                    resizeMode="cover"
                  />
                ) : (
                  <Type variant="dataStrong" tone="muted">
                    {a.displayName.charAt(0).toUpperCase()}
                  </Type>
                )}
              </View>
            ))}
          </View>
        ) : null}

        <Pressable
          onPress={toggle}
          disabled={busy}
          className={
            mine
              ? "rounded-full border border-border px-3.5 py-1.5 active:opacity-70"
              : "rounded-full bg-primary px-3.5 py-1.5 active:opacity-80"
          }
        >
          <Type variant="captionStrong"
            
            style={{ color: mine ? colors.mutedForeground : colors.primaryForeground }}>
            {mine ? "I'm out" : "I'm in"}
          </Type>
        </Pressable>
      </View>
    </View>
  );
}
