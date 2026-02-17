import { View, Text } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Skeleton } from "@/components/ui/skeleton";
import { HuddleCard } from "./HuddleCard";
import { useUserHuddles, type UserHuddle } from "@/hooks/useUserHuddles";

export function YourHuddlesSection() {
  const navigation = useNavigation();
  const { data: huddles, isLoading } = useUserHuddles();

  if (isLoading) {
    return (
      <View className="gap-3">
        <Text className="text-lg font-bold text-foreground">Your Huddles</Text>
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </View>
    );
  }

  if (!huddles || huddles.length === 0) return null;

  const publicHuddles = huddles.filter((h) => h.isOfficialTeam);
  const hostedHuddles = huddles.filter((h) => !h.isOfficialTeam && h.isVerified);
  const privateHuddles = huddles.filter(
    (h) => !h.isOfficialTeam && !h.isVerified,
  );

  const navigateToHuddle = (huddle: UserHuddle) => {
    navigation.navigate("Huddle", { huddleId: huddle.id });
  };

  return (
    <View className="gap-4">
      <Text className="text-lg font-bold text-foreground">Your Huddles</Text>

      {publicHuddles.length > 0 && (
        <HuddleGroup label="Public" huddles={publicHuddles} onPress={navigateToHuddle} />
      )}
      {hostedHuddles.length > 0 && (
        <HuddleGroup label="Hosted" huddles={hostedHuddles} onPress={navigateToHuddle} />
      )}
      {privateHuddles.length > 0 && (
        <HuddleGroup label="Private" huddles={privateHuddles} onPress={navigateToHuddle} />
      )}
    </View>
  );
}

function HuddleGroup({
  label,
  huddles,
  onPress,
}: {
  label: string;
  huddles: UserHuddle[];
  onPress: (h: UserHuddle) => void;
}) {
  return (
    <View className="gap-2">
      <Text className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </Text>
      {huddles.map((h) => (
        <HuddleCard key={h.id} huddle={h} onPress={() => onPress(h)} />
      ))}
    </View>
  );
}
