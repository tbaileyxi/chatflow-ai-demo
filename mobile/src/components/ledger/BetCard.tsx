import { View, Text } from "react-native";
import { Check, X, Clock, Target } from "lucide-react-native";
import { Type } from "@/components/ui/Type";
import { cn } from "@/lib/utils";
import { marketSides } from "@/lib/marketSides";
import { Badge } from "@/components/ui/badge";
import { colors } from "@/theme/colors";
import type { ShadowBet } from "@/hooks/useShadowBets";

type Props = {
  bet: ShadowBet;
};

function timeUntil(dateStr: string): string {
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff <= 0) return "Started";
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return `${Math.floor(diff / 60000)}m`;
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function BetCard({ bet }: Props) {
  // Same wording as the board and the chat card, so a pick you made in a room
  // is still recognisable when you find it on your ledger a day later.
  const sides = marketSides({
    question: bet.question,
    market_type: bet.marketType,
    metadata: bet.metadata,
  });
  const myLabel = bet.position.toLowerCase() === "yes" ? sides.yesLabel : sides.noLabel;

  const isOpen = !bet.isSettled && !bet.isResolved;
  const isPending = !bet.isSettled && bet.isResolved;
  const isWin = bet.isSettled && bet.won === true;
  const isLoss = bet.isSettled && bet.won === false;

  const borderColor = isWin
    ? "border-success/30"
    : isLoss
      ? "border-destructive/30"
      : isPending
        ? "border-accent/30"
        : "border-border";

  const bgColor = isWin
    ? "bg-success/5"
    : isLoss
      ? "bg-destructive/5"
      : isPending
        ? "bg-accent/5"
        : "bg-card";

  return (
    <View className={cn("gap-2 rounded-lg border p-3", borderColor, bgColor)}>
      <Type variant="captionStrong"  numberOfLines={2}>
        {sides.headline}
      </Type>

      <View className="flex-row items-center gap-2">
        <Badge variant="default">{myLabel}</Badge>
        <Type variant="caption" tone="muted">
          {bet.chipsRisked} chips risked
        </Type>

        {/* Status */}
        {isOpen && bet.eventStartTime && (
          <View className="ml-auto flex-row items-center gap-1">
            <Clock color={colors.mutedForeground} size={12} />
            <Type variant="caption" tone="muted">
              {timeUntil(bet.eventStartTime)}
            </Type>
          </View>
        )}

        {isPending && (
          <View className="ml-auto flex-row items-center gap-1">
            <Clock color={colors.accent} size={12} />
            <Type variant="caption" className="text-accent">Awaiting result</Type>
          </View>
        )}

        {isWin && (
          <View className="ml-auto flex-row items-center gap-1.5">
            <View className="flex-row items-center gap-1 rounded-full bg-success/15 px-2 py-0.5">
              <Check color={colors.success} size={13} />
              <Type variant="captionStrong" tone="success">WON</Type>
            </View>
            <Type variant="captionStrong" tone="success">
              +{bet.chipsWon ?? 0}
            </Type>
          </View>
        )}

        {isLoss && (
          <View className="ml-auto flex-row items-center gap-1.5">
            <View className="flex-row items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5">
              <X color={colors.destructive} size={13} />
              <Type variant="captionStrong" tone="danger">LOST</Type>
            </View>
            <Type variant="captionStrong" tone="danger">
              -{bet.chipsRisked}
            </Type>
          </View>
        )}
      </View>
    </View>
  );
}
