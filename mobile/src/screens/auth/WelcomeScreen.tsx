import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Type } from "@/components/ui/Type";
import { Button } from "@/components/ui/button";
import { RippleMark } from "@/components/brand/RippleMark";
import type { AuthStackParamList } from "@/navigation/types";

type Nav = NativeStackNavigationProp<AuthStackParamList, "Welcome">;

export function WelcomeScreen() {
  const navigation = useNavigation<Nav>();

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* The mark emits itself here rather than sitting still as a PNG, and a
          tap anywhere fires a ring from your finger. That is the app's core
          gesture, performed before anyone explains what the app is. */}
      <RippleMark onTap={() => navigation.navigate("PhoneEntry")} />

      <View
        className="flex-1 items-center justify-end px-8 pb-4"
        pointerEvents="box-none"
      >
        {/* THE WORDMARK IS THE WORDMARK. This screen had "Side Huddle" set
            as an eyebrow — 14px tracked mono, the same treatment as the word
            "TONIGHT" over a list — with the tagline above it in heading grey.
            The first screen of the app was announcing itself in a caption. */}
        {/* "Join First, Ask Later" draws a 254px screen, so its 35px wordmark
            is 55 here and the tagline's 14 is 22 — see rendering-scale-factors.
            The app-wide `display` size of 41 is the room study's scale and is
            too small for the one screen whose whole job is the name. */}
        <Type
          center
          variant="display"
          numberOfLines={1}
          adjustsFontSizeToFit
          style={{ fontSize: 46, lineHeight: 50 }}
        >
          Side Huddle
        </Type>
        <Type
          center
          variant="body"
          tone="muted"
          className="mt-3"
          style={{ fontSize: 22, lineHeight: 31 }}
        >
          Never watch a game alone.
        </Type>
        {/* It said "Tap anywhere" and nothing happened — the ripple fired
            and that was all, so the one instruction on the first screen of
            the app was false. */}
        <Type center variant="eyebrow" tone="tertiary" className="mt-8">
          Tap anywhere to begin
        </Type>
      </View>

      <View className="px-8 pb-8" pointerEvents="box-none">
        <Button size="lg" onPress={() => navigation.navigate("PhoneEntry")}>
          Get started
        </Button>
      </View>
    </SafeAreaView>
  );
}
