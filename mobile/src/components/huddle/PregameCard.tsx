import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { X } from "lucide-react-native";
import { Type } from "@/components/ui/Type";
import { colors } from "@/theme/colors";

/**
 * The founding partner's one moment: a card in the room before kickoff.
 *
 * Dismissible PER USER — the X hides it for the person who tapped it and
 * nobody else, because one person not wanting it is not the room deciding.
 * Stored locally rather than on the message: whose card is hidden is not worth
 * a write, and a dismissal that syncs across devices is not worth a table.
 *
 * The "powered by" line renders only when the payload carries a partner. No
 * partner, no line, same card.
 *
 * NO TEAM LOGOS. Colour blocks and the city abbreviation, which are ours.
 */

export type PregameCardData = {
  kind: "pregame_card";
  week: string | null;
  kickoff: string;
  home: { abbr: string; name: string };
  away: { abbr: string; name: string };
  spread: string | null;
  total: string | null;
  hype: string | null;
  poweredBy: string | null;
};

export function parsePregameCard(content: string): PregameCardData | null {
  try {
    const parsed = JSON.parse(content);
    return parsed?.kind === "pregame_card" ? (parsed as PregameCardData) : null;
  } catch {
    return null;
  }
}

export function PregameCard({ data, messageId }: { data: PregameCardData; messageId: string }) {
  const key = `pregame-card-dismissed:${messageId}`;
  const [hidden, setHidden] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const seen = await AsyncStorage.getItem(key);
        if (!cancelled) setHidden(!!seen);
      } catch {
        // A card that will not hide is better than a room that will not render.
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, [key]);

  if (!ready || hidden) return null;

  const dismiss = async () => {
    setHidden(true);
    try { await AsyncStorage.setItem(key, "1"); } catch { /* it stays hidden for this session either way */ }
  };

  return (
    // A CARD WITH DIMENSION, not a rectangle with a hairline.
    //
    // It sits above the conversation rather than in it: raised off the
    // background with a shadow, a gold rule across the top so it reads as the
    // room's own furniture, and a darker plate behind the matchup so the
    // teams have a surface of their own instead of floating in the fill.
    <View
      className="mx-3 my-3 overflow-hidden rounded-2xl"
      style={{
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.10)",
        shadowColor: "#000",
        shadowOpacity: 0.45,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
        elevation: 8,
      }}
    >
      <View style={{ height: 3, backgroundColor: colors.primary }} />
      <View className="flex-row items-center gap-2 px-4 pt-3">
        {data.week ? (
          <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: colors.muted }}>
            <Type variant="data" tone="muted" style={{ fontSize: 10, letterSpacing: 1 }}>
              {data.week.toUpperCase()}
            </Type>
          </View>
        ) : null}
        <Type variant="data" tone="muted" style={{ fontSize: 11 }}>
          {data.kickoff} ET
        </Type>
        <Pressable onPress={dismiss} hitSlop={10} className="ml-auto p-1 active:opacity-60">
          <X color={colors.mutedForeground} size={14} />
        </Pressable>
      </View>

      {/* The matchup: two color blocks with abbreviations, and the plain
          names under them so nobody has to decode CLE. On its own plate, so
          it reads as the scoreboard part of the card. */}
      <View
        className="mx-3 mb-3 mt-1 flex-row items-center gap-3 rounded-xl px-3 py-3"
        style={{ backgroundColor: "rgba(0,0,0,0.35)" }}
      >
        <MatchupSide abbr={data.away.abbr} name={data.away.name} />
        <Type variant="data" tone="muted" style={{ fontSize: 11 }}>at</Type>
        <MatchupSide abbr={data.home.abbr} name={data.home.name} />
      </View>

      {data.spread || data.total ? (
        <View className="flex-row flex-wrap gap-x-4 px-4 pb-1">
          {data.spread ? (
            <Type variant="data" tone="muted" style={{ fontSize: 11 }}>{data.spread}</Type>
          ) : null}
          {data.total ? (
            <Type variant="data" tone="muted" style={{ fontSize: 11 }}>{data.total}</Type>
          ) : null}
        </View>
      ) : null}

      {data.hype ? (
        <Type variant="caption" className="px-4 pb-3 pt-1">{data.hype}</Type>
      ) : null}

      {/* THE ONE SPONSOR LINE. Small, at the bottom, no link, no button —
          the card lives in chat and does not send anyone anywhere. */}
      {data.poweredBy ? (
        <View
          className="border-t px-4 py-2"
          style={{ borderColor: colors.border }}
        >
          <Type variant="data" tone="muted" style={{ fontSize: 10, letterSpacing: 0.6 }}>
            powered by {data.poweredBy}
          </Type>
        </View>
      ) : null}
    </View>
  );
}

function MatchupSide({ abbr, name }: { abbr: string; name: string }) {
  return (
    <View className="flex-1 flex-row items-center gap-2">
      <View
        className="h-11 w-11 items-center justify-center rounded-lg"
        style={{
          backgroundColor: colors.muted,
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.08)",
        }}
      >
        <Type variant="data" style={{ fontSize: 14, color: colors.foreground }}>{abbr}</Type>
      </View>
      <Type variant="captionStrong" numberOfLines={1} className="shrink">{name}</Type>
    </View>
  );
}
