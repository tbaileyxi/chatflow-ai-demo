import { useState, useEffect } from "react";
import { View, Text, Pressable } from "react-native";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { Type } from "@/components/ui/Type";
import { supabase } from "@/integrations/supabase/client";
import { colors } from "@/theme/colors";
import { PredictionCard } from "./PredictionCard";

interface PredictionCardInMessageProps {
  content: string;
  huddleId: string;
}

export function PredictionCardInMessage({ content, huddleId }: PredictionCardInMessageProps) {
  const [markets, setMarkets] = useState<any[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const loadMarkets = async () => {
      try {
        const parsed = JSON.parse(content);
        const marketIds = parsed.market_ids || [];

        if (marketIds.length === 0) return;

        const { data } = await supabase
          .from("kalshi_markets")
          .select("*")
          .in("id", marketIds);

        if (data) {
          // Sort: unresolved first, then by event time
          const sorted = data.sort((a, b) => {
            if (a.is_resolved !== b.is_resolved) return a.is_resolved ? 1 : -1;
            return (
              new Date(a.event_start_time ?? 0).getTime() -
              new Date(b.event_start_time ?? 0).getTime()
            );
          });
          setMarkets(sorted);
        }
      } catch {
        // Not valid JSON — ignore
      }
    };

    loadMarkets();
  }, [content]);

  if (markets.length === 0) return null;

  const market = markets[activeIndex];

  return (
    <View className="mt-2">
      <PredictionCard market={market} huddleId={huddleId} />

      {/* Pagination controls */}
      {markets.length > 1 && (
        <View className="mt-1 flex-row items-center justify-center gap-3">
          <Pressable
            onPress={() => setActiveIndex((i) => Math.max(0, i - 1))}
            disabled={activeIndex === 0}
            hitSlop={8}
            style={{ opacity: activeIndex === 0 ? 0.3 : 1 }}
          >
            <ChevronLeft color={colors.mutedForeground} size={16} />
          </Pressable>

          <Type variant="caption" tone="muted">
            {activeIndex + 1} / {markets.length}
          </Type>

          <Pressable
            onPress={() =>
              setActiveIndex((i) => Math.min(markets.length - 1, i + 1))
            }
            disabled={activeIndex === markets.length - 1}
            hitSlop={8}
            style={{ opacity: activeIndex === markets.length - 1 ? 0.3 : 1 }}
          >
            <ChevronRight color={colors.mutedForeground} size={16} />
          </Pressable>
        </View>
      )}
    </View>
  );
}
