import React from "react";
import {
  NavigationContainer,
  DefaultTheme,
  LinkingOptions,
} from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as Linking from "expo-linking";
import { AuthProvider } from "@/hooks/useAuth";
import { colors } from "@/theme/colors";
import type { RootStackParamList } from "@/navigation/types";

const queryClient = new QueryClient();

const navTheme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    background: colors.background,
    card: colors.background,
    text: colors.foreground,
    border: colors.border,
    notification: colors.destructive,
  },
};

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [Linking.createURL("/"), "sidehuddle://"],
  config: {
    screens: {
      MainTabs: {
        screens: {
          Home: "",
          Ledger: "ledger",
          Profile: "profile",
        },
      },
      Auth: "auth",
      Huddle: "huddle/:huddleId",
      HuddleSettings: "huddle/:huddleId/settings",
      HuddleCoachSettings: "huddle/:huddleId/coach-settings",
      JoinHuddle: "join-huddle/:huddleId",
      HuddleSearch: "huddle-search",
      TeamFeed: "teams/:teamId",
      Admin: "admin",
      Settings: "settings",
      FAQ: "faq",
      Sponsor: "sponsor",
      MessagePost: "message/:id",
    },
  },
};

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <NavigationContainer theme={navTheme} linking={linking}>
            {children}
          </NavigationContainer>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
