import { useMemo, useState, useCallback } from "react";
import { View, Text, ScrollView, RefreshControl, Pressable, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRoute, useNavigation } from "@react-navigation/native";
import { Target, Clock, Trophy, Sparkles, Swords, Flame } from "lucide-react-native";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { usePortfolio } from "@/hooks/usePortfolio";
import { useShadowBets } from "@/hooks/useShadowBets";
import { useFadeRecord, type FadeRecord } from "@/hooks/useFadeRecord";
import { useOpenFades, type OpenFade } from "@/hooks/useOpenFades";
import { useRoomStandings, type RoomStanding } from "@/hooks/useRoomStandings";
import { useMyRoomStandings } from "@/hooks/useMyRoomStandings";
import { useFadeHistory, type FadeHistoryItem } from "@/hooks/useFadeHistory";
import { useMyFades, type MyFade } from "@/hooks/useMyFades";
import { acceptFade } from "@/hooks/useFades";
import { useProfile } from "@/hooks/useProfile";
import { isOutOfChips, offerFreeChips } from "@/lib/chips";
import { PortfolioCard } from "@/components/ledger/PortfolioCard";
import { BetCard } from "@/components/ledger/BetCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { colors } from "@/theme/colors";

export function LedgerScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  // Set when you arrive from a room. Picks then leads with THAT game's props
  // and offers a way back, instead of dumping every team you follow on you.
  const fromHuddleId: string | undefined = route.params?.huddleId;
  const fromHuddleName: string | undefined = route.params?.huddleName;
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: portfolio, isLoading: portfolioLoading } = usePortfolio();
  const { data: bets, isLoading: betsLoading } = useShadowBets();
  const { data: profile } = useProfile();
  const { data: openFades, isLoading: fadesLoading } = useOpenFades();
  const { data: standings } = useRoomStandings(fromHuddleId);
  // Opened from the tab bar there is no huddleId, so the single-room hook above
  // returns nothing and the leaderboard vanished entirely. This covers that.
  const { data: myBoards } = useMyRoomStandings();
  const { data: fadeHistory } = useFadeHistory();
  const { data: myFades } = useMyFades();
  const { data: fadeRecord } = useFadeRecord();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["portfolio", user?.id] }),
      queryClient.invalidateQueries({ queryKey: ["shadow-bets", user?.id] }),
      queryClient.invalidateQueries({ queryKey: ["open-fades", user?.id] }),
      queryClient.invalidateQueries({ queryKey: ["room-standings", fromHuddleId] }),
      queryClient.invalidateQueries({ queryKey: ["my-room-standings", user?.id] }),
      queryClient.invalidateQueries({ queryKey: ["fade-history", user?.id] }),
      queryClient.invalidateQueries({ queryKey: ["fade-record", user?.id] }),
    ]);
    setRefreshing(false);
  }, [queryClient, user?.id, fromHuddleId]);

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
          <View className="flex-row items-center justify-between">
            <Text className="text-2xl font-black text-foreground">Picks</Text>
            {/* Picks is a tab, so there is no stack back button. Arriving from
                a room and being stranded here is how the room context got lost
                before. */}
            {fromHuddleId ? (
              <Pressable
                onPress={() =>
                  navigation.navigate("Huddle", { huddleId: fromHuddleId })
                }
                hitSlop={8}
              >
                <Text className="text-xs font-black text-muted-foreground">
                  ← {fromHuddleName ?? "Back to room"}
                </Text>
              </Pressable>
            ) : null}
          </View>
          <Text className="text-sm text-muted-foreground">
            Take a side, make someone take the other.
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
              Real lines, no cash. You post a take, someone in your room fades
              it, the game settles it.
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
          {/* OPEN FADES — the props waiting on a taker, across every room
              you're in. Fades used to live only as a chat message, which meant
              they scrolled away minutes after posting and nothing anywhere
              answered "is there something to take right now?". This is that
              answer, and it is the first thing on the screen for a reason. */}
          {fadesLoading ? (
            <View className="gap-2">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-24 w-full" />
            </View>
          ) : openFades && openFades.length > 0 ? (
            <View className="gap-3">
              <View className="flex-row items-center gap-2">
                <Flame color={colors.primary} size={18} />
                <Text className="text-sm font-bold uppercase tracking-wider text-primary">
                  Open fades
                </Text>
                <View className="rounded-full bg-primary/15 px-2 py-0.5">
                  <Text className="text-xs font-black text-primary">
                    {openFades.length}
                  </Text>
                </View>
              </View>
              {openFades.map((f) => (
                <OpenFadeCard
                  key={f.id}
                  fade={f}
                  userId={user?.id ?? ""}
                  accepterName={
                    profile?.displayName || profile?.username || "You"
                  }
                  onTaken={onRefresh}
                />
              ))}
            </View>
          ) : (
            <View className="items-center rounded-2xl border border-dashed border-border py-8">
              <Swords color={colors.mutedForeground} size={28} />
              <Text className="mt-2 text-base font-bold text-foreground">
                Nothing to take right now
              </Text>
              <Text className="mt-1 px-8 text-center text-sm leading-5 text-muted-foreground">
                Open a room on gameday and hit Fade to put a line up. Whoever
                disagrees takes the other side.
              </Text>
            </View>
          )}

          {/* YOURS — posted or taken, still to settle. Without this the chips
              leave your balance the moment you post and the pick shows up
              nowhere: `openFades` hides your own on purpose, and history is
              settled-only. That reads as the app eating a bet. */}
          {myFades && myFades.length > 0 ? (
            <View className="gap-3">
              <View className="flex-row items-center gap-2">
                <Swords color={colors.primary} size={18} />
                <Text className="text-sm font-bold uppercase tracking-wider text-primary">
                  Your picks
                </Text>
                <View className="rounded-full bg-primary/15 px-2 py-0.5">
                  <Text className="text-xs font-black text-primary">
                    {myFades.length}
                  </Text>
                </View>
              </View>
              {myFades.map((f) => (
                <MyFadeRow key={f.id} fade={f} />
              ))}
            </View>
          ) : null}

          {/* ROOM STANDINGS — fade_season_stats has been written by settle_fade
              since the fade tables shipped and rendered nowhere. This is the
              room-vs-room scoreboard that was missing. */}
          {(() => {
            // From a room: that room's board. From the tab bar: every room you
            // play in. Same component either way.
            const boards =
              standings && standings.length > 0
                ? [
                    {
                      huddleId: fromHuddleId ?? "here",
                      huddleName: fromHuddleName ?? "Room",
                      rows: standings,
                    },
                  ]
                : (myBoards ?? []);
            if (boards.length === 0) return null;
            return (
              <View className="gap-4">
                {boards.map((b) => (
                  <View key={b.huddleId} className="gap-3">
                    <View className="flex-row items-center gap-2">
                      <Trophy color={colors.primary} size={18} />
                      <Text className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                        {b.huddleName} standings
                      </Text>
                    </View>
                    <View className="rounded-2xl border border-border bg-card p-4">
                      {b.rows.map((row, i) => (
                        <StandingRow
                          key={row.userId}
                          rank={i + 1}
                          row={row}
                          isMe={row.userId === user?.id}
                          last={i === b.rows.length - 1}
                        />
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            );
          })()}

          {openBets.length > 0 || pendingBets.length > 0 ? <Separator /> : null}

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

          {/* HISTORY — settled fades. This section used to list settled
              shadow_bets, which are only ever created by the retired yes/no
              cards; with those gone that list drains to empty and never
              refills. Fades are the thing with a history now. */}
          {fadeHistory && fadeHistory.length > 0 ? (
            <View className="gap-3">
              <View className="flex-row items-center gap-2">
                <Trophy color={colors.primary} size={18} />
                <Text className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                  History
                </Text>
                <View className="rounded-full bg-muted px-2 py-0.5">
                  <Text className="text-xs font-semibold text-muted-foreground">
                    {fadeHistory.length}
                  </Text>
                </View>
              </View>
              {fadeHistory.map((h) => (
                <FadeHistoryRow key={h.id} item={h} />
              ))}
            </View>
          ) : null}

          {/* Legacy yes/no picks, kept only while any remain unsettled so a
              member's past results do not vanish. Drains on its own. */}
          {settledBets.length > 0 ? (
            <BetSection
              icon={<Clock color={colors.mutedForeground} size={18} />}
              title="Older picks"
              count={settledBets.length}
              bets={settledBets}
            />
          ) : null}
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

// One open prop, with the poster's side already taken and the other side left
// for you. The sentence is the whole point: "Joe has OVER 8.5 — take UNDER".
function MyFadeRow({ fade }: { fade: MyFade }) {
  // Three states worth telling apart, because they mean different things about
  // your chips: waiting (refunded if nobody takes it), dead (game started
  // unmatched — the refund is owed), and locked (it is a real bet now).
  const waiting = fade.status === "open" && fade.stillTakeable;
  const missed = fade.status === "open" && !fade.stillTakeable;

  return (
    <View className="rounded-2xl border border-border bg-card p-4">
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text className="text-base font-black text-foreground">{fade.line}</Text>
          <Text className="mt-0.5 text-xs text-muted-foreground">
            {fade.matchup} · {fade.huddleName}
          </Text>
        </View>
        <Text className="text-sm font-black text-foreground">{fade.stake}</Text>
      </View>
      <Text
        className={cn(
          "mt-2 text-xs font-bold",
          fade.status === "locked"
            ? "text-primary"
            : missed
              ? "text-muted-foreground"
              : "text-amber-500",
        )}
      >
        {fade.status === "locked"
          ? "Locked in — playing"
          : waiting
            ? "Waiting on a taker"
            : "Nobody took it — chips come back"}
      </Text>
    </View>
  );
}

function OpenFadeCard({
  fade,
  userId,
  accepterName,
  onTaken,
}: {
  fade: OpenFade;
  userId: string;
  accepterName: string;
  onTaken: () => void;
}) {
  const [taking, setTaking] = useState(false);

  const posterSide = fade.fade_type === "over" ? "OVER" : "UNDER";
  const yourSide = fade.fade_type === "over" ? "UNDER" : "OVER";

  const take = async () => {
    if (!userId || taking) return;
    setTaking(true);
    const res = await acceptFade({
      fade,
      userId,
      accepterName,
      posterName: fade.posterName,
    });
    setTaking(false);
    if (!res.ok) {
      if (isOutOfChips(res.error)) offerFreeChips(res.error);
      else Alert.alert("Couldn't take that side", res.error ?? "Try again.");
      return;
    }
    onTaken();
  };

  return (
    <View className="rounded-2xl border border-border bg-card p-4">
      <Text className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {fade.huddleName} · {fade.away_team} @ {fade.home_team}
      </Text>
      <Text className="mt-1 text-base font-black text-foreground">
        {fade.line_description}
      </Text>
      <Text className="mt-1 text-sm text-muted-foreground">
        {fade.posterName} has {posterSide} {fade.line_value} · {fade.stake} chips
      </Text>
      <Pressable
        onPress={take}
        disabled={taking}
        className={cn(
          "mt-3 items-center rounded-xl py-3",
          taking ? "bg-muted" : "bg-primary",
        )}
      >
        <Text
          className={cn(
            "text-sm font-black",
            taking ? "text-muted-foreground" : "text-primary-foreground",
          )}
        >
          {taking ? "Taking…" : `Take ${yourSide} ${fade.line_value} · ${fade.stake}`}
        </Text>
      </Pressable>
    </View>
  );
}

function StandingRow({
  rank,
  row,
  isMe,
  last,
}: {
  rank: number;
  row: RoomStanding;
  isMe: boolean;
  last: boolean;
}) {
  return (
    <View
      className={cn(
        "flex-row items-center py-2",
        !last && "border-b border-border",
      )}
    >
      <Text className="w-6 text-sm font-black text-muted-foreground">{rank}</Text>
      <Text
        className={cn(
          "flex-1 text-sm",
          isMe ? "font-black text-primary" : "text-foreground",
        )}
      >
        {isMe ? "You" : row.name}
      </Text>
      <Text className="mr-3 text-sm text-muted-foreground">
        {row.wins}-{row.losses}
      </Text>
      <Text
        className={cn(
          "w-16 text-right text-sm font-bold",
          row.points >= 0 ? "text-success" : "text-destructive",
        )}
      >
        {row.points >= 0 ? "+" : ""}
        {row.points}
      </Text>
    </View>
  );
}

// One settled fade: who you played, your side, and what it moved.
function FadeHistoryRow({ item }: { item: FadeHistoryItem }) {
  return (
    <View className="flex-row items-center rounded-2xl border border-border bg-card p-3">
      <View className="flex-1">
        <Text className="text-sm font-bold text-foreground">{item.line}</Text>
        <Text className="mt-0.5 text-xs text-muted-foreground">
          {item.side === "over" ? "Over" : "Under"} {item.lineValue} · vs{" "}
          {item.opponentName} · {item.huddleName}
        </Text>
      </View>
      <View className="items-end">
        <Text
          className={cn(
            "text-sm font-black",
            item.won ? "text-success" : "text-destructive",
          )}
        >
          {item.won ? "WON" : "LOST"}
        </Text>
        <Text
          className={cn(
            "text-xs font-bold",
            item.delta >= 0 ? "text-success" : "text-destructive",
          )}
        >
          {item.delta >= 0 ? "+" : ""}
          {item.delta}
        </Text>
      </View>
    </View>
  );
}
