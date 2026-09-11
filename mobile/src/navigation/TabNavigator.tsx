import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Home, Search, Shield, User } from "lucide-react-native";
import { colors } from "@/theme/colors";
import { HomeScreen } from "@/screens/home/HomeScreen";
import { TeamsScreen } from "@/screens/teams/TeamsScreen";
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
      {/* Teams, back as of 2026-09-10 — but NOT the tab that was removed on
          2026-08-13. That one was a news feed, and it was cut for competing
          with the chat instead of feeding it. That reasoning still holds:
          nothing here is a feed.

          This is a directory. Teams you follow, and under each one the rooms
          that exist for it — including the ones you are not in, which is the
          only place in the app you can see those. It exists because following
          became real: `user_follows` is written at onboarding and gates room
          creation, and until now there was no screen to add a team, drop one,
          or even find out which ones you had picked. */}
      <Tab.Screen
        name="Teams"
        component={TeamsScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Shield color={color} size={size} />,
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
