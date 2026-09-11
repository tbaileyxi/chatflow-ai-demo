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
      <RippleMark />

      <View
        className="flex-1 items-center justify-end px-8 pb-4"
        pointerEvents="box-none"
      >
        <Type center variant="eyebrow">
          Side Huddle
        </Type>
        <Type center variant="heading" tone="muted" className="mt-4">
          Never watch a game alone.
        </Type>
        <Type center variant="eyebrow" tone="primary" className="mt-8">
          Tap anywhere
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
