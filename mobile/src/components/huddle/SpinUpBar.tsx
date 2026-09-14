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
 * ALWAYS AVAILABLE. It used to be hidden unless a friend was already present
 * — a rule I wrote into the design and which does not survive contact: you
 * are in a huddle of forty strangers precisely when you most want your own
 * corner, and that rule stopped you making one to invite people into.
 *
 * The empty-room worry does not transfer either. An empty PUBLIC huddle is
 * bad because nobody ever arrives; a side huddle you make and then invite two
 * people to is just a private huddle, which already works.
 *
 * Friends who ARE here come with you automatically — you spun off because of
 * them, so asking again on the next screen is a form for a decision already
 * made. With nobody here it opens empty and you invite.
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

  const names = friendsHere.slice(0, 2).map((f) => f.displayName.split(/\s+/)[0]);
  // "Spin up a side huddle · just you" read as though the room you are
  // standing in were the thing being made. It is about THIS game.
  const label =
    friendsHere.length === 0
      ? "You · gone at 2am"
      : friendsHere.length > 2
        ? `You + ${names.join(", ")} +${friendsHere.length - 2} here · gone at 2am`
        : `You + ${names.join(" and ")} here · gone at 2am`;

  return (
    <View className="px-4 pb-1 pt-2">
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
            {busy ? "Spinning up…" : "Spin up this game huddle"}
          </Type>
          <Type variant="data" tone="muted" style={{ fontSize: 11, marginTop: 1 }}>
            {/* No invite step. Your presence is the invite — friends see
                where you are on Home and tap in. */}
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
