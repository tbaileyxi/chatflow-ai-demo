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
import {
  personName,
  personAka,
  personMatches,
  useContactNames,
} from "@/lib/personName";
import { useAuth } from "@/hooks/useAuth";
import { useUserHuddles } from "@/hooks/useUserHuddles";

type CoHuddler = {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  contact_name: string | null;
};

/** One of your other rooms, with the people in it this sheet could add. */
type PickableGroup = {
  id: string;
  name: string;
  memberIds: string[];
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
  /** Rooms you are already in, offered as one-tap selections. */
  const [groups, setGroups] = useState<PickableGroup[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  // What you have these people saved as. Local to this device — see lib/personName.
  const contactNames = useContactNames();
  const [sending, setSending] = useState(false);
  const { user } = useAuth();
  const me = user?.id ?? null;
  const { data: myHuddles } = useUserHuddles();

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
              contact_name: contactNames.get(r.user_id) ?? null,
            })),
        );

        // THE GROUP YOU ALREADY HAVE IS A VALID THING TO PICK.
        //
        // Picking the same eight faces every Sunday is the work this sheet
        // was making people redo. A room you are already in IS that list —
        // nothing new to create, nothing to name, nothing to maintain. So the
        // rooms become options here, one tap each, and the faces below stay
        // exactly as they were: this adds a way in, it does not replace one.
        //
        // Failing quietly is right. The grid is the feature; if the group
        // query falls over, the sheet is simply the sheet it was yesterday.
        const candidates = (myHuddles ?? []).filter(
          (h) => h.id !== huddleId && !h.isDm && !h.isGameRoom,
        );
        if (candidates.length > 0) {
          const { data: rows } = await supabase
            .from("huddle_members")
            .select("huddle_id, user_id")
            .in(
              "huddle_id",
              candidates.map((h) => h.id),
            );
          if (cancelled) return;
          const byRoom = new Map<string, string[]>();
          for (const r of (rows ?? []) as any[]) {
            // Only people this sheet could actually add: not already in the
            // room, and not you.
            if (alreadyHere.has(r.user_id) || r.user_id === me) continue;
            const list = byRoom.get(r.huddle_id) ?? [];
            list.push(r.user_id);
            byRoom.set(r.huddle_id, list);
          }
          setGroups(
            candidates
              .map((h) => ({
                id: h.id,
                name: h.name,
                memberIds: byRoom.get(h.id) ?? [],
              }))
              // A group whose members are all in here already adds nobody.
              .filter((g) => g.memberIds.length > 0)
              .sort((a, b) => b.memberIds.length - a.memberIds.length),
          );
        } else if (!cancelled) {
          setGroups([]);
        }
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
  }, [visible, huddleId, contactNames, myHuddles, me]);

  const filtered = useMemo(() => {
    if (!search.trim()) return people;
    // Matches the contact name first, then their Side Huddle name, then the
    // handle. The handle stays searchable and stops being displayed — somebody
    // who knows it should still find them.
    return people.filter((p) =>
      personMatches(
        {
          contactName: p.contact_name,
          displayName: p.display_name,
          username: p.username,
        },
        search,
      ),
    );
  }, [people, search]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  /**
   * A group is selected when every one of its people is. Tapping it adds the
   * ones that are missing, or clears the lot if they are all already in —
   * and either way it only ever moves the same set of individual selections
   * the faces below move, so the two can be mixed freely. Tap The Boys, then
   * drop one person, then add somebody else: the count at the bottom is still
   * just how many people are ticked.
   */
  const groupState = (g: PickableGroup) => {
    const on = g.memberIds.filter((id) => selected.has(id)).length;
    return { on, all: on === g.memberIds.length && on > 0 };
  };

  const toggleGroup = (g: PickableGroup) =>
    setSelected((prev) => {
      const next = new Set(prev);
      const everyone = g.memberIds.every((id) => next.has(id));
      for (const id of g.memberIds) everyone ? next.delete(id) : next.add(id);
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

            {/* PEOPLE FIRST, LINK SECOND.
                Tapping a face puts somebody in the room now; a link is a
                message you still have to write, send, and hope gets opened.
                The link led because it works for anyone anywhere, which is an
                argument about coverage, not about what to do first. */}
            {/* GROUPS FIRST, WHEN THERE ARE ANY.
                One tap for the eight people you brought last Sunday. It sits
                above the faces because it is the shortcut past them, and it
                disappears entirely when you have no other rooms — a new
                person never sees an empty shelf. */}
            {!loading && groups.length > 0 ? (
              <View className="mb-4">
                <Type variant="eyebrow" tone="muted" className="mb-2">
                  Bring a group you already have
                </Type>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  {groups.map((g) => {
                    const { all } = groupState(g);
                    return (
                      <Pressable
                        key={g.id}
                        onPress={() => toggleGroup(g)}
                        className="mr-2 flex-row items-center gap-2 rounded-full border px-3.5 py-2.5"
                        style={{
                          borderColor: all ? colors.primary : colors.border,
                          backgroundColor: all ? colors.primary : "transparent",
                        }}
                      >
                        {all ? (
                          <Check color={colors.primaryForeground} size={15} />
                        ) : null}
                        <Type
                          variant="captionStrong"
                          style={{
                            color: all
                              ? colors.primaryForeground
                              : colors.foreground,
                          }}
                          numberOfLines={1}
                        >
                          {g.name}
                        </Type>
                        <Type
                          variant="caption"
                          style={{
                            color: all
                              ? colors.primaryForeground
                              : colors.mutedForeground,
                          }}
                        >
                          {g.memberIds.length}
                        </Type>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            ) : null}

            <Type variant="eyebrow" tone="muted" className="mb-2">
              Tap friends on Side Huddle
            </Type>

            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search by name"
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
                    ? "No friends on Side Huddle yet — send them the link below."
                    : "No matches."}
                </Type>
              </View>
            ) : (
              // A GRID OF FACES, three across — not a list of rows.
              //
              // Inviting people is a face-recognition task, not a reading task:
              // you are looking for Marcus, and you know Marcus by his face. A
              // one-per-row list shows four people in the space nine faces fit
              // in, and pushes the Send button off the bottom the moment your
              // graph is real. Selection is a ring plus a check on the avatar
              // itself, so the thing you tapped is the thing that lights up.
              //
              // Bounded height — the Send CTA below must NEVER leave the screen.
              <ScrollView style={{ maxHeight: 320 }} keyboardShouldPersistTaps="handled">
                <View className="flex-row flex-wrap">
                {filtered.map((p) => {
                  const isSel = selected.has(p.user_id);
                  const parts = {
                    contactName: p.contact_name,
                    displayName: p.display_name,
                    username: p.username,
                  };
                  // The name in YOUR phone, not the handle. "@tbaileyxi_d844fb6c"
                  // identifies nobody; "Chris Emme" is who you went looking for.
                  const name = personName(parts);
                  // Their Side Huddle name underneath, and only when it says
                  // something the line above did not — "Broseph" is worth
                  // showing next to Chris Emme, twice is not.
                  const aka = personAka(parts);
                  return (
                    <Pressable
                      key={p.user_id}
                      onPress={() => toggle(p.user_id)}
                      className="w-1/3 items-center px-1 py-2.5 active:opacity-70"
                    >
                      <View
                        className={`h-[72px] w-[72px] items-center justify-center overflow-hidden rounded-full border-2 bg-muted ${
                          isSel ? "border-primary" : "border-border"
                        }`}
                      >
                        {p.avatar_url ? (
                          <Image
                            source={{ uri: p.avatar_url }}
                            className="h-full w-full"
                            resizeMode="cover"
                          />
                        ) : (
                          <Type variant="title" tone="muted">
                            {name.charAt(0).toUpperCase()}
                          </Type>
                        )}
                      </View>

                      {isSel ? (
                        <View
                          className="absolute h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-primary"
                          style={{ top: 8, right: 14 }}
                        >
                          <Check color={colors.primaryForeground} size={15} />
                        </View>
                      ) : null}

                      <Type variant="captionStrong" className="mt-2 text-center">
                        {name}
                      </Type>
                      {aka ? (
                        <Type variant="caption" tone="muted" className="text-center">
                          {aka}
                        </Type>
                      ) : null}
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

            {/* Second, for everybody not here yet. Quiet, because it is the
                fallback — but always present, because for a new person it is
                the only path that works. */}
            <Pressable
              onPress={handleShareLink}
              className="mt-2.5 flex-row items-center justify-center gap-2 rounded-xl border border-border px-4 py-3 active:opacity-70"
            >
              <Link2 color={colors.mutedForeground} size={16} />
              <Type variant="captionStrong" tone="muted">
                Copy an invite link instead
              </Type>
            </Pressable>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}
