import { View, Text } from "react-native";
import { Check, X, Clock, Target } from "lucide-react-native";
import { cn } from "@/lib/utils";
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
      <Text className="text-sm font-semibold text-foreground" numberOfLines={2}>
        {bet.question}
      </Text>

      <View className="flex-row items-center gap-2">
        <Badge
          variant={bet.position === "yes" ? "default" : "destructive"}
        >
          {bet.position.toUpperCase()}
        </Badge>
        <Text className="text-xs text-muted-foreground">
          {bet.chipsRisked} coins risked
        </Text>

        {/* Status */}
        {isOpen && bet.eventStartTime && (
          <View className="ml-auto flex-row items-center gap-1">
            <Clock color={colors.mutedForeground} size={12} />
            <Text className="text-xs text-muted-foreground">
              {timeUntil(bet.eventStartTime)}
            </Text>
          </View>
        )}

        {isPending && (
          <View className="ml-auto flex-row items-center gap-1">
            <Clock color={colors.accent} size={12} />
            <Text className="text-xs text-accent">Awaiting result</Text>
          </View>
        )}

        {isWin && (
          <View className="ml-auto flex-row items-center gap-1.5">
            <View className="flex-row items-center gap-1 rounded-full bg-success/15 px-2 py-0.5">
              <Check color={colors.success} size={13} />
              <Text className="text-xs font-bold text-success">WON</Text>
            </View>
            <Text className="text-xs font-semibold text-success">
              +{bet.chipsWon ?? 0}
            </Text>
          </View>
        )}

        {isLoss && (
          <View className="ml-auto flex-row items-center gap-1.5">
            <View className="flex-row items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5">
              <X color={colors.destructive} size={13} />
              <Text className="text-xs font-bold text-destructive">LOST</Text>
            </View>
            <Text className="text-xs font-semibold text-destructive">
              -{bet.chipsRisked}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}
