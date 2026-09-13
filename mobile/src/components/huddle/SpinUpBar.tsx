import { useState } from "react";
import { Pressable, View } from "react-native";
import { Type } from "@/components/ui/Type";
import { personColor } from "@/lib/personColor";
import { spinUpSideHuddle } from "@/lib/gameRoom";
import { colors } from "@/theme/colors";

type Person = { userId: string; displayName: string };

/**
 * Pull a few people out of a public game huddle into one of your own.
 *
 * IT ONLY APPEARS WHEN SOMEBODY YOU KNOW IS IN HERE. With nobody you know
 * there is nothing to spin off, and a button offering it anyway is a button
 * that makes an empty room — which is the failure mode this whole idea exists
 * to avoid.
 *
 * They come with you automatically. You spun off BECAUSE of them, so asking
 * again on the next screen is a form for a decision already made.
 */
export function SpinUpBar({
  gameId,
  friendsHere,
  navigation,
}: {
  gameId: string;
  friendsHere: Person[];
  navigation: any;
}) {
  const [busy, setBusy] = useState(false);
  if (friendsHere.length === 0) return null;

  const names = friendsHere.slice(0, 2).map((f) => f.displayName.split(/\s+/)[0]);
  const label =
    friendsHere.length > 2
      ? `${names.join(", ")} +${friendsHere.length - 2} come with you`
      : `${names.join(" and ")} come${names.length === 1 ? "s" : ""} with you`;

  return (
    <View className="px-3 pb-2 pt-2.5">
      <Pressable
        disabled={busy}
        onPress={async () => {
          setBusy(true);
          await spinUpSideHuddle(gameId, friendsHere.map((f) => f.userId), navigation);
          setBusy(false);
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
        <View className="flex-row">
          {friendsHere.slice(0, 3).map((f, i) => (
            <View
              key={f.userId}
              className="h-[22px] w-[22px] items-center justify-center rounded-full"
              style={{
                backgroundColor: personColor(f.userId),
                borderWidth: 1.5,
                borderColor: colors.huddleGround,
                marginLeft: i === 0 ? 0 : -7,
              }}
            >
              <Type variant="data" style={{ color: "#000", fontSize: 9 }}>
                {f.displayName.slice(0, 1).toUpperCase()}
              </Type>
            </View>
          ))}
        </View>

        <View className="min-w-0 flex-1">
          <Type variant="captionStrong" tone="primary" style={{ fontSize: 14 }}>
            {busy ? "Spinning up…" : "Spin up a side huddle"}
          </Type>
          <Type variant="data" tone="muted" style={{ fontSize: 11, marginTop: 1 }}>
            {label} · gone at 2am
          </Type>
        </View>

        <Type variant="captionStrong" tone="primary" style={{ fontSize: 19 }}>
          ＋
        </Type>
      </Pressable>
    </View>
  );
}
