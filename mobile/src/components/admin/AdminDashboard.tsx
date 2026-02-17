import { View, Text } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Users, Shield, MessageSquare, Layers } from "lucide-react-native";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { colors } from "@/theme/colors";

type Stats = {
  users: number;
  teams: number;
  huddles: number;
  messages: number;
};

function useAdminStats() {
  return useQuery({
    queryKey: ["admin-stats"],
    queryFn: async (): Promise<Stats> => {
      const [usersRes, teamsRes, huddlesRes] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase
          .from("teams")
          .select("id", { count: "exact", head: true })
          .eq("status", "active"),
        supabase.from("huddles").select("id", { count: "exact", head: true }),
      ]);

      return {
        users: usersRes.count ?? 0,
        teams: teamsRes.count ?? 0,
        huddles: huddlesRes.count ?? 0,
        messages: 0, // Skip expensive count
      };
    },
  });
}

export function AdminDashboard() {
  const { data: stats, isLoading } = useAdminStats();

  if (isLoading) {
    return (
      <View className="gap-3">
        <View className="flex-row gap-3">
          <Skeleton className="h-24 flex-1" />
          <Skeleton className="h-24 flex-1" />
        </View>
        <View className="flex-row gap-3">
          <Skeleton className="h-24 flex-1" />
          <Skeleton className="h-24 flex-1" />
        </View>
      </View>
    );
  }

  return (
    <View className="gap-3">
      <View className="flex-row gap-3">
        <StatCard
          icon={<Users color={colors.secondary} size={20} />}
          label="Users"
          value={stats?.users ?? 0}
        />
        <StatCard
          icon={<Shield color={colors.primary} size={20} />}
          label="Teams"
          value={stats?.teams ?? 0}
        />
      </View>
      <View className="flex-row gap-3">
        <StatCard
          icon={<Layers color={colors.accent} size={20} />}
          label="Huddles"
          value={stats?.huddles ?? 0}
        />
        <StatCard
          icon={<MessageSquare color={colors.success} size={20} />}
          label="Messages"
          value="--"
        />
      </View>
    </View>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
}) {
  return (
    <Card className="flex-1">
      <CardContent className="gap-2 pt-3">
        {icon}
        <Text className="text-2xl font-bold text-foreground">
          {typeof value === "number" ? value.toLocaleString() : value}
        </Text>
        <Text className="text-xs uppercase text-muted-foreground">{label}</Text>
      </CardContent>
    </Card>
  );
}
