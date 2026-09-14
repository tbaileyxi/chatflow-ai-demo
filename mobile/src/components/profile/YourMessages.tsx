import { useMemo } from "react";
import { Image, Pressable, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { MessageCircle } from "lucide-react-native";
import { SectionLabel, Type } from "@/components/ui/Type";
import { useUserHuddles } from "@/hooks/useUserHuddles";
import { useDmCounterparts } from "@/hooks/useDmCounterpart";
import { personName } from "@/lib/personName";
import { personColor } from "@/lib/personColor";
import { colors } from "@/theme/colors";
import { cardStyle } from "@/theme/cardStyle";

/**
 * Your direct threads.
 *
 * A DM is a huddle with two people in it, and it is deliberately kept OUT of
 * Your Huddles — a thread with one person is not a room, and mixing them turns
 * that list into an inbox. But it has to live somewhere, or a message arrives
 * and is simply lost.
 *
 * Here, on your own profile, with an unread count. Not a fifth tab: the volume
 * does not justify one, and a tab that is usually empty teaches people to
 * ignore it.
 *
 * TWO UNANSWERED ONES JUST SIT THERE. A DM is a thread, not a request — it
 * waits, and nothing nags.
 */
export function YourMessages() {
  const navigation = useNavigation<any>();
  const { data: huddles } = useUserHuddles();

  const dms = useMemo(
    () =>
      (huddles ?? [])
        .filter((h) => h.isDm)
        .sort(
          (a, b) =>
            new Date(b.lastMessageAt ?? 0).getTime() -
            new Date(a.lastMessageAt ?? 0).getTime(),
        ),
    [huddles],
  );

  // The stored huddle name is the other person's name FROM THE CREATOR'S SIDE,
  // so the recipient saw a thread named after themselves. Resolved per viewer.
  const others = useDmCounterparts(dms.map((d) => d.id));

  if (dms.length === 0) return null;

  const unread = dms.filter((d) => d.hasUnread).length;

  return (
    <View className="px-4">
      <SectionLabel
        icon={<MessageCircle color={colors.primary} size={18} />}
        count={unread > 0 ? `${unread} new` : undefined}
      >
        Messages
      </SectionLabel>

      {dms.map((d) => {
        const who = others.get(d.id);
        // Their name in YOUR phone first, exactly as everywhere else. Falls
        // back to the stored huddle name for a thread whose other member is
        // gone.
        const title = who ? personName(who) : d.name;
        return (
        <Pressable
          key={d.id}
          onPress={() => navigation.navigate("Huddle", { huddleId: d.id })}
          className="mb-2 flex-row items-center gap-3 rounded-[14px] px-3 py-2.5 active:opacity-80"
          style={cardStyle("quiet")}
        >
          <View
            className="h-[38px] w-[38px] items-center justify-center overflow-hidden rounded-full"
            style={{ backgroundColor: personColor(d.id) }}
          >
            {who?.avatarUrl ? (
              <Image source={{ uri: who.avatarUrl }} className="h-full w-full" />
            ) : (
              <Type variant="data" style={{ color: "#000", fontSize: 14 }}>
                {title.slice(0, 1).toUpperCase()}
              </Type>
            )}
          </View>

          <View className="min-w-0 flex-1">
            <Type variant="captionStrong" numberOfLines={1} style={{ fontSize: 16 }}>
              {title}
            </Type>
            {d.latestMessage ? (
              <Type
                variant="caption"
                tone={d.hasUnread ? "default" : "muted"}
                numberOfLines={1}
                style={{ fontSize: 14, marginTop: 1 }}
              >
                {d.latestMessage}
              </Type>
            ) : null}
          </View>

          {d.hasUnread ? (
            <View
              style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary }}
            />
          ) : null}
        </Pressable>
        );
      })}
    </View>
  );
}
