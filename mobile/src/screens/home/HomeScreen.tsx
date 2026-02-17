import { View, Text, ScrollView, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { YourHuddlesSection } from "@/components/home/YourHuddlesSection";
import { DiscoverySection } from "@/components/home/DiscoverySection";
import { Separator } from "@/components/ui/separator";
import { colors } from "@/theme/colors";

export function HomeScreen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ["user-huddles"] });
    await queryClient.invalidateQueries({ queryKey: ["active-huddles"] });
    await queryClient.invalidateQueries({ queryKey: ["discovery-teams"] });
    setRefreshing(false);
  }, [queryClient]);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <ScrollView
        contentContainerClassName="pb-8"
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Header */}
        <View className="px-4 pb-4 pt-2">
          <Text className="text-2xl font-bold text-foreground">
            Side Huddle
          </Text>
          <Text className="text-sm text-muted-foreground">
            All your best team socials. One huddle.
          </Text>
        </View>

        <View className="gap-6 px-4">
          {user && (
            <>
              <YourHuddlesSection />
              <Separator />
            </>
          )}

          <DiscoverySection />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
