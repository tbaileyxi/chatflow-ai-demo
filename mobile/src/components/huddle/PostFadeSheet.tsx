import { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  Text,
  View,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import { X, Swords } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import { cn } from "@/lib/utils";
import { colors } from "@/theme/colors";
import type { GameContext } from "@/hooks/useLiveGameContext";
import { useFadeMarkets, type FadeMarket } from "@/hooks/useFadeMarkets";
import { postFade } from "@/hooks/useFades";
import { isOutOfChips, offerFreeChips } from "@/lib/chips";

const STAKES = [50, 100, 200] as const;

// Take a side of a real prop. Lines come from the same SportsGameOdds feed that
// powers predictions — nobody types a number here. Pick a prop, pick a side,
// stake chips; it posts to the room as a card for someone else to fade.
export function PostFadeSheet({
  visible,
  onClose,
  game,
  huddleId,
  userId,
  posterName,
  onPosted,
}: {
  visible: boolean;
  onClose: () => void;
  game: GameContext;
  huddleId: string;
  userId: string;
  posterName: string;
  onPosted: () => void;
}) {
  const navigation = useNavigation<any>();
  const { data: markets, isLoading } = useFadeMarkets(game);
  const [selected, setSelected] = useState<FadeMarket | null>(null);
  const [side, setSide] = useState<"over" | "under">("over");
  const [stake, setStake] = useState<number>(100);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!selected && markets?.length) setSelected(markets[0]);
  }, [markets, selected]);

  const submit = async () => {
    if (!selected) return;
    setSubmitting(true);
    const res = await postFade({
      huddleId,
      userId,
      posterName,
      game,
      market: selected,
      side,
      stake,
    });
    setSubmitting(false);
    if (!res.ok) {
      if (isOutOfChips(res.error)) await offerFreeChips(res.error);
      else Alert.alert("Couldn't post that fade", res.error ?? "Please try again.");
      return;
    }
    onPosted();
    onClose();
  };

  const sideLabel = (s: "over" | "under") =>
    !selected
      ? s === "over"
        ? "Over"
        : "Under"
      : s === "over"
        ? selected.overLabel
        : selected.underLabel;

  const matchup = `${game.awayTeamName ?? "Away"} @ ${game.homeTeamName ?? "Home"}`;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/50" onPress={onClose}>
        <Pressable
          className="max-h-[85%] rounded-t-3xl bg-background px-5 pb-8 pt-4"
          onPress={(e) => e.stopPropagation()}
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <Swords size={18} color={colors.primary} />
              <Text className="text-lg font-black text-foreground">Take a side</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <X size={20} color={colors.mutedForeground} />
            </Pressable>
          </View>
          <Text className="mt-0.5 text-xs text-muted-foreground">{matchup}</Text>

          <ScrollView className="mt-4" keyboardShouldPersistTaps="handled">
            {isLoading ? (
              <View className="py-8">
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : !markets?.length ? (
              // Deliberately no fallback line. If the book has nothing for this
              // game there is nothing honest to fade, and a made-up number is
              // what made every game look identical before.
              <View className="rounded-xl border border-border bg-muted/30 p-4">
                <Text className="text-sm font-bold text-foreground">
                  No lines for this game yet
                </Text>
                <Text className="mt-1 text-xs leading-4 text-muted-foreground">
                  Props show up once the book posts them — usually a few hours before
                  first pitch.
                </Text>
              </View>
            ) : (
              <>
                <Text className="mb-1.5 text-xs font-bold uppercase text-muted-foreground">
                  Prop
                </Text>
                {markets.map((m) => (
                  <Pressable
                    key={m.marketId}
                    onPress={() => setSelected(m)}
                    className={cn(
                      "mb-2 rounded-xl border px-3 py-2.5",
                      selected?.marketId === m.marketId
                        ? "border-primary bg-primary/10"
                        : "border-border bg-muted/40",
                    )}
                  >
                    <Text className="text-sm font-black text-foreground">{m.label}</Text>
                    <Text className="mt-0.5 text-xs text-muted-foreground">
                      {m.description}
                    </Text>
                  </Pressable>
                ))}

                <Text className="mt-3 mb-1.5 text-xs font-bold uppercase text-muted-foreground">
                  Your side
                </Text>
                <View className="flex-row gap-2">
                  {(["over", "under"] as const).map((s) => (
                    <Pressable
                      key={s}
                      onPress={() => setSide(s)}
                      className={cn(
                        "flex-1 rounded-xl border px-3 py-2.5",
                        side === s
                          ? "border-success bg-success/15"
                          : "border-border bg-muted/40",
                      )}
                    >
                      <Text
                        className={cn(
                          "text-center text-sm font-black",
                          side === s ? "text-success" : "text-foreground",
                        )}
                      >
                        {sideLabel(s)}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Text className="mt-3 mb-1.5 text-xs font-bold uppercase text-muted-foreground">
                  Stake
                </Text>
                <View className="flex-row gap-2">
                  {STAKES.map((s) => (
                    <Pressable
                      key={s}
                      onPress={() => setStake(s)}
                      className={cn(
                        "flex-1 rounded-xl border px-3 py-2.5",
                        stake === s
                          ? "border-primary bg-primary/10"
                          : "border-border bg-muted/40",
                      )}
                    >
                      <Text className="text-center text-sm font-black text-foreground">
                        {s}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Pressable
                  disabled={submitting || !selected}
                  onPress={submit}
                  className={cn(
                    "mt-5 items-center rounded-xl px-4 py-3",
                    submitting || !selected ? "bg-muted" : "bg-primary",
                  )}
                >
                  {submitting ? (
                    <ActivityIndicator color={colors.primaryForeground} />
                  ) : (
                    <Text className="text-sm font-black text-primary-foreground">
                      Post {sideLabel(side)} · {stake} chips
                    </Text>
                  )}
                </Pressable>

                {/* The way back to what you already have riding. Posting debits
                    the chips immediately, and there is no other route from here
                    to that list — which is how someone ends up posting the same
                    line twice because they cannot see the first one. */}
                <Pressable
                  onPress={() => {
                    onClose();
                    // Ledger used to be a tab under MainTabs, so this had to
                    // cross that boundary. It's a root stack screen now — the
                    // Picks tab was removed — so it pushes directly, and the
                    // room stays underneath instead of being swapped out for
                    // a tab.
                    navigation.navigate("Ledger" as never);
                  }}
                  className="mt-3 items-center rounded-xl border border-border px-4 py-3"
                >
                  <Text className="text-sm font-bold text-foreground">
                    See all picks
                  </Text>
                </Pressable>
              </>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
