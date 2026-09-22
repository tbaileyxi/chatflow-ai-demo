// Send one of your own moments to your other rooms.
//
// The problem is the one the app was built for and had not solved: somebody
// at the game takes a shot and has three group chats that would want it, so
// they send it three times. The share sheet already covers sending it OUT of
// Side Huddle to whoever they pick. This covers sending it to the rooms they
// are already in, in the same deliberate gesture.
//
// TWO RULES HOLD IT TOGETHER.
//
// The person who posted picks who sees it. There is no "select all" here and
// there is no automatic routing: you tap the rooms you mean, one at a time.
// The moment this becomes one tap to reach everyone, people start posting for
// an audience instead of for their friends, which is the thing worth
// protecting.
//
// And the conversation does not travel with it. Each room gets its own copy,
// so each room replies in its own thread — the family sees the photo and
// talks about it among themselves, and so do the buddies, and neither reads
// the other. That separation is the entire reason people keep the groups
// apart in the first place.

import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { Check, X } from "lucide-react-native";
import { Type } from "@/components/ui/Type";
import { colors } from "@/theme/colors";
import { useUserHuddles } from "@/hooks/useUserHuddles";
import { crossPostMessage, type CrossPostSource } from "@/lib/crossPost";

type Props = {
  visible: boolean;
  onClose: () => void;
  /** The room the moment is already in — never a destination. */
  fromHuddleId: string;
  source: CrossPostSource;
};

export function SendToHuddlesSheet({
  visible,
  onClose,
  fromHuddleId,
  source,
}: Props) {
  const { data: myHuddles } = useUserHuddles();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (visible) setSelected(new Set());
  }, [visible]);

  // A game room is everyone, and a DM is a conversation rather than a room —
  // neither is what "my other groups" means.
  const targets = useMemo(
    () =>
      (myHuddles ?? []).filter(
        (h) => h.id !== fromHuddleId && !h.isDm && !h.isGameRoom,
      ),
    [myHuddles, fromHuddleId],
  );

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const send = async () => {
    if (selected.size === 0 || sending) return;
    setSending(true);
    try {
      const { sent, failed } = await crossPostMessage(source, [...selected]);
      if (sent === 0) throw new Error("Nothing went through");
      onClose();
      Alert.alert(
        failed > 0 ? "Sent to some of them" : "Sent ✓",
        failed > 0
          ? `It went to ${sent} of ${sent + failed}. Try the rest again in a moment.`
          : `It's in ${sent} ${sent === 1 ? "room" : "rooms"}. Each one talks about it on its own.`,
      );
    } catch (err) {
      Alert.alert(
        "Couldn't send it on",
        (err as Error)?.message ?? "Try again in a moment.",
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable className="flex-1 bg-black/60" onPress={onClose}>
        <View className="flex-1 justify-end">
          <View
            onStartShouldSetResponder={() => true}
            className="max-h-[80%] rounded-t-3xl border-t border-border bg-background px-5 pb-10 pt-4"
          >
            <View className="mb-4 flex-row items-center">
              <View className="flex-1 items-center">
                <View className="h-1.5 w-12 rounded-full bg-muted" />
              </View>
              <Pressable onPress={onClose} hitSlop={8}>
                <X color={colors.mutedForeground} size={22} />
              </Pressable>
            </View>

            <Type variant="title" className="mb-1">
              Send to your other rooms
            </Type>
            <Type variant="caption" tone="muted" className="mb-4 leading-5">
              Each room gets its own copy. Replies stay where they are made.
            </Type>

            {targets.length === 0 ? (
              <View className="items-center py-10">
                <Type variant="caption" tone="muted" className="text-center">
                  This is your only room so far.
                </Type>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 320 }}>
                {targets.map((h) => {
                  const on = selected.has(h.id);
                  return (
                    <Pressable
                      key={h.id}
                      onPress={() => toggle(h.id)}
                      className="mb-2 flex-row items-center gap-3 rounded-2xl border px-3.5 py-3"
                      style={{
                        borderColor: on ? colors.primary : colors.border,
                        backgroundColor: on ? colors.primary : "transparent",
                      }}
                    >
                      <View
                        className="h-6 w-6 items-center justify-center rounded-full border"
                        style={{
                          borderColor: on
                            ? colors.primaryForeground
                            : colors.border,
                          backgroundColor: on
                            ? colors.primaryForeground
                            : "transparent",
                        }}
                      >
                        {on ? <Check color={colors.primary} size={15} /> : null}
                      </View>
                      <View className="flex-1">
                        <Type
                          variant="heading"
                          numberOfLines={1}
                          style={{
                            color: on
                              ? colors.primaryForeground
                              : colors.foreground,
                          }}
                        >
                          {h.name}
                        </Type>
                        <Type
                          variant="caption"
                          style={{
                            color: on
                              ? colors.primaryForeground
                              : colors.mutedForeground,
                          }}
                        >
                          {h.memberCount} {h.memberCount === 1 ? "person" : "people"}
                        </Type>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}

            {targets.length > 0 ? (
              <Pressable
                onPress={send}
                disabled={selected.size === 0 || sending}
                className="mt-4 items-center justify-center rounded-2xl py-4"
                style={{
                  backgroundColor:
                    selected.size === 0 ? colors.muted : colors.primary,
                  opacity: sending ? 0.7 : 1,
                }}
              >
                {sending ? (
                  <ActivityIndicator color={colors.primaryForeground} />
                ) : (
                  <Type
                    variant="heading"
                    style={{
                      color:
                        selected.size === 0
                          ? colors.mutedForeground
                          : colors.primaryForeground,
                    }}
                  >
                    {selected.size === 0
                      ? "Pick a room"
                      : `Send to ${selected.size}`}
                  </Type>
                )}
              </Pressable>
            ) : null}
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}
