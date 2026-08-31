import { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, ActivityIndicator, Alert } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Swords } from "lucide-react-native";
import { cn } from "@/lib/utils";
import { colors } from "@/theme/colors";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { acceptFade, claimFade, type Fade } from "@/hooks/useFades";
import type { FadeMarket } from "@/hooks/useFadeMarkets";

// A fade prop as it lives in chat. Two ways it gets here:
//   • the bot drops an UNCLAIMED prop (real line, no poster) — first tap claims
//     a side, and the card flips in place to "Joe on Over — take Under";
//   • a player posts one from the Fade button (already claimed, poster on a side).
// Either way the second person takes the other side and it locks to Joe vs Chris.
// The line is always the market's — there is nowhere to type your own.

// Default stake for a one-tap claim off a bot card. Player-posted fades still
// choose their stake in the Fade sheet.
const CLAIM_STAKE = 100;

type Payload = {
  // Player-posted card: the fade already exists.
  fade_id?: string;
  // Shared display fields.
  market_id?: string;
  label?: string;
  description?: string;
  over_label?: string;
  under_label?: string;
  line?: number | null;
  poster_side?: "over" | "under";
  poster_name?: string;
  stake?: number;
  // Bot-posted card carries the game so the first tapper can claim a side.
  game?: {
    id: string;
    start_time: string;
    home: string | null;
    away: string | null;
    sport: string;
  };
};

