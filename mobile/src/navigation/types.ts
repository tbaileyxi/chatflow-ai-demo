import type { NavigatorScreenParams } from "@react-navigation/native";

// Bottom tab screens
export type TabParamList = {
  Home: undefined;
  Ledger: undefined;
  Profile: undefined;
};

// Auth flow screens
export type AuthStackParamList = {
  Welcome: undefined;
  PhoneEntry: undefined;
  OTPVerification: { phone: string };
};

// Root stack (auth-gated)
export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList> | undefined;
  MainTabs: NavigatorScreenParams<TabParamList>;
  Huddle: { huddleId: string };
  HuddleSettings: { huddleId: string };
  HuddleCoachSettings: { huddleId: string };
  JoinHuddle: { huddleId: string };
  HuddleSearch: undefined;
  TeamFeed: { teamId: string };
  Admin: undefined;
  Settings: undefined;
  FAQ: undefined;
  Sponsor: undefined;
  MessagePost: { id: string };
};

// Type helper for useNavigation
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
