import type { NavigatorScreenParams } from "@react-navigation/native";

// Bottom tab screens
export type TabParamList = {
  Home: undefined;
  Teams: undefined;
  Search: undefined;
  Ledger: { huddleId?: string; huddleName?: string } | undefined;
  Profile: undefined;
};

// Auth flow screens
export type AuthStackParamList = {
  Welcome: undefined;
  PhoneEntry: undefined;
  OTPVerification: {
    phone?: string;
    email?: string;
    method?: "email" | "sms";
    isTestLogin?: boolean;
  };
};

// Root stack (auth-gated)
export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList> | undefined;
  Onboarding: undefined;
  MainTabs: NavigatorScreenParams<TabParamList>;
  Huddle: { huddleId: string };
  EventLobby: { eventId: string };
  HuddleSettings: { huddleId: string };
  HuddleCoachSettings: { huddleId: string };
  JoinHuddle: { huddleId: string };
  HuddleSearch: undefined;
  CreateSideHuddle: { teamId?: string } | undefined;
  Admin: undefined;
  Settings: undefined;
  FAQ: undefined;
  Sponsor: undefined;
  MessagePost: { id: string };
  PublicProfile: { userId: string; knownAs?: string };
};

// Type helper for useNavigation
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