export function FadeCardInMessage({
  content,
  huddleId,
  messageId,
}: {
  content: string;
  huddleId: string;
  messageId: string;
}) {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const payload = useMemo<Payload | null>(() => {
    try {
      return JSON.parse(content) as Payload;
    } catch {
      return null;
    }
  }, [content]);

  // Player-posted cards look the fade up by id; bot cards look it up by the
  // message they were posted as (origin_message_id), so a claim shows in place.
  const byOrigin = !payload?.fade_id;
  const fadeKey = payload?.fade_id ?? messageId;

  const { data: fade } = useQuery({
    queryKey: ["fade-card", fadeKey],
    enabled: !!payload,
    queryFn: async (): Promise<Fade | null> => {
      const q = supabase.from("fades").select("*");
      const { data } = await (byOrigin
        ? q.eq("origin_message_id", messageId)
        : q.eq("id", payload!.fade_id!)
      ).maybeSingle();
      return (data as unknown as Fade) ?? null;
    },
  });

  useEffect(() => {
    if (!payload) return;
    const filter = byOrigin
      ? `origin_message_id=eq.${messageId}`
      : `id=eq.${payload.fade_id}`;
    const ch = supabase
      .channel(`fade-card:${fadeKey}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "fades", filter },
        () => qc.invalidateQueries({ queryKey: ["fade-card", fadeKey] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [payload, byOrigin, messageId, fadeKey, qc]);

  const { data: names } = useQuery({
    queryKey: ["fade-card-names", fade?.poster_id, fade?.accepter_id],
    enabled: !!fade,
    queryFn: async () => {
      const ids = [fade!.poster_id, fade!.accepter_id].filter(Boolean) as string[];
      const { data } = await supabase
        .from("profiles")
        .select("user_id, display_name, username")
        .in("user_id", ids);
      const m: Record<string, string> = {};
      (data ?? []).forEach((p: any) => {
        m[p.user_id] = p.display_name || p.username || "A member";
      });
      return m;
    },
  });

  if (!payload) return null;

  const nameOf = (id: string | null) =>
    !id ? "" : id === user?.id ? "You" : names?.[id] ?? payload.poster_name ?? "A member";

  const overLabel = payload.over_label ?? "Over";
  const underLabel = payload.under_label ?? "Under";
  const posterSide = fade?.fade_type ?? payload.poster_side ?? "over";
  const stake = fade?.stake ?? payload.stake ?? CLAIM_STAKE;

  const isUnclaimed = !fade; // bot card nobody has taken yet
  const isPoster = !!fade && fade.poster_id === user?.id;
  const isLocked = fade?.status === "locked" || !!fade?.accepter_id;
  const isSettled = fade?.status === "settled";
  const openSideLabel = posterSide === "over" ? underLabel : overLabel;

  const asMarket = (): FadeMarket => ({
    marketId: payload.market_id ?? "",
    marketType: "player_prop",
    label: payload.label ?? "",
    line: payload.line ?? null,
    overLabel,
    underLabel,
    description: payload.description ?? payload.label ?? "",
    startTime: payload.game?.start_time ?? new Date().toISOString(),
  });

  // Bot card: first tap claims a side and stakes chips.
  const claim = async (side: "over" | "under") => {
    if (!payload.game || !user) return;
    setBusy(true);
    const res = await claimFade({
      originMessageId: messageId,
      huddleId,
      game: {
        id: payload.game.id,
        startTime: payload.game.start_time,
        homeTeamName: payload.game.home,
        awayTeamName: payload.game.away,
        sportKey: payload.game.sport,
      },
      market: asMarket(),
      side,
      stake: CLAIM_STAKE,
    });
    setBusy(false);
    if (!res.ok) Alert.alert("Couldn't take that side", res.error ?? "Try again.");
    else qc.invalidateQueries({ queryKey: ["fade-card", fadeKey] });
  };

  // Claimed card: take the other side.
  const take = async () => {
    if (!fade || !user) return;
    setBusy(true);
    const res = await acceptFade({
      fade,
      userId: user.id,
      accepterName: profile?.displayName || profile?.username || "You",
      posterName: nameOf(fade.poster_id),
    });
    setBusy(false);
    if (!res.ok) Alert.alert("Couldn't take that side", res.error ?? "Try again.");
    else qc.invalidateQueries({ queryKey: ["fade-card", fadeKey] });
  };

  return (
    <View
      className="rounded-2xl bg-card px-3 py-2.5"
      style={{ borderLeftWidth: 3, borderLeftColor: colors.primary }}
    >
      <View className="flex-row items-center gap-1.5">
        <Swords color={colors.primary} size={14} />
        <Text className="text-xs font-black uppercase tracking-wide text-muted-foreground">
          {isSettled ? "Fade · final" : isLocked ? "Fade · live" : "Fade"}
        </Text>
      </View>

      <Text className="mt-1 text-base font-black text-foreground">
        {payload.label ?? payload.description}
      </Text>
      {payload.description && payload.label ? (
        <Text className="mt-0.5 text-xs text-muted-foreground">{payload.description}</Text>
      ) : null}

      {isUnclaimed ? (
        // Bot prop nobody has taken — both sides open, one tap to claim.
        <View className="mt-2">
          <Text className="mb-1.5 text-xs text-muted-foreground">
            Pick a side · {CLAIM_STAKE} chips
          </Text>
          {/* STACKED, not side by side.
              The card sits in a chat bubble capped at 75% of screen width, so
              two buttons in a row got roughly 120px each — less than "Anything
              less" needs at this weight. React Native then breaks mid-WORD
              rather than mid-line, producing "Anythi / ng less".
              A previous fix added adjustsFontSizeToFit with numberOfLines={2}.
              That cannot work: RN only shrinks text to fit the width when
              numberOfLines is 1, so with 2 it wraps first and the shrink never
              engages — which is why the bug survived a commit named after it.
              Stacking gives each label the card's full width, so there is
              nothing to break. numberOfLines={1} keeps it honest. */}
          <View className="gap-2">
            {(["over", "under"] as const).map((s) => (
              <Pressable
                key={s}
                disabled={busy || !payload.game}
                onPress={() => claim(s)}
                className={cn(
                  "w-full items-center rounded-xl border px-3 py-2.5",
                  busy || !payload.game
                    ? "border-border bg-muted/40"
                    : "border-success bg-success/15",
                )}
              >
                {busy ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text
                    className="text-sm font-black text-success"
                    numberOfLines={1}
                    style={{ textAlign: "center" }}
                  >
                    {s === "over" ? overLabel : underLabel}
                  </Text>
                )}
              </Pressable>
            ))}
          </View>
        </View>
      ) : isLocked || isSettled ? (
        // Head-to-head: who took which side, and what's in the pot.
        <View className="mt-2 rounded-xl border border-border bg-muted/30 px-3 py-2">
          <Text className="text-sm font-bold text-foreground">
            {nameOf(fade!.poster_id)} {posterSide === "over" ? overLabel : underLabel}
            {"  vs  "}
            {nameOf(fade!.accepter_id)} {posterSide === "over" ? underLabel : overLabel}
          </Text>
          <Text className="mt-0.5 text-xs text-muted-foreground">
            {isSettled && fade!.winner_id
              ? `${nameOf(fade!.winner_id)} won ${stake * 2} chips`
              : `${stake * 2} chip pot · settles when the game finals`}
          </Text>
        </View>
      ) : (
        // Claimed, still open — one side taken, the other is up for grabs.
        <View className="mt-2">
          <Text className="mb-1.5 text-xs text-muted-foreground">
            {/* Name the EVENT, not the mechanic. "waiting for someone to fade
                you" describes plumbing; "JOE took the Over" is what happened. */}
            {isPoster
              ? `You took ${posterSide === "over" ? overLabel : underLabel}. Nobody's taken the other side yet.`
              : `${nameOf(fade!.poster_id)} took ${posterSide === "over" ? overLabel : underLabel}`}
          </Text>
          <Pressable
            disabled={isPoster || busy}
            onPress={take}
            className={cn(
              "flex-row items-center justify-center rounded-xl border px-3 py-2.5",
              isPoster ? "border-border bg-muted/40" : "border-success bg-success/15",
            )}
          >
            {busy ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text
                className={cn(
                  "text-sm font-black",
                  isPoster ? "text-muted-foreground" : "text-success",
                )}
              >
                {isPoster ? "Waiting on a taker" : `Take the other side · ${openSideLabel}`}
              </Text>
            )}
          </Pressable>
        </View>
      )}
    </View>
  );
}
