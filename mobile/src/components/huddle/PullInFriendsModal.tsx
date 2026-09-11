// Pull-in picker. Multi-select over the people you know who are NOT already in
// this room, for inviting them into it. Backed by RPCs:
//   known_people()                 → your persistent graph (contacts, invites)
//   create_room_invite_code(id)    → the code the invite link/push carries
//   accept_room_invite(code)       → recipients consume it
//
// Also serves as the second half of Rally: PingButton pings the room, then
// opens this with rallied=true so one tap covers both the people who are here
// and the people who should be.

import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Share,
  Text,
  TextInput,
  View,
} from "react-native";
import { Check, Link2, Send, X } from "lucide-react-native";
import { Type } from "@/components/ui/Type";
import { supabase } from "@/integrations/supabase/client";
import { colors } from "@/theme/colors";

type CoHuddler = {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

type Props = {
  visible: boolean;
  huddleId: string;
  huddleName: string;
  onClose: () => void;
  // Set when the sheet opens straight off a rally, so the copy reflects that
  // the room was just pinged and these are the people who missed it.
  rallied?: boolean;
};

export function PullInFriendsModal({
  visible,
  huddleId,
  huddleName,
  onClose,
  rallied = false,
}: Props) {
  const [people, setPeople] = useState<CoHuddler[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setSelected(new Set());
      try {
        // WAS: co_huddlers(), which ranked people by rooms already shared with
        // you — so the pull-in list could only ever show people you were
        // already in rooms with. known_people() is the persistent graph, which
        // includes contact matches and invite accepts.
        const [peopleRes, membersRes] = await Promise.all([
          (supabase.rpc as any)("known_people"),
          supabase
            .from("huddle_members")
            .select("user_id")
            .eq("huddle_id", huddleId),
        ]);

        if (peopleRes.error) throw peopleRes.error;

        // Anyone already in the room is not someone to pull in.
        const alreadyHere = new Set(
          (membersRes.data ?? []).map((m: any) => m.user_id),
        );

        if (cancelled) return;
        setPeople(
          ((peopleRes.data ?? []) as any[])
            .filter((r) => !alreadyHere.has(r.user_id))
            .map((r) => ({
              user_id: r.user_id,
              display_name: r.display_name ?? null,
              username: r.username ?? null,
              avatar_url: r.avatar_url ?? null,
            })),
        );
      } catch (err) {
        console.warn("[pull-in] known_people failed", err);
        if (!cancelled) setPeople([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, huddleId]);

  const filtered = useMemo(() => {
    if (!search.trim()) return people;
    const q = search.trim().toLowerCase();
    return people.filter(
      (p) =>
        (p.display_name?.toLowerCase().includes(q) ?? false) ||
        (p.username?.toLowerCase().includes(q) ?? false),
    );
  }, [people, search]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  // Mint one invite code for the room (shared by both link + in-app paths).
  const mintInviteCode = async (): Promise<string> => {
    const { data: rpcRows, error: rpcErr } = await (supabase.rpc as any)(
      "create_room_invite_code",
      { p_huddle_id: huddleId },
    );
    if (rpcErr) throw rpcErr;
    const row = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;
    const code: string | undefined = row?.invite_code;
    if (!code) throw new Error("No invite code");
    return code;
  };

  const handleShareLink = async () => {
    try {
      const code = await mintInviteCode();
      const inviteLink = `https://www.sidehuddlesports.com/i/${code}`;
      // MESSAGE WITHOUT THE URL, URL SEPARATELY.
      //
      // Passing both, with the link also inside the text, makes iOS put it in
      // twice — the sent message reads "... https://…/i/abc https://…/i/abc" —
      // and Messages will not build a rich preview for a message carrying two
      // links. The room's photo and name were resolving correctly the whole
      // time; nothing was ever asked to render them.
      await Share.share({
        message: `Jump into ${huddleName} on Side Huddle.`,
        url: inviteLink,
      });
    } catch (err) {
      Alert.alert(
        "Couldn't create invite link",
        (err as Error)?.message ?? "Try again in a moment.",
      );
    }
  };

  const handleSend = async () => {
    if (selected.size === 0) return;
    setSending(true);
    try {
      const code = await mintInviteCode();
      const url = `sidehuddle://i/${code}`;

      // Fire push notifications (one per selected user).
      const env = (await supabase.auth.getSession()).data.session?.access_token;
      const baseUrl = "https://dejuwyeypiggvlyfliap.supabase.co/functions/v1";
      await Promise.all(
        Array.from(selected).map((uid) =>
          fetch(`${baseUrl}/send-push-notification`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${env}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              user_ids: [uid],
              title: `You're being pulled into ${huddleName}`,
              body: "Tap to join.",
              url,
            }),
          }).catch(() => undefined),
        ),
      );

      Alert.alert(
        "Invites sent ✓",
        `${selected.size} ${selected.size === 1 ? "person" : "people"} just got a notification in the app.`,
      );
      onClose();
    } catch (err) {
      Alert.alert(
        "Couldn't pull friends in",
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
          {/* Inner sheet is a View (not Pressable) so taps on rows reach
              their own Pressables instead of being captured here. */}
          <View
            onStartShouldSetResponder={() => true}
            className="max-h-[80%] rounded-t-3xl border-t border-border bg-background px-5 pb-10 pt-4"
          >
            {/* Handle + header */}
            <View className="mb-4 flex-row items-center">
              <View className="flex-1 items-center">
                <View className="h-1.5 w-12 rounded-full bg-muted" />
              </View>
              <Pressable onPress={onClose} hitSlop={8}>
                <X color={colors.mutedForeground} size={22} />
              </Pressable>
            </View>

            <Type variant="title" className="mb-1">
              {rallied ? `Room rallied ✓` : `Invite to ${huddleName}`}
            </Type>
            {rallied ? (
              <Type variant="caption" tone="muted" className="mb-3 leading-5">
                Everyone in {huddleName} just got pinged. These people aren't in
                the room yet — pull them in.
              </Type>
            ) : null}

            {/* Share link — the universal path, works for anyone anywhere. */}
            <Pressable
              onPress={handleShareLink}
              className="mb-4 flex-row items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 active:opacity-80"
            >
              <Link2 color={colors.primaryForeground} size={18} />
              <Type variant="heading" tone="onPrimary">
                Share invite link
              </Type>
            </Pressable>

            <Type variant="eyebrow" tone="muted" className="mb-2">
              Or tap friends on Side Huddle
            </Type>

            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search by name or @username"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
              className="mb-3 rounded-xl border border-border bg-muted px-3 py-2.5 text-foreground"
              style={{ color: colors.foreground }}
            />

            {loading ? (
              <View className="items-center py-10">
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : filtered.length === 0 ? (
              <View className="items-center py-10">
                <Type variant="caption" tone="muted" className="text-center">
                  {people.length === 0
                    ? "No friends on Side Huddle yet — use Share invite link above."
                    : "No matches."}
                </Type>
              </View>
            ) : (
              // Bounded list — the Send CTA below must NEVER leave the screen.
              <ScrollView style={{ maxHeight: 300 }} keyboardShouldPersistTaps="handled">
                <View className="gap-1">
                {filtered.map((p) => {
                  const isSel = selected.has(p.user_id);
                  const name =
                    p.display_name ?? p.username ?? p.user_id.slice(0, 6);
                  return (
                    <Pressable
                      key={p.user_id}
                      onPress={() => toggle(p.user_id)}
                      className="flex-row items-center gap-3 rounded-xl px-2 py-2 active:bg-muted/40"
                    >
                      <View className="h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-muted">
                        {p.avatar_url ? (
                          <Image
                            source={{ uri: p.avatar_url }}
                            className="h-full w-full"
                            resizeMode="cover"
                          />
                        ) : (
                          <Type variant="captionStrong" tone="muted">
                            {name.charAt(0).toUpperCase()}
                          </Type>
                        )}
                      </View>
                      <View className="flex-1">
                        <Type variant="captionStrong">
                          {name}
                        </Type>
                        {p.username ? (
                          <Type variant="caption" tone="muted">
                            @{p.username}
                          </Type>
                        ) : null}
                      </View>
                      <View
                        className={`h-6 w-6 items-center justify-center rounded-full border-2 ${
                          isSel
                            ? "border-primary bg-primary"
                            : "border-border bg-transparent"
                        }`}
                      >
                        {isSel ? (
                          <Check color={colors.primaryForeground} size={14} />
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })}
                </View>
              </ScrollView>
            )}

            {/* CTA */}
            <Pressable
              onPress={handleSend}
              disabled={selected.size === 0 || sending}
              className={`mt-4 flex-row items-center justify-center gap-2 rounded-xl px-4 py-3.5 ${
                selected.size === 0 || sending
                  ? "bg-muted"
                  : "bg-primary"
              }`}
            >
              <Send
                color={
                  selected.size === 0 || sending
                    ? colors.mutedForeground
                    : colors.primaryForeground
                }
                size={16}
              />
              <Text
                className={`text-base font-black ${
                  selected.size === 0 || sending
                    ? "text-muted-foreground"
                    : "text-primary-foreground"
                }`}
              >
                {sending
                  ? "Sending…"
                  : selected.size === 0
                    ? "Send invites"
                    : `Send ${selected.size} invite${selected.size === 1 ? "" : "s"}`}
              </Text>
            </Pressable>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}
