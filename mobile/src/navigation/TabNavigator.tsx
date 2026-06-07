import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Home, Newspaper, Search, Target, User } from "lucide-react-native";
import { colors } from "@/theme/colors";
import { HomeScreen } from "@/screens/home/HomeScreen";
import { TeamsScreen } from "@/screens/teams/TeamsScreen";
import { HuddleSearchScreen } from "@/screens/huddle-search/HuddleSearchScreen";
import { LedgerScreen } from "@/screens/ledger/LedgerScreen";
import { ProfileScreen } from "@/screens/profile/ProfileScreen";
import type { TabParamList } from "./types";

const Tab = createBottomTabNavigator<TabParamList>();

export function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          paddingTop: 6,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Teams"
        component={TeamsScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Newspaper color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Search"
        component={HuddleSearchScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Search color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Ledger"
        component={LedgerScreen}
        options={{
          title: "Picks",
          tabBarIcon: ({ color, size }) => (
            <Target color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: "Me",
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
      />
    </Tab.Navigator>
  );
}
