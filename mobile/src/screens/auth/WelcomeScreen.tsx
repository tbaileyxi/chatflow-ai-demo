import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Button } from "@/components/ui/button";
import type { AuthStackParamList } from "@/navigation/types";

type Nav = NativeStackNavigationProp<AuthStackParamList, "Welcome">;

export function WelcomeScreen() {
  const navigation = useNavigation<Nav>();

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 items-center justify-center px-8">
        {/* Logo area */}
        <View className="mb-4 h-20 w-20 items-center justify-center rounded-2xl bg-primary">
          <Text className="text-3xl font-bold text-primary-foreground">SH</Text>
        </View>

        <Text className="text-3xl font-bold text-foreground">
          Side Huddle Sports
        </Text>

        <Text className="mt-3 text-center text-lg text-muted-foreground">
          Your team. Your huddle.
        </Text>
      </View>

      <View className="px-8 pb-8">
        <Button size="lg" onPress={() => navigation.navigate("PhoneEntry")}>
          Get Started
        </Button>
      </View>
    </SafeAreaView>
  );
}
