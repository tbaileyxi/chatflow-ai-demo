import React, { useEffect } from "react";
import {
  NavigationContainer,
  DefaultTheme,
  LinkingOptions,
  getStateFromPath as getStateFromPathDefault,
} from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as Linking from "expo-linking";
import { AuthProvider } from "@/hooks/useAuth";
import { GlobalPresenceProvider } from "@/contexts/GlobalPresenceContext";
import { ensureConfigured as configureRevenueCat } from "@/lib/revenuecat";
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
  // https prefixes are what make Universal Links land in the app. Without them
  // iOS opens Safari even when the AASA file and the entitlement are both
  // correct, which is the state this was in: a shared room link showed a
  // "Download on the App Store" button to someone who already had the app.
  prefixes: [
    Linking.createURL("/"),
    "sidehuddle://",
    "https://www.sidehuddlesports.com",
    "https://sidehuddlesports.com",
  ],
  // The web uses short paths (/h/:id for a room, /i/:code for an invite) while
  // the screens are registered under longer ones. Normalise before the default
  // parser runs, so both the website links and the custom scheme keep working.
  getStateFromPath: (path, options) => {
    const rewritten = path
      .replace(/^\/h\//, "/huddle/")
      .replace(/^\/picks\//, "/message/");
    return getStateFromPathDefault(rewritten, options);
  },
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
      EventLobby: "events/:eventId",
      HuddleSettings: "huddle/:huddleId/settings",
      HuddleCoachSettings: "huddle/:huddleId/coach-settings",
      JoinHuddle: "join-huddle/:huddleId",
      HuddleSearch: "huddle-search",
      CreateSideHuddle: "create-side-huddle/:teamId?",
      Onboarding: "onboarding",
      Admin: "admin",
      Settings: "settings",
      FAQ: "faq",
      Sponsor: "sponsor",
      MessagePost: "message/:id",
    },
  },
};

export function AppProviders({ children }: { children: React.ReactNode }) {
  // Configure RevenueCat once at startup.  Anonymous identity initially;
  // useAuth-side hook re-identifies once the user is known.
  useEffect(() => {
    configureRevenueCat().catch((err) =>
      console.warn("[providers] RevenueCat init failed", err),
    );
  }, []);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <GlobalPresenceProvider>
            <NavigationContainer theme={navTheme} linking={linking}>
              {children}
            </NavigationContainer>
          </GlobalPresenceProvider>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
