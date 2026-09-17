import { useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { Type } from "@/components/ui/Type";
import { colors } from "@/theme/colors";
import { personColor } from "@/lib/personColor";
import { createTeamHuddle } from "@/lib/teamHuddle";

type Friend = { userId: string; displayName: string };

/**
 * The way out of the community room.
 *
 * The community room is where everybody lands, which is its job and also its
 * limit: it is the one room on the team that is full of people you don't know.
 * This is the door to the version with your people in it, and it sits under
 * the faces because it is about those faces.
 *
 * No form. The team is already decided by being in this room and the name
 * comes from theirs — a naming step here is a toll booth in front of the one
 * action this screen exists to offer.
 */
export function CommunitySpinUpBar({
  userId,
  teamId,
  teamName,
  displayName,
  friendsHere,
  navigation,
}: {
  userId: string;
  teamId: string;
  teamName: string | null;
  displayName: string | null;
  friendsHere: Friend[];
  navigation: { navigate: (screen: string, params?: any) => void };
}) {
  const [busy, setBusy] = useState(false);

  const label =
    friendsHere.length === 0
      ? "Just you in here so far"
      : friendsHere.length === 1
        ? `${friendsHere[0].displayName} is here too`
        : `${friendsHere.length} people you know are here`;

  return (
    <View className="border-b border-border px-4 py-2.5">
      {friendsHere.length > 0 ? (
        <View className="mb-2 flex-row items-center">
          {friendsHere.slice(0, 6).map((f, i) => (
            <View
              key={f.userId}
              className="h-[26px] w-[26px] items-center justify-center rounded-full"
              style={{
                backgroundColor: personColor(f.userId),
                borderWidth: 2,
                // Lit: a ring means they are in this room at this second, not
                // that they opened the app on Tuesday.
                borderColor: colors.success,
                marginLeft: i === 0 ? 0 : -8,
              }}
            >
              <Type variant="data" style={{ color: "#000", fontSize: 10 }}>
                {f.displayName.slice(0, 1).toUpperCase()}
              </Type>
            </View>
          ))}
        </View>
      ) : null}

      <Pressable
        disabled={busy}
        onPress={async () => {
          setBusy(true);
          const id = await createTeamHuddle({
            userId,
            teamId,
            teamName,
            displayName,
          });
          setBusy(false);
          if (!id) {
            Alert.alert("Couldn't spin that up", "Try again in a moment.");
            return;
          }
          navigation.navigate("Huddle", { huddleId: id });
        }}
        className="flex-row items-center gap-2.5 rounded-[22px] px-3 py-2.5 active:opacity-80"
        style={{
          backgroundColor: "rgba(245,197,24,0.10)",
          borderWidth: 1,
          borderStyle: "dashed",
          borderColor: "rgba(245,197,24,0.55)",
          opacity: busy ? 0.6 : 1,
        }}
      >
        <View className="min-w-0 flex-1">
          <Type variant="captionStrong" tone="primary" style={{ fontSize: 14 }}>
            {busy ? "Spinning up…" : "Spin up your Friends Huddle"}
          </Type>
          <Type variant="data" tone="muted" style={{ fontSize: 11, marginTop: 1 }}>
            {label} · same feed, just your crew
          </Type>
        </View>
      </Pressable>
    </View>
  );
}
