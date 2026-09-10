import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Home, Search, User } from "lucide-react-native";
import { colors } from "@/theme/colors";
import { HomeScreen } from "@/screens/home/HomeScreen";
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
      {/* Teams tab removed 2026-08-13: a second feed competing with the chat
          rather than feeding it, and a team's content already arrives in that
          team's room. Your Picks board now derives its teams from the rooms
          you are in, so the separate follow list went with it. */}
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
