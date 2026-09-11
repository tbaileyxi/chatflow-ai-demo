import { useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { ChevronLeft, LayoutDashboard, Users, Radio } from "lucide-react-native";
import { Type } from "@/components/ui/Type";
import { useAuth } from "@/hooks/useAuth";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { UserManagement } from "@/components/admin/UserManagement";
import { BroadcastCenter } from "@/components/admin/BroadcastCenter";
import { cn } from "@/lib/utils";
import { colors } from "@/theme/colors";

const TABS = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, adminOnly: true },
  { key: "users", label: "Users", icon: Users, adminOnly: true },
  { key: "broadcast", label: "Broadcast", icon: Radio, adminOnly: false },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function AdminScreen() {
  const navigation = useNavigation();
  const { isAdmin, isContentAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>(
    isAdmin ? "dashboard" : "broadcast",
  );

  const visibleTabs = TABS.filter(
    (t) => !t.adminOnly || isAdmin,
  );

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center gap-3 px-4 py-3">
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <ChevronLeft color={colors.foreground} size={24} />
        </Pressable>
        <Type variant="heading" className="flex-1">
          Admin Panel
        </Type>
      </View>

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View className="flex-row gap-1 px-4 pb-3">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                className={cn(
                  "flex-row items-center gap-1.5 rounded-full px-4 py-2",
                  active ? "bg-primary" : "bg-muted",
                )}
              >
                <Icon
                  color={active ? colors.primaryForeground : colors.mutedForeground}
                  size={16}
                />
                <Text
                  className={cn(
                    "text-sm font-medium",
                    active ? "text-primary-foreground" : "text-muted-foreground",
                  )}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {/* Content */}
      <View className="flex-1 px-4">
        {activeTab === "dashboard" && (
          <ScrollView contentContainerClassName="pb-8">
            <AdminDashboard />
          </ScrollView>
        )}
        {activeTab === "users" && <UserManagement />}
        {activeTab === "broadcast" && (
          <ScrollView contentContainerClassName="pb-8">
            <BroadcastCenter />
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}
