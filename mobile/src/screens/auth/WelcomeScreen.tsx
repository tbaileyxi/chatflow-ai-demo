import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
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
        <Text className="text-center text-5xl font-black uppercase tracking-tight text-foreground">
          Side Huddle
        </Text>
        <Text className="mt-4 text-center text-lg leading-7 text-muted-foreground">
          Never watch a game alone.
        </Text>
        <Text className="mt-8 text-center text-[11px] font-black uppercase tracking-[0.2em] text-primary/60">
          Tap anywhere
        </Text>
      </View>

      <View className="px-8 pb-8" pointerEvents="box-none">
        <Button size="lg" onPress={() => navigation.navigate("PhoneEntry")}>
          Get started
        </Button>
      </View>
    </SafeAreaView>
  );
}
