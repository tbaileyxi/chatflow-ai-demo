import type { NavigatorScreenParams } from "@react-navigation/native";

// Bottom tab screens
// Three tabs. Picks lost its slot: it's something you do inside a room, not a
// reason to open the app, and putting it in the tab bar pulled people OUT of
// the room to look at a list. The screen still exists — it's pushed from
// Profile now, where your own record belongs.
export type TabParamList = {
  Home: undefined;
  Search: undefined;
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
  Ledger: { huddleId?: string; huddleName?: string } | undefined;
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
