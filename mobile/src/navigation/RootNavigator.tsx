import { useEffect, useRef } from "react";
import { View, ActivityIndicator } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useNotifications } from "@/hooks/useNotifications";
import {
  useInviteHandler,
  takePendingInvite,
  consumeInvite,
} from "@/hooks/useInviteHandler";
import { ensureConfigured as configureRevenueCat } from "@/lib/revenuecat";
import { colors } from "@/theme/colors";
import { TabNavigator } from "./TabNavigator";
import { AuthNavigator } from "./AuthNavigator";
import { OnboardingScreen } from "@/screens/onboarding/OnboardingScreen";
import { HuddleScreen } from "@/screens/huddle/HuddleScreen";
import { HuddleSettingsScreen } from "@/screens/huddle-settings/HuddleSettingsScreen";
import { HuddleCoachSettingsScreen } from "@/screens/huddle-settings/HuddleCoachSettingsScreen";
import { AdminScreen } from "@/screens/admin/AdminScreen";
import { EventLobbyScreen } from "@/screens/event-lobby/EventLobbyScreen";
import { HuddleSearchScreen } from "@/screens/huddle-search/HuddleSearchScreen";
import { JoinHuddleScreen } from "@/screens/join-huddle/JoinHuddleScreen";
import { CreateSideHuddleScreen } from "@/screens/create-side-huddle/CreateSideHuddleScreen";
import { FAQScreen } from "@/screens/faq/FAQScreen";
import type { RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { user, loading } = useAuth();
  const { data: profile, isLoading: profileLoading } = useProfile();
  useNotifications();         // push tokens + notification taps
  useInviteHandler();         // parses sidehuddle://i/{code} URLs, defers if unauthed

  // Re-identify RevenueCat once the auth user is known so receipts attribute correctly.
  useEffect(() => {
    if (user?.id) configureRevenueCat(user.id).catch(() => {});
  }, [user?.id]);
  const isDevTestUser = user?.app_metadata?.provider === "dev_test";

  // After the user is fully authed AND past onboarding, drain any pending invite
  // (stored when an unauthenticated user tapped a deep link).
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const consumedRef = useRef(false);
  useEffect(() => {
    if (!user) return;
    if (loading || profileLoading) return;
    const onboarded = isDevTestUser
      ? user.user_metadata?.onboarding_completed === true
      : profile?.onboardingCompleted === true;
    if (!onboarded || consumedRef.current) return;
    consumedRef.current = true;
    (async () => {
      const code = await takePendingInvite();
      if (code) await consumeInvite(code, navigation);
    })();
  }, [user, loading, profileLoading, profile, isDevTestUser, navigation]);

  if (loading || (user && !isDevTestUser && profileLoading)) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const needsOnboarding =
    user &&
    (isDevTestUser
      ? user.user_metadata?.onboarding_completed !== true
      : !profile?.onboardingCompleted);

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      {!user ? (
        <Stack.Screen
          name="Auth"
          component={AuthNavigator}
          options={{ animationTypeForReplace: "pop" }}
        />
      ) : needsOnboarding ? (
        <Stack.Screen
          name="Onboarding"
          component={OnboardingScreen}
          options={{ animation: "fade" }}
        />
      ) : (
        <>
          <Stack.Screen name="MainTabs" component={TabNavigator} />
          <Stack.Screen
            name="Huddle"
            component={HuddleScreen}
            options={{ animation: "slide_from_right" }}
          />
          <Stack.Screen
            name="EventLobby"
            component={EventLobbyScreen}
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
            name="CreateSideHuddle"
            component={CreateSideHuddleScreen}
            options={{ animation: "slide_from_bottom" }}
          />
          <Stack.Screen
            name="FAQ"
            component={FAQScreen}
            options={{ animation: "slide_from_right" }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}
