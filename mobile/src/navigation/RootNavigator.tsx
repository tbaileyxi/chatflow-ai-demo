import { View, ActivityIndicator } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "@/hooks/useAuth";
import { colors } from "@/theme/colors";
import { TabNavigator } from "./TabNavigator";
import { AuthNavigator } from "./AuthNavigator";
import { HuddleScreen } from "@/screens/huddle/HuddleScreen";
import { HuddleSettingsScreen } from "@/screens/huddle-settings/HuddleSettingsScreen";
import { HuddleCoachSettingsScreen } from "@/screens/huddle-settings/HuddleCoachSettingsScreen";
import { AdminScreen } from "@/screens/admin/AdminScreen";
import { TeamFeedScreen } from "@/screens/team-feed/TeamFeedScreen";
import { HuddleSearchScreen } from "@/screens/huddle-search/HuddleSearchScreen";
import { JoinHuddleScreen } from "@/screens/join-huddle/JoinHuddleScreen";
import { FAQScreen } from "@/screens/faq/FAQScreen";
import type { RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      {user ? (
        <>
          <Stack.Screen name="MainTabs" component={TabNavigator} />
          <Stack.Screen
            name="Huddle"
            component={HuddleScreen}
            options={{ animation: "slide_from_right" }}
          />
          <Stack.Screen
            name="HuddleSettings"
            component={HuddleSettingsScreen}
            options={{ animation: "slide_from_right" }}
          />
          <Stack.Screen
            name="HuddleCoachSettings"
            component={HuddleCoachSettingsScreen}
            options={{ animation: "slide_from_right" }}
          />
          <Stack.Screen
            name="Admin"
            component={AdminScreen}
            options={{ animation: "slide_from_right" }}
          />
          <Stack.Screen
            name="TeamFeed"
            component={TeamFeedScreen}
            options={{ animation: "slide_from_right" }}
          />
          <Stack.Screen
            name="HuddleSearch"
            component={HuddleSearchScreen}
            options={{ animation: "slide_from_right" }}
          />
          <Stack.Screen
            name="JoinHuddle"
            component={JoinHuddleScreen}
            options={{ animation: "slide_from_right" }}
          />
          <Stack.Screen
            name="FAQ"
            component={FAQScreen}
            options={{ animation: "slide_from_right" }}
          />
        </>
      ) : (
        <Stack.Screen
          name="Auth"
          component={AuthNavigator}
          options={{ animationTypeForReplace: "pop" }}
        />
      )}
    </Stack.Navigator>
  );
}
