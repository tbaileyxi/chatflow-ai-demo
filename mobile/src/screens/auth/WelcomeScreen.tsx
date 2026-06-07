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
        <View className="mb-5 h-24 w-24 items-center justify-center rounded-full border border-primary/40 bg-primary">
          <Text className="text-3xl font-black text-primary-foreground">
            SH
          </Text>
        </View>

        <Text className="text-center text-3xl font-black uppercase tracking-wider text-primary">
          Side Huddle Sports
        </Text>

        <Text className="mt-3 text-center text-lg text-muted-foreground">
          Your teams. Your crews. Game night.
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
