import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { Swords } from "lucide-react-native";
import { cn } from "@/lib/utils";
import { colors } from "@/theme/colors";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useFades } from "@/hooks/useFades";
import type { GameContext, GameState } from "@/hooks/useLiveGameContext";
import { PostFadeSheet } from "./PostFadeSheet";

// Compact fade entry in the presence bar. Replaces the old full-width rail,
// which held a slice of every room's screen even when there was nothing to take.
// The badge counts props still waiting on someone to fade them.
export function FadeButton({
  huddleId,
  game,
  gameState,
}: {
  huddleId: string;
  game: GameContext | null;
  gameState: GameState;
}) {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { data: fades } = useFades(huddleId);
  const [open, setOpen] = useState(false);

  // Same rule the server enforces: only games that live in `games` can be
  // graded by fade-settle, so only those can be faded.
  const canPost =
    !!user &&
    !!game &&
    game.settleable &&
    (gameState === "pregame" || gameState === "live") &&
    new Date(game.startTime).getTime() > Date.now();

  const openCount = (fades ?? []).filter(
    (f) => f.status === "open" && f.poster_id !== user?.id,
  ).length;

  if (!canPost) return null;

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={8}
        className={cn(
          "flex-row items-center gap-1.5 rounded-full border px-2.5 py-1",
          openCount > 0 ? "border-success bg-success/15" : "border-border bg-muted/40",
        )}
      >
        <Swords size={13} color={openCount > 0 ? colors.success : colors.mutedForeground} />
        <Text
          className={cn(
            "text-xs font-black",
            openCount > 0 ? "text-success" : "text-muted-foreground",
          )}
        >
          {openCount > 0 ? `${openCount} open` : "Fade"}
        </Text>
      </Pressable>

      {game ? (
        <PostFadeSheet
          visible={open}
          onClose={() => setOpen(false)}
          game={game}
          huddleId={huddleId}
          userId={user!.id}
          posterName={profile?.displayName || profile?.username || "You"}
          onPosted={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
