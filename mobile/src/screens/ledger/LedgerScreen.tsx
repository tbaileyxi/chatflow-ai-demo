import { useMemo, useState, useCallback } from "react";
import { View, Text, ScrollView, RefreshControl, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Coins, Target, Clock, Trophy, TrendingUp, Sparkles, Swords } from "lucide-react-native";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { usePortfolio } from "@/hooks/usePortfolio";
import { useShadowBets } from "@/hooks/useShadowBets";
import { useFadeRecord, type FadeRecord } from "@/hooks/useFadeRecord";
import {
  useFollowedTeamMarkets,
  type TeamMarketGroup,
} from "@/hooks/useFollowedTeamMarkets";
import { PortfolioCard } from "@/components/ledger/PortfolioCard";
import { BetCard } from "@/components/ledger/BetCard";
import { PredictionCard } from "@/components/predictions/PredictionCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { colors } from "@/theme/colors";

export function LedgerScreen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: portfolio, isLoading: portfolioLoading } = usePortfolio();
  const { data: bets, isLoading: betsLoading } = useShadowBets();
  const { data: teamMarkets, isLoading: marketsLoading } =
    useFollowedTeamMarkets();
  const { data: fadeRecord } = useFadeRecord();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["portfolio", user?.id] }),
      queryClient.invalidateQueries({ queryKey: ["shadow-bets", user?.id] }),
      queryClient.invalidateQueries({
        queryKey: ["followed-team-markets", user?.id],
      }),
      queryClient.invalidateQueries({ queryKey: ["fade-record", user?.id] }),
    ]);
    setRefreshing(false);
  }, [queryClient, user?.id]);

  const { openBets, pendingBets, settledBets } = useMemo(() => {
    if (!bets) return { openBets: [], pendingBets: [], settledBets: [] };
    return {
      openBets: bets.filter((b) => !b.isSettled && !b.isResolved),
      pendingBets: bets.filter((b) => !b.isSettled && b.isResolved),
      settledBets: bets.filter((b) => b.isSettled),
    };
  }, [bets]);

  const isLoading = portfolioLoading || betsLoading;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <ScrollView
        contentContainerClassName="pb-8"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <View className="px-4 pb-4 pt-2">
          <Text className="text-2xl font-black text-foreground">Picks</Text>
          <Text className="text-sm text-muted-foreground">
            Side Coins, game props, and bragging rights.
          </Text>
        </View>

        <View className="gap-6 px-4">
          <View className="rounded-2xl border border-primary/30 bg-primary/10 p-4">
            <View className="flex-row items-center gap-2">
              <Sparkles color={colors.primary} size={18} />
              <Text className="text-base font-black text-foreground">
                Play with coins, not cash
              </Text>
            </View>
            <Text className="mt-2 text-sm leading-5 text-muted-foreground">
              Prediction markets power the real line. Side Huddle turns it into casual room picks.
            </Text>
          </View>

          {/* Portfolio */}
          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : portfolio ? (
            <PortfolioCard portfolio={portfolio} />
          ) : null}

          {/* Fade record — head-to-head vs the huddle */}
          {fadeRecord && fadeRecord.wins + fadeRecord.losses > 0 ? (
            <FadeRecordSection record={fadeRecord} />
          ) : null}

          {/* Live Markets — grouped by followed team */}
          {marketsLoading ? (
            <View className="gap-2">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </View>
          ) : teamMarkets && teamMarkets.length > 0 ? (
            <View className="gap-4">
              <View className="flex-row items-center gap-2">
                <TrendingUp color={colors.primary} size={18} />
                <Text className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                  Game Props
                </Text>
              </View>
              {teamMarkets.map((group) => (
                <TeamMarketsSection key={group.teamId} group={group} />
              ))}
            </View>
          ) : null}

          {(teamMarkets && teamMarkets.length > 0) ||
          openBets.length > 0 ||
          pendingBets.length > 0 ? (
            <Separator />
          ) : null}

          {/* Open Bets */}
          {openBets.length > 0 && (
            <BetSection
              icon={<Target color={colors.primary} size={18} />}
              title="Open Picks"
              count={openBets.length}
              bets={openBets}
            />
          )}

          {/* Pending */}
          {pendingBets.length > 0 && (
            <BetSection
              icon={<Clock color={colors.accent} size={18} />}
              title="Pending Results"
              count={pendingBets.length}
              bets={pendingBets}
            />
          )}

          {openBets.length > 0 || pendingBets.length > 0 ? (
            <Separator />
          ) : null}

          {/* History */}
          {isLoading ? (
            <View className="gap-2">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </View>
          ) : settledBets.length > 0 ? (
            <BetSection
              icon={<Trophy color={colors.primary} size={18} />}
              title="History"
              count={settledBets.length}
              bets={settledBets}
            />
          ) : (
            !isLoading &&
            (!teamMarkets || teamMarkets.length === 0) && (
              <View className="items-center py-8">
                <Coins color={colors.mutedForeground} size={32} />
                <Text className="mt-2 text-base font-medium text-muted-foreground">
                  No picks yet
                </Text>
                <Text className="text-sm text-muted-foreground">
                  Follow teams and place predictions below
                </Text>
              </View>
            )
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function FadeRecordSection({ record }: { record: FadeRecord }) {
  return (
    <View className="gap-3">
      <View className="flex-row items-center gap-2">
        <Swords color={colors.primary} size={18} />
        <Text className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Fade Record
        </Text>
      </View>
      <View className="rounded-2xl border border-border bg-card p-4">
        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-black text-foreground">
            {record.wins}-{record.losses}
          </Text>
          <Text
            className={cn(
              "text-base font-bold",
              record.net >= 0 ? "text-success" : "text-destructive",
            )}
          >
            {record.net >= 0 ? "+" : ""}
            {record.net} chips
          </Text>
        </View>
        {record.h2h.length > 0 && (
          <View className="mt-3 gap-2 border-t border-border pt-3">
            {record.h2h.map((h) => (
              <View
                key={h.opponentId}
                className="flex-row items-center justify-between"
              >
                <Text className="text-sm text-foreground">vs {h.name}</Text>
                <Text className="text-sm font-medium text-muted-foreground">
                  {h.wins}-{h.losses}{"  "}
                  <Text
                    className={cn(
                      "font-bold",
                      h.net >= 0 ? "text-success" : "text-destructive",
                    )}
                  >
                    {h.net >= 0 ? "+" : ""}
                    {h.net}
                  </Text>
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

function TeamMarketsSection({ group }: { group: TeamMarketGroup }) {
  // Use the official team huddle for placing bets from the Ledger.
  // If no official huddle exists, betting is disabled (huddleId required by RPC).
  const huddleId = group.huddleId ?? "";

  return (
    <View className="gap-2">
      {/* Team header */}
      <View className="flex-row items-center gap-2">
        <View className="h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-muted">
          {group.teamLogoUrl ? (
            <Image
              source={{ uri: group.teamLogoUrl }}
              className="h-full w-full"
              resizeMode="cover"
            />
          ) : (
            <Text className="text-xs font-bold text-muted-foreground">
              {group.teamName.charAt(0)}
            </Text>
          )}
        </View>
        <Text className="text-base font-semibold text-foreground">
          {group.teamCity} {group.teamName}
        </Text>
        <View className="rounded-full bg-muted px-2 py-0.5">
          <Text className="text-xs font-semibold text-muted-foreground">
            {group.markets.length}
          </Text>
        </View>
      </View>

      {/* Market cards */}
      {group.markets.map((market) => (
        <PredictionCard
          key={market.id}
          market={market}
          huddleId={huddleId}
        />
      ))}
    </View>
  );
}

function BetSection({
  icon,
  title,
  count,
  bets,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  bets: import("@/hooks/useShadowBets").ShadowBet[];
}) {
  return (
    <View className="gap-3">
      <View className="flex-row items-center gap-2">
        {icon}
        <Text className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          {title}
        </Text>
        <View className="rounded-full bg-muted px-2 py-0.5">
          <Text className="text-xs font-semibold text-muted-foreground">
            {count}
          </Text>
        </View>
      </View>
      {bets.map((bet) => (
        <BetCard key={bet.id} bet={bet} />
      ))}
    </View>
  );
}
