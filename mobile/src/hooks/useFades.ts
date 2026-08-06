// Fades in a huddle — the peer-to-peer "take the other side" props.
// Realtime list + post/accept actions that also drop a chat message so the
// action shows up in the room ("Joe took UNDER 8.5 — take the other side").

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { GameContext } from "@/hooks/useLiveGameContext";
import type { FadeMarket } from "@/hooks/useFadeMarkets";

export type Fade = {
  id: string;
  huddle_id: string;
  poster_id: string;
  accepter_id: string | null;
  game_id: string;
  home_team: string;
  away_team: string;
  fade_type: "over" | "under";
  total_target: "game" | "home" | "away";
  line_value: number;
  line_description: string;
  market_id: string | null;
  stake: number;
  status: "open" | "locked" | "expired" | "settled";
  winner_id: string | null;
  created_at: string;
};

export function useFades(huddleId: string) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["fades", huddleId],
    enabled: !!huddleId,
    queryFn: async (): Promise<Fade[]> => {
      const { data } = await supabase
        .from("fades")
        .select("*")
        .eq("huddle_id", huddleId)
        .in("status", ["open", "locked"])
        .order("created_at", { ascending: false });
      return ((data ?? []) as unknown) as Fade[];
    },
  });

  // Refresh on any fade change in this huddle.
  useEffect(() => {
    if (!huddleId) return;
    const ch = supabase
      .channel(`fades:${huddleId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "fades", filter: `huddle_id=eq.${huddleId}` },
        () => qc.invalidateQueries({ queryKey: ["fades", huddleId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [huddleId, qc]);

  return query;
}

// Strip the OUT_OF_CHIPS: prefix the RPC uses so the toast reads cleanly.
function humanize(msg: string): string {
  return msg.replace(/^OUT_OF_CHIPS:/, "");
}

export async function postFade(params: {
  huddleId: string;
  userId: string;
  posterName: string;
  game: GameContext;
  market: FadeMarket;
  side: "over" | "under";
  stake: number;
}): Promise<{ ok: boolean; error?: string }> {
  const { market } = params;
  const { data, error } = await (supabase.rpc as any)("post_fade", {
    p_huddle_id: params.huddleId,
    p_game_id: params.game.id,
    p_game_commence_time: params.game.startTime,
    p_home_team: params.game.homeTeamName ?? "Home",
    p_away_team: params.game.awayTeamName ?? "Away",
    p_sport: params.game.sportKey,
    p_fade_type: params.side,
    // The line is the market's, never a number the poster typed.
    p_line_value: market.line ?? 0,
    p_line_description: market.description,
    p_stake: params.stake,
    p_total_target: "game",
    p_market_id: market.marketId,
  });
  if (error) return { ok: false, error: humanize(error.message) };

  // Post the prop as a live card, not a sentence. The card is how the other
  // side gets taken — it renders both sides and updates in place to "Joe vs
  // Chris" the moment someone fades it.
  const fadeId = (data as any)?.fade_id;
  await supabase.from("huddle_messages").insert({
    huddle_id: params.huddleId,
    user_id: params.userId,
    content: JSON.stringify({
      fade_id: fadeId,
      market_id: market.marketId,
      label: market.label,
      description: market.description,
      over_label: market.overLabel,
      under_label: market.underLabel,
      poster_side: params.side,
      poster_name: params.posterName,
      stake: params.stake,
    }),
    message_type: "fade_prop",
  });
  return { ok: true };
}

// Claim a bot-posted prop card in place: the tapper picks a side and becomes the
// poster on the card that's already in chat. No new message — the card links to
// the fade via origin_message_id and flips to "Joe on Over — take Under". The
// second person then takes the other side with acceptFade.
export async function claimFade(params: {
  originMessageId: string;
  huddleId: string;
  game: {
    id: string;
    startTime: string;
    homeTeamName: string | null;
    awayTeamName: string | null;
    sportKey: string;
  };
  market: FadeMarket;
  side: "over" | "under";
  stake: number;
}): Promise<{ ok: boolean; error?: string }> {
  const { market, game } = params;
  const { error } = await (supabase.rpc as any)("post_fade", {
    p_huddle_id: params.huddleId,
    p_game_id: game.id,
    p_game_commence_time: game.startTime,
    p_home_team: game.homeTeamName ?? "Home",
    p_away_team: game.awayTeamName ?? "Away",
    p_sport: game.sportKey,
    p_fade_type: params.side,
    p_line_value: market.line ?? 0,
    p_line_description: market.description,
    p_stake: params.stake,
    p_total_target: "game",
    p_market_id: market.marketId,
    p_origin_message_id: params.originMessageId,
  });
  if (error) return { ok: false, error: humanize(error.message) };
  return { ok: true };
}

export async function acceptFade(params: {
  fade: Fade;
  userId: string;
  accepterName: string;
  posterName: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { fade } = params;
  const { error } = await (supabase.rpc as any)("accept_fade", { p_fade_id: fade.id });
  if (error) return { ok: false, error: humanize(error.message) };

  const posterSide = fade.fade_type === "over" ? "OVER" : "UNDER";
  await supabase.from("huddle_messages").insert({
    huddle_id: fade.huddle_id,
    user_id: params.userId,
    content: `🔒 I faded ${params.posterName} — ${fade.line_description} (${posterSide} ${fade.line_value}) is LIVE. ${fade.stake * 2} chip pot.`,
    message_type: "fade",
  });
  return { ok: true };
}
