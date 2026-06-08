import { View, Text, Image } from "react-native";
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
        <Image
          source={require("../../../assets/sh-logo-master.png")}
          style={{ width: 112, height: 112, marginBottom: 20, borderRadius: 56 }}
          resizeMode="cover"
        />

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
