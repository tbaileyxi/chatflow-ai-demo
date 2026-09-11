import { View, Text } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Type } from "@/components/ui/Type";
import { Skeleton } from "@/components/ui/skeleton";
import { HuddleCard } from "./HuddleCard";
import { useUserHuddles, type UserHuddle } from "@/hooks/useUserHuddles";

export function YourHuddlesSection() {
  const navigation = useNavigation();
  const { data: huddles, isLoading } = useUserHuddles();

  if (isLoading) {
    return (
      <View className="gap-3">
        <Type variant="heading">Your Huddles</Type>
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
      <Type variant="heading">Your Huddles</Type>

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
      <Type variant="eyebrow" tone="muted" className="tracking-wider">
        {label}
      </Type>
      {huddles.map((h) => (
        <HuddleCard key={h.id} huddle={h} onPress={() => onPress(h)} />
      ))}
    </View>
  );
}
