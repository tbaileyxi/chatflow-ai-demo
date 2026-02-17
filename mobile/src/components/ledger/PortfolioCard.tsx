import { View, Text } from "react-native";
import { Coins, TrendingUp, TrendingDown } from "lucide-react-native";
import { Card, CardContent } from "@/components/ui/card";
import { colors } from "@/theme/colors";
import type { Portfolio } from "@/hooks/usePortfolio";

type Props = {
  portfolio: Portfolio;
};

export function PortfolioCard({ portfolio }: Props) {
  const isPositive = portfolio.profitLoss >= 0;

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="gap-4 pt-4">
        <View className="flex-row items-center gap-2">
          <Coins color={colors.primary} size={20} />
          <Text className="text-lg font-bold text-foreground">Portfolio</Text>
        </View>

        <View className="flex-row flex-wrap">
          <StatBox
            label="Chips"
            value={`${portfolio.totalChips.toLocaleString()}¢`}
            color={colors.foreground}
          />
          <StatBox
            label="P/L"
            value={`${isPositive ? "+" : ""}${portfolio.profitLoss.toLocaleString()}¢`}
            color={isPositive ? colors.success : colors.destructive}
            icon={
              isPositive ? (
                <TrendingUp color={colors.success} size={14} />
              ) : (
                <TrendingDown color={colors.destructive} size={14} />
              )
            }
          />
          <StatBox
            label="Win Rate"
            value={`${portfolio.winRate.toFixed(0)}%`}
            color={colors.foreground}
          />
          <StatBox
            label="Total Bets"
            value={`${portfolio.totalBets}`}
            color={colors.foreground}
          />
        </View>
      </CardContent>
    </Card>
  );
}

function StatBox({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: string;
  color: string;
  icon?: React.ReactNode;
}) {
  return (
    <View className="w-1/2 gap-0.5 py-1">
      <Text className="text-xs uppercase text-muted-foreground">{label}</Text>
      <View className="flex-row items-center gap-1">
        <Text className="text-xl font-bold" style={{ color }}>
          {value}
        </Text>
        {icon}
      </View>
    </View>
  );
}
