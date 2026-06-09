// Pull-in picker.  Co-huddler graph multi-select for inviting people who are
// already on the app to this room.  Backed by RPCs:
//   co_huddlers()                  → ranked list of who you share rooms with
//   accept_room_invite(code)       → recipients consume the code we generate
// We mint one invite_code via create_room_invite_code and send a push to each
// selected user using send-push-notification.

import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { Check, Send, X } from "lucide-react-native";
import { supabase } from "@/integrations/supabase/client";
import { colors } from "@/theme/colors";

type CoHuddler = {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  shared_huddles: number;
};

type Props = {
  visible: boolean;
  huddleId: string;
  huddleName: string;
  onClose: () => void;
};

export function PullInFriendsModal({
  visible,
  huddleId,
  huddleName,
  onClose,
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
        // RPC returns user_id + shared_huddles. Hydrate profiles in a 2nd call.
        const { data: rpcRows, error: rpcErr } = await (supabase.rpc as any)(
          "co_huddlers",
          { p_limit: 50 },
        );
        if (rpcErr) throw rpcErr;
        const rows = (rpcRows ?? []) as { user_id: string; shared_huddles: number }[];
        if (rows.length === 0) {
          if (!cancelled) setPeople([]);
          return;
        }
        const ids = rows.map((r) => r.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, display_name, username, avatar_url")
          .in("user_id", ids);
        const pmap = new Map((profiles ?? []).map((p) => [p.user_id, p as any]));
        if (cancelled) return;
        setPeople(
          rows.map((r) => ({
            user_id: r.user_id,
            shared_huddles: r.shared_huddles,
            display_name: pmap.get(r.user_id)?.display_name ?? null,
            username: pmap.get(r.user_id)?.username ?? null,
            avatar_url: pmap.get(r.user_id)?.avatar_url ?? null,
          })),
        );
      } catch (err) {
        console.warn("[pull-in] co_huddlers failed", err);
        if (!cancelled) setPeople([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible]);

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

  const handleSend = async () => {
    if (selected.size === 0) return;
    setSending(true);
    try {
      // Mint one invite code for the room.
      const { data: rpcRows, error: rpcErr } = await (supabase.rpc as any)(
        "create_room_invite_code",
        { p_huddle_id: huddleId },
      );
      if (rpcErr) throw rpcErr;
      const row = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;
      const code: string | undefined = row?.invite_code;
      if (!code) throw new Error("No invite code");
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
        "Pulled in",
        `Sent ${selected.size} ${selected.size === 1 ? "person" : "people"} a notification.`,
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
          <Pressable
            onPress={(e) => e.stopPropagation()}
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

            <Text className="mb-1 text-xl font-black text-foreground">
              Pull friends in
            </Text>
            <Text className="mb-3 text-sm text-muted-foreground">
              People you co-huddle with — tap to pick.
            </Text>

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
                <Text className="text-center text-sm text-muted-foreground">
                  {people.length === 0
                    ? "No co-huddlers yet. Share an invite link to bring people on."
                    : "No matches."}
                </Text>
              </View>
            ) : (
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
                          <Text className="text-sm font-bold text-muted-foreground">
                            {name.charAt(0).toUpperCase()}
                          </Text>
                        )}
                      </View>
                      <View className="flex-1">
                        <Text className="text-sm font-bold text-foreground">
                          {name}
                        </Text>
                        <Text className="text-xs text-muted-foreground">
                          {p.shared_huddles} mutual{" "}
                          {p.shared_huddles === 1 ? "huddle" : "huddles"}
                        </Text>
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
                  ? "Pulling in…"
                  : `Pull in ${selected.size > 0 ? selected.size : ""}`}
              </Text>
            </Pressable>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}
