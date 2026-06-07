import { useState, useEffect, useCallback } from "react";
import { View, Text, Pressable, ActivityIndicator, Alert } from "react-native";
import { Check, X, Clock, Lock, TrendingUp, TrendingDown } from "lucide-react-native";
import { cn } from "@/lib/utils";
import { colors } from "@/theme/colors";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";

interface Market {
  id: string;
  question: string;
  current_yes_price: number;
  market_type: string;
  event_start_time: string;
  is_resolved: boolean;
  resolution: string | null;
  kalshi_ticker: string;
}

interface PredictionCardProps {
  market: Market;
  huddleId: string;
}

interface BetStats {
  total: number;
  yesCount: number;
  noCount: number;
}

function isPast(date: Date): boolean {
  return date.getTime() < Date.now();
}

function timeUntil(dateStr: string): string {
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff <= 0) return "In progress";
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return `${Math.floor(diff / 60000)}m`;
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function PredictionCard({ market, huddleId }: PredictionCardProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [userBet, setUserBet] = useState<{
    position: string;
    chips_risked: number;
    won?: boolean | null;
    chips_won?: number;
  } | null>(null);
  const [stats, setStats] = useState<BetStats>({ total: 0, yesCount: 0, noCount: 0 });
  const [placing, setPlacing] = useState(false);
  const [loadingBet, setLoadingBet] = useState(true);

  const yesCost = market.current_yes_price;
  const noCost = 100 - market.current_yes_price;
  const isLocked = market.event_start_time && isPast(new Date(new Date(market.event_start_time).getTime() - 5 * 60000));
  const isResolved = market.is_resolved;

  useEffect(() => {
    if (!user) {
      setLoadingBet(false);
      return;
    }

    const fetchBetAndStats = async () => {
      const [{ data: betData }, { data: statsData }] = await Promise.all([
        supabase
          .from("shadow_bets")
          .select("position, chips_risked, won, chips_won")
          .eq("user_id", user.id)
          .eq("market_id", market.id)
          .maybeSingle(),
        supabase
          .from("shadow_bets")
          .select("position")
          .eq("market_id", market.id),
      ]);
      if (betData) setUserBet({ ...betData, chips_won: betData.chips_won ?? undefined });
      if (statsData) {
        setStats({
          total: statsData.length,
          yesCount: statsData.filter((b) => b.position === "YES").length,
          noCount: statsData.filter((b) => b.position === "NO").length,
        });
      }
      setLoadingBet(false);
    };
    fetchBetAndStats();
  }, [user, market.id]);

  // Realtime for new bets on this market
  useEffect(() => {
    const channel = supabase
      .channel(`prediction-${market.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "shadow_bets",
          filter: `market_id=eq.${market.id}`,
        },
        (payload) => {
          const newBet = payload.new as any;
          setStats((prev) => ({
            total: prev.total + 1,
            yesCount: prev.yesCount + (newBet.position === "YES" ? 1 : 0),
            noCount: prev.noCount + (newBet.position === "NO" ? 1 : 0),
          }));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [market.id]);

  const handlePlaceBet = useCallback(
    async (position: "YES" | "NO") => {
      if (!user || placing || userBet || isLocked || isResolved) return;

      setPlacing(true);
      try {
        const { data, error } = await supabase.rpc("place_shadow_bet", {
          p_market_id: market.id,
          p_huddle_id: huddleId,
          p_position: position,
        });
        if (error) throw error;

        const result = data as any;
        setUserBet({ position, chips_risked: result.chips_risked, won: null, chips_won: 0 });
        // Invalidate portfolio and bets
        queryClient.invalidateQueries({ queryKey: ["portfolio"] });
        queryClient.invalidateQueries({ queryKey: ["shadow-bets"] });
      } catch (err: any) {
        Alert.alert("Error", err.message || "Failed to place bet");
      } finally {
        setPlacing(false);
      }
    },
    [user, placing, userBet, isLocked, isResolved, market.id, huddleId, queryClient],
  );

  if (loadingBet) {
    return (
      <View className="rounded-lg border border-border bg-muted/30 p-3">
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  const communityYesPct = stats.total > 0 ? Math.round((stats.yesCount / stats.total) * 100) : 50;
  const divergence = communityYesPct - yesCost;

  const borderStyle = isResolved && userBet?.won === true
    ? "border-success/40"
    : isResolved && userBet?.won === false
      ? "border-destructive/40"
      : !isResolved && userBet
        ? "border-primary/30"
        : isLocked && !isResolved
          ? "border-accent/30"
          : "border-border";

  const bgStyle = isResolved && userBet?.won === true
    ? "bg-success/5"
    : isResolved && userBet?.won === false
      ? "bg-destructive/5"
      : isLocked && !isResolved
        ? "bg-accent/5"
        : "bg-card";

  return (
    <View className={cn("rounded-lg border-2 p-3 gap-2", borderStyle, bgStyle)}>
      <Text className="text-sm font-semibold text-foreground">{market.question}</Text>

      {/* Resolved State */}
      {isResolved && (
        <View className="gap-1.5">
          <View
            className={cn(
              "flex-row items-center gap-2 rounded-lg px-3 py-2",
              market.resolution === "YES" ? "bg-success/20" : "bg-destructive/20",
            )}
          >
            {market.resolution === "YES" ? (
              <Check color={colors.success} size={14} />
            ) : (
              <X color={colors.destructive} size={14} />
            )}
            <Text
              className={cn(
                "text-sm font-bold",
                market.resolution === "YES" ? "text-success" : "text-destructive",
              )}
            >
              Resolved: {market.resolution}
            </Text>
          </View>
          {userBet && (
            <Text
              className={cn(
                "text-sm font-medium",
                userBet.won ? "text-success" : "text-destructive",
              )}
            >
              {userBet.won
                ? `Won +${(userBet.chips_won || 100) - userBet.chips_risked}¢!`
                : `Lost -${userBet.chips_risked}¢`}
            </Text>
          )}
        </View>
      )}

      {/* Pre-bet Buttons */}
      {!isResolved && !userBet && !isLocked && (
        <View className="flex-row gap-2">
          <Pressable
            className="flex-1 flex-row items-center justify-center gap-1 rounded-lg bg-success/80 py-2.5 active:opacity-80"
            onPress={() => handlePlaceBet("YES")}
            disabled={placing}
          >
            {placing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Text className="text-sm font-bold text-white">YES</Text>
                <Text className="text-xs font-medium text-white/70">{yesCost}¢</Text>
              </>
            )}
          </Pressable>
          <Pressable
            className="flex-1 flex-row items-center justify-center gap-1 rounded-lg bg-destructive/80 py-2.5 active:opacity-80"
            onPress={() => handlePlaceBet("NO")}
            disabled={placing}
          >
            {placing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Text className="text-sm font-bold text-white">NO</Text>
                <Text className="text-xs font-medium text-white/70">{noCost}¢</Text>
              </>
            )}
          </Pressable>
        </View>
      )}

      {/* Locked */}
      {!isResolved && isLocked && !userBet && (
        <View className="flex-row items-center gap-2">
          <Lock color={colors.accent} size={14} />
          <Text className="text-sm text-accent">Betting locked</Text>
        </View>
      )}

      {/* Post-bet Stats */}
      {!isResolved && userBet && (
        <View className="gap-1.5">
          <View className="flex-row items-center gap-2">
            <View
              className={cn(
                "rounded px-2 py-0.5",
                userBet.position === "YES" ? "bg-success/20" : "bg-destructive/20",
              )}
            >
              <Text
                className={cn(
                  "text-xs font-bold",
                  userBet.position === "YES" ? "text-success" : "text-destructive",
                )}
              >
                Your pick: {userBet.position} ({userBet.chips_risked}¢)
              </Text>
            </View>
          </View>
          {stats.total > 0 && (
            <View className="gap-1">
              <View className="flex-row justify-between">
                <Text className="text-xs text-muted-foreground">
                  Community: {communityYesPct}% YES ({stats.total} bets)
                </Text>
                <Text className="text-xs text-muted-foreground">Market: {yesCost}%</Text>
              </View>
              {Math.abs(divergence) >= 3 && (
                <View className="flex-row items-center gap-1">
                  {divergence > 0 ? (
                    <TrendingUp color={colors.success} size={12} />
                  ) : (
                    <TrendingDown color={colors.destructive} size={12} />
                  )}
                  <Text
                    className={cn(
                      "text-xs",
                      divergence > 0 ? "text-success" : "text-destructive",
                    )}
                  >
                    Community is {Math.abs(divergence)}% {divergence > 0 ? "more" : "less"} bullish
                  </Text>
                </View>
              )}
              {/* Progress bar */}
              <View className="h-1.5 overflow-hidden rounded-full bg-muted">
                <View
                  className="h-full rounded-full bg-success"
                  style={{ width: `${communityYesPct}%` }}
                />
              </View>
            </View>
          )}
        </View>
      )}

      {/* Game time */}
      {!isResolved && market.event_start_time && (
        <View className="flex-row items-center gap-1">
          <Clock color={colors.mutedForeground} size={12} />
          <Text className="text-xs text-muted-foreground">
            {timeUntil(market.event_start_time)}
          </Text>
        </View>
      )}
    </View>
  );
}
