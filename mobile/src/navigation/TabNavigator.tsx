import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Home, Radio, Search, User } from "lucide-react-native";
import { colors } from "@/theme/colors";
import { HomeScreen } from "@/screens/home/HomeScreen";
import { GamesScreen } from "@/screens/games/GamesScreen";
import { HuddleSearchScreen } from "@/screens/huddle-search/HuddleSearchScreen";
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
      {/* Games, replacing Teams as of 2026-09-11.
          
          Teams listed your own rooms grouped by team, and Home already does
          that. The one thing that made it distinct was OTHER people's rooms
          for your team — and those were the community rooms we cut, because a
          shelf of empty rooms with team logos on them is the problem the tab
          was meant to solve rather than a solution to it. What was left was a
          second view of Home costing a tab.

          Games carries what exists nowhere else: the whole slate. It is also
          the answer to the complaint this product started from — there are
          games on that aren't your team's, and there was nowhere to go.

          Your teams live on Profile now, as chips with an ＋ Add. */}
      <Tab.Screen
        name="Games"
        component={GamesScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Radio color={color} size={size} />,
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
      {/* Picks tab removed: broken, and structurally wrong even when it
          worked. A pick is an argument you have inside a room while a game is
          on — surfacing it as a separate board pulled people out of the room
          to look at a list of things they'd already said. The card format
          lives in the thread and in the ＋ instead, and your own record moved
          to Profile, which is where a record belongs. */}
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
