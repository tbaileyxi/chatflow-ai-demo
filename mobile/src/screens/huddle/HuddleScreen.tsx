import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  FlatList,
  ScrollView,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Share,
  ActivityIndicator,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from "@react-navigation/native";
import { Type } from "@/components/ui/Type";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useHuddleDetails } from "@/hooks/useHuddleDetails";
import { useHuddleMessages, type HuddleMessage } from "@/hooks/useHuddleMessages";
import { useMessageReactions, useToggleReaction } from "@/hooks/useMessageReactions";
import { useHuddlePresence } from "@/hooks/useHuddlePresence";
import { useHuddleMembers } from "@/hooks/useHuddleMembers";
import { useGlobalPresence } from "@/contexts/GlobalPresenceContext";
import { HuddleHeader } from "@/components/huddle/HuddleHeader";
import { PullInFriendsModal } from "@/components/huddle/PullInFriendsModal";
import { PresenceBar } from "@/components/huddle/PresenceBar";
import { FloatingReactions } from "@/components/huddle/ReactionRail";
import { PregameStrip } from "@/components/huddle/PregameStrip";
import {
  captureFaceReaction,
  gameContextLabel,
} from "@/lib/faceReaction";
import { FadeButton } from "@/components/huddle/FadeButton";
import { PingButton } from "@/components/huddle/PingButton";
import { ChatMessage } from "@/components/huddle/ChatMessage";
import { MessageInput } from "@/components/huddle/MessageInput";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { DEV_ROOMS_STORAGE_KEY, getDevTeamById } from "@/config/devData";
import { LogOut, MoreVertical, Pin, UserPlus, User } from "lucide-react-native";
import { useUserHuddles } from "@/hooks/useUserHuddles";
import { useRoomSwipe } from "@/hooks/useRoomSwipe";
import {
  useLiveGameContext,
  formatGameClock,
  getGameState,
} from "@/hooks/useLiveGameContext";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DualCam } from "../../../modules/dual-cam";
import { fonts } from "@/theme/type";
import { colors } from "@/theme/colors";
import type { RootStackParamList } from "@/navigation/types";
import { CoachThinking } from "@/components/huddle/CoachThinking";
import { RoomBackground, isRealRoomPhoto } from "@/components/huddle/RoomBackground";
import { SpinUpBar } from "@/components/huddle/SpinUpBar";
import { CommunitySpinUpBar } from "@/components/huddle/CommunitySpinUpBar";
import { useKnownPeople } from "@/hooks/useFriends";
import { useFoundingPartner } from "@/hooks/useFoundingPartner";

type Route = RouteProp<RootStackParamList, "Huddle">;

const SWIPE_HINT_KEY = "side-huddle:swipe-hint-seen";

type ListItem =
  | { type: "message"; data: HuddleMessage }
  | { type: "separator"; label: string; key: string }
  | { type: "load-more"; key: string };

function formatDaySeparator(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const messageDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((today.getTime() - messageDay.getTime()) / 86400000);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";

  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

// Find the root message ID for any reply chain (single-level threading)
function findRootId(
  msgId: string,
  msgMap: Map<string, HuddleMessage>,
  visited = new Set<string>(),
): string {
  if (visited.has(msgId)) return msgId; // cycle guard
  visited.add(msgId);
  const msg = msgMap.get(msgId);
  if (!msg || !msg.replyToId) return msgId;
  const parent = msgMap.get(msg.replyToId);
  if (!parent) return msgId; // parent not loaded
  return findRootId(parent.id, msgMap, visited);
}

// Build threaded list: root messages newest-first, replies grouped below each root
function buildListItems(
  messages: HuddleMessage[],
  hasMore: boolean,
): ListItem[] {
  const msgMap = new Map<string, HuddleMessage>();
  for (const m of messages) msgMap.set(m.id, m);

  // Group replies by root message ID
  const rootReplies = new Map<string, HuddleMessage[]>();
  const rootMessages: HuddleMessage[] = [];

  for (const msg of messages) {
    if (!msg.replyToId || !msgMap.has(msg.replyToId)) {
      // This is a root message (or its parent isn't loaded)
      rootMessages.push(msg);
    } else {
      const rootId = findRootId(msg.id, msgMap);
      if (rootId === msg.id) {
        // Couldn't find parent chain, treat as root
        rootMessages.push(msg);
      } else {
        const replies = rootReplies.get(rootId) ?? [];
        replies.push(msg);
        rootReplies.set(rootId, replies);
      }
    }
  }

  // READING ORDER: oldest first.
  //
  // The thread used to be built newest-first and rendered with the newest
  // message at the top, which is a feed, not a conversation. Every messaging
  // app people already use runs the other way: oldest at the top, newest at
  // the bottom, the composer right under the last thing anybody said.
  //
  // This ordering is what makes the rest work — a reply sits under the message
  // it answers, a day separator sits above that day, "load older" sits at the
  // top, and consecutive-message grouping compares against the line directly
  // above rather than the one below it.
  rootMessages.sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  // Build final list with day separators
  const items: ListItem[] = [];
  let lastDay = "";

  for (const root of rootMessages) {
    const rootDate = new Date(root.createdAt);
    const dayKey = `${rootDate.getFullYear()}-${rootDate.getMonth()}-${rootDate.getDate()}`;

    if (dayKey !== lastDay) {
      items.push({
        type: "separator",
        label: formatDaySeparator(root.createdAt),
        key: `sep-${dayKey}`,
      });
      lastDay = dayKey;
    }

    // Root message
    items.push({ type: "message", data: root });

    // Replies sorted chronologically (oldest first within thread)
    const replies = rootReplies.get(root.id);
    if (replies) {
      replies.sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
      for (const reply of replies) {
        items.push({ type: "message", data: reply });
      }
    }
  }

  // Older messages are up, so the door to them is up.
  if (hasMore) {
    items.unshift({ type: "load-more", key: "load-more" });
  }

  return items;
}

export function HuddleScreen() {
  const route = useRoute<Route>();
  const { huddleId } = route.params;

  if (huddleId.startsWith("dev-room-")) {
    return <DevHuddleRoom huddleId={huddleId} />;
  }

  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { data: huddle, isLoading: huddleLoading } = useHuddleDetails(huddleId);
  const {
    data: messages,
    isLoading: messagesLoading,
    sendMessage,
    hasMore,
    loadMore,
    loadingMore,
  } = useHuddleMessages(huddleId);
  const flatListRef = useRef<FlatList<ListItem>>(null);
  const {
    presentUsers,
    typingUsers,
    entryBanner,
    sendTyping,
    liveReactions,
    sendReaction,
  } = useHuddlePresence(huddleId);

  // Publish this room as the user's current location to the global lobby so it
  // surfaces in friends' "Friends Now" — and clear it on leave.
  const { setCurrentHuddle } = useGlobalPresence();

  // A per-room map of which friends are in it used to live here, to put names
  // on the JUMP pills. The pills are gone and a swipe has nowhere to show a
  // name, so it went with them — liveRoomIds below already carries the part
  // that still matters, which is ordering rooms with somebody in them first.
  useEffect(() => {
    setCurrentHuddle(huddleId, huddle?.name ?? null);
    return () => setCurrentHuddle(null);
  }, [huddleId, huddle?.name, setCurrentHuddle]);

  // Everyone in the room, not just whoever is looking at it right now. The
  // presence row shows both — lit for here, dimmed for not — because "nobody
  // else is in here" and "this room has nobody else in it" are different
  // facts, and only one of them is a reason to invite somebody.
  const { data: roomMembers } = useHuddleMembers(huddleId, huddle?.ownerId ?? "");

  // Prediction markets for this huddle's team
  const teamId = huddle?.teamId;

  // Game window for the "Rally the huddle" ping (shown only when a game is near).
  const { data: liveGame } = useLiveGameContext(teamId);
  const pingGameState = getGameState(liveGame ?? null);

  // JUMP pills — the user's other rooms, same-team rooms first. This is the
  // core room-jumping loop; it previously existed only in the dev sandbox.
  const navigation = useNavigation();
  const { data: myHuddles } = useUserHuddles();
  const { presentUsers: everyone } = useGlobalPresence();

  /**
   * Who in here you actually know.
   *
   * A public game huddle is forty strangers and two friends, and the two are
   * the only reason to stay. They are also the only reason Spin up exists —
   * with nobody you know there is nothing to pull out.
   */
  // A sponsor may appear in a team's own rooms and nowhere else: not in a
  // fixture room that belongs to both teams, not behind a locked door, not in
  // a DM between two people.
  const partnerName = useFoundingPartner({
    teamCity: huddle?.teamCity ?? null,
    teamName: huddle?.teamName ?? null,
    eligible: !!huddle && !huddle.isGameRoom && !huddle.isPrivate && !huddle.isDm,
  });

  const { data: knownPeople } = useKnownPeople();
  const friendsHere = useMemo(() => {
    const known = new Set((knownPeople ?? []).map((p: any) => p.userId));
    return presentUsers
      .filter((u: any) => u.userId !== user?.id && known.has(u.userId))
      .map((u: any) => ({
        userId: u.userId as string,
        displayName: (u.displayName ?? "Someone") as string,
      }));
  }, [presentUsers, knownPeople, user?.id]);
  const liveRoomIds = useMemo(
    () => new Set((everyone ?? []).map((u) => u.huddleId).filter(Boolean) as string[]),
    [everyone],
  );
  const jumpRooms = useMemo(() => {
    if (!myHuddles) return [];
    // Jump is rooms-only: your private huddles with friends. Official team
    // "Community" huddles are bot surfaces, not destinations — never show them.
    const others = myHuddles.filter(
      (h) => h.id !== huddleId && !h.isOfficialTeam,
    );
    const sameTeam = teamId
      ? others.filter((h) => h.teamName && huddle?.teamName === h.teamName)
      : [];
    const rest = others.filter((h) => !sameTeam.includes(h));
    // Rooms with somebody in them come first — the row is for jumping to
    // people, and eight pills wide means the interesting one can fall off
    // the end of the scroll.
    const ordered = [...sameTeam, ...rest];
    return ordered
      .sort((a, b) => Number(liveRoomIds.has(b.id)) - Number(liveRoomIds.has(a.id)))
      .slice(0, 8);
  }, [myHuddles, huddleId, teamId, huddle?.teamName, liveRoomIds]);

  // Swipe sideways between those same rooms, in that same order. Current room
  // sits at index 0, so a left swipe lands on the most relevant other room —
  // same team if there is one, somebody-in-it before empty.
  const swipeRoomIds = useMemo(
    () => [huddleId, ...jumpRooms.map((r) => r.id)],
    [huddleId, jumpRooms],
  );
  // A GESTURE NOBODY IS TOLD ABOUT DOES NOT EXIST.
  //
  // The jump pills were removed in favour of this swipe, which means the only
  // way to discover it is to do it by accident. Say it once, the first time
  // somebody is in a room with somewhere to swipe TO, then never again.
  const [showSwipeHint, setShowSwipeHint] = useState(false);
  useEffect(() => {
    if (jumpRooms.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const seen = await AsyncStorage.getItem(SWIPE_HINT_KEY);
        if (!cancelled && !seen) {
          setShowSwipeHint(true);
          await AsyncStorage.setItem(SWIPE_HINT_KEY, "1");
        }
      } catch {
        // A hint is not worth failing a room over.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [jumpRooms.length]);

  const swipeHandlers = useRoomSwipe({
    roomIds: swipeRoomIds,
    currentId: huddleId,
    onNavigate: (id) =>
      // replace, not push: swiping through six rooms should not build a
      // six-deep back stack that takes six taps to escape.
      (navigation as any).replace("Huddle", { huddleId: id }),
  });

  /**
   * MUST STAY ABOVE THE EARLY RETURNS. This is a hook, and the two guards
   * below return before reaching this point while the room is still loading.
   * Defined underneath them, it ran on the second render and not the first —
   * "Rendered more hooks than during the previous render", which killed the
   * app every single time you opened a room.
   *
   * Record a short video of your face and post it with the score burned on.
   *
   * The score is captured HERE, at record time, and travels as the message's
   * content. Reading it at render time later would relabel every old reaction
   * with the final score — which would quietly destroy the only reason these
   * are worth keeping.
   */
  const postFaceReaction = useCallback(async (shot: { uri: string; context: string | null; isVideo?: boolean }) => {
    if (!user) return;

    // Positional, and the signature is
    //   (content, userId, replyToId?, media?, notifContext?, messageType?)
    // Every argument here used to be one place to the left: undefined went in
    // as userId, the media object landed in replyToId, and "face_reaction"
    // arrived as notifContext. Face reactions could never have posted.
    const { error } = await sendMessage(
      shot.context ?? "",
      user.id,
      undefined,
      { uri: shot.uri, type: shot.isVideo === false ? "image" : "video" },
      {
        senderName: profile?.displayName ?? profile?.username ?? "Someone",
        huddleName: huddle?.name ?? "",
      },
      "face_reaction",
    );

    if (error) {
      // The server-side ceiling is 20 an hour and the client cannot argue
      // with it, so say what happened rather than "failed to send".
      const msg = String((error as any)?.message ?? "");
      Alert.alert(
        msg.includes("rate_limit") ? "Slow down a second" : "Couldn't post that",
        msg.includes("rate_limit")
          ? "That's a lot of reactions in an hour. Try again shortly."
          : "Try again in a moment.",
      );
      return;
    }
    scrollToBottom();
  }, [liveGame, sendMessage, profile, huddle?.name, user]);

  const handleFaceReaction = useCallback(async () => {
    const label = gameContextLabel(liveGame ?? null);

    // Both cameras where the hardware allows it (A12 and newer), front-only
    // everywhere else. The dual path hands its clip back through a callback
    // because it lives on its own screen — it needs the whole display to frame
    // a shot, and a modal that returns a value is the cheapest way to do that
    // without lifting recording state into this already large component.
    if (DualCam.isSupported()) {
      navigation.navigate("DualCam", {
        gameContext: label,
        onCapture: (shot: { uri: string; context: string | null; isVideo: boolean }) => {
          void postFaceReaction(shot);
        },
      });
      return;
    }

    const shot = await captureFaceReaction(label);
    if (!shot) return;
    await postFaceReaction(shot);
  }, [liveGame, navigation, postFaceReaction]);


  // Reply state
  const [replyTo, setReplyTo] = useState<{
    id: string;
    displayName: string;
    content: string;
  } | null>(null);

  // Invite modal — the room's one invite surface (link + in-app friends).
  const [showInvite, setShowInvite] = useState(false);
  // Tracks whether the invite sheet was opened by a rally, so it can say so.
  const [invitedViaRally, setInvitedViaRally] = useState(false);
  // Cleared when a coach_answer actually lands, or after 90s so a failed ask
  // doesn't leave the dots spinning forever.
  const [coachThinking, setCoachThinking] = useState(false);

  // Stop the dots the moment the Coach speaks.
  useEffect(() => {
    if (!coachThinking) return;
    const answered = (messages ?? []).some(
      (m) => m.messageType === "coach_answer" &&
             Date.now() - new Date(m.createdAt).getTime() < 120_000,
    );
    if (answered) setCoachThinking(false);
  }, [messages, coachThinking]);

  useEffect(() => {
    if (!coachThinking) return;
    const t = setTimeout(() => setCoachThinking(false), 90_000);
    return () => clearTimeout(t);
  }, [coachThinking]);

  // Reactions
  const messageIds = useMemo(
    () => messages?.map((m) => m.id) ?? [],
    [messages],
  );
  const { data: reactionsMap } = useMessageReactions(huddleId, messageIds);
  const toggleReaction = useToggleReaction();

  // People you can @-mention, derived from who has actually spoken in here.
  // Deliberately not a members query: the people worth mentioning are the ones
  // talking, and this needs no extra round trip. Coach is pinned above these
  // inside MessageInput.
  const mentionables = useMemo(() => {
    const seen = new Map<string, { key: string; label: string }>();
    for (const m of messages ?? []) {
      if (m.isBotMessage || m.userId === user?.id) continue;
      const label = (m.username || m.displayName || "").trim().replace(/\s+/g, "");
      if (!label || seen.has(m.userId)) continue;
      seen.set(m.userId, { key: m.userId, label });
    }
    return [...seen.values()].slice(0, 20);
  }, [messages, user?.id]);

  // Build a map of message id -> message for reply lookups
  const messageMap = useMemo(() => {
    const map = new Map<string, HuddleMessage>();
    if (messages) {
      for (const m of messages) {
        map.set(m.id, m);
      }
    }
    return map;
  }, [messages]);

  // Build list items with day separators, in reading order (oldest first)
  const listItems = useMemo(
    () => (messages ? buildListItems(messages, hasMore) : []),
    [messages, hasMore],
  );

  // Update last_read_at on mount and when new messages arrive, throttled to
  // one write per 15s per room — during live games the bot can land a message
  // every few seconds and each viewer was issuing an UPDATE per message.
  const lastReadWriteRef = useRef<{ huddleId: string; ts: number }>({
    huddleId: "",
    ts: 0,
  });
  useEffect(() => {
    if (!user || !huddleId) return;
    const now = Date.now();
    const prev = lastReadWriteRef.current;
    // Switching rooms always writes immediately; same room throttles.
    if (prev.huddleId === huddleId && now - prev.ts < 15_000) return;
    lastReadWriteRef.current = { huddleId, ts: now };
    supabase
      .from("huddle_members")
      .update({ last_read_at: new Date().toISOString() })
      .eq("huddle_id", huddleId)
      .eq("user_id", user.id)
      .then(() => {});
  }, [user, huddleId, messages?.length]);

  const [joining, setJoining] = useState(false);
  const queryClient = useQueryClient();

  // The list runs oldest -> newest, so "newest" is the end of it. This used to
  // be offset 0, which was the top, which was the newest only because the list
  // was built backwards.
  const scrollToBottom = useCallback(() => {
    flatListRef.current?.scrollToEnd({ animated: true });
  }, []);

  // Stay pinned to the newest line — unless you have scrolled up to read, in
  // which case being yanked back down every time somebody types is the single
  // most irritating thing a chat can do to you.
  const atBottomRef = useRef(true);
  const settledRef = useRef(false);
  // WHY THERE IS A GRACE PERIOD. Opening a room, the first scrollToEnd lands,
  // then the pregame strip mounts underneath and takes ~90px out of the list.
  // The offset doesn't move but the viewport shrinks, so the next onScroll
  // reports "you are 90px from the end" and atBottomRef goes false — after
  // which every later attempt to re-pin bails out, and the newest message is
  // left sliced in half by the strip that pushed it there.
  const openedAtRef = useRef(Date.now());
  const keepAtBottom = useCallback(() => {
    if (!atBottomRef.current && Date.now() - openedAtRef.current > 2000) return;
    flatListRef.current?.scrollToEnd({ animated: settledRef.current });
    // Twice. The first call lands before the pregame strip and the composer
    // have taken their height out of the list, so it scrolls to an end that
    // then moves — which left the newest message sliced in half by the strip.
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 140);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 420);
    settledRef.current = true;
  }, []);

  /**
   * Anything that changes the height of the thread has to re-pin it.
   *
   * onContentSizeChange alone was not enough: the pregame strip and the
   * reaction rail both depend on a game query that resolves AFTER the first
   * messages render, so they appear underneath a list that has already
   * scrolled to what was the bottom a moment ago — and the newest message
   * ends up sliced in half by the strip that just pushed it up.
   */
  useEffect(() => {
    const t = setTimeout(keepAtBottom, 60);
    return () => clearTimeout(t);
  }, [keepAtBottom, messages?.length, pingGameState, liveGame?.settleable]);

  const handleReply = useCallback(
    (msg: HuddleMessage) => {
      setReplyTo({
        id: msg.id,
        displayName: msg.displayName ?? msg.username ?? "User",
        content: msg.content,
      });
      const index = listItems.findIndex(
        (item) => item.type === "message" && item.data.id === msg.id,
      );
      if (index >= 0) {
        flatListRef.current?.scrollToIndex({
          index,
          animated: true,
          viewPosition: 0.5,
        });
      }
    },
    [listItems],
  );

  if (huddleLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <LoadingSpinner className="flex-1" />
      </SafeAreaView>
    );
  }

  // Loaded, and there is no room. This used to share the branch above, so a
  // failed lookup rendered a spinner that never stopped — no error, no way back,
  // and nothing on screen to report. Say so instead.
  if (!huddle) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-3 bg-background px-8">
        <Type center variant="heading">
          Couldn't open this room
        </Type>
        <Type center variant="caption" tone="muted">
          It may have been deleted, or you may not have access to it.
        </Type>
        <Pressable
          onPress={() => navigation.goBack()}
          className="mt-2 rounded-xl border border-border px-5 py-3"
        >
          <Type variant="captionStrong">Go back</Type>
        </Pressable>
      </SafeAreaView>
    );
  }


  const handleSend = async (
    content: string,
    replyToId?: string,
    media?: { uri: string; type: "image" | "audio" | "video" },
  ) => {
    if (!user) return { error: new Error("Not authenticated") };
    const senderName = profile?.displayName ?? profile?.username ?? "Someone";
    const huddleName = huddle?.name ?? "";
    // Asking @coach takes time — the scan runs on a cron and the answer needs
    // a model call behind it. Without a sign that anything is happening the
    // room looks broken, and people ask again, which is how a thread ends up
    // with the same question three times.
    // TWO ways, and "you are alone in the room" is deliberately not one of
    // them any more. In a room of one that was every message — which is what a
    // brand-new room is, so a first-time user met a bot that answered every
    // line they typed. See RUN_THIS_COACH_QUIET.sql.
    //
    // This mirrors public.notify_coach_mention(). If that SQL changes, change
    // this with it: the two agreeing is what makes the dots honest.
    // A REPLY to something it said — not "it spoke last". Its own answer is
    // always the last message, so that rule made every message afterwards a
    // question and it never stopped talking.
    const parent = replyToId ? (messages ?? []).find((m) => m.id === replyToId) : null;
    const answeringCoach = !!parent && parent.messageType === "coach_answer";
    if (/@coach\b/i.test(content) || answeringCoach) setCoachThinking(true);
    const result = await sendMessage(content, user.id, replyToId, media, {
      senderName,
      huddleName,
    });
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 300);
    return result;
  };

  return (
    <SafeAreaView className="flex-1" edges={["top"]} style={{ backgroundColor: colors.huddleGround }}>
      {/* Gradient by default, the room's photo when somebody set one —
          never the seeded og-teams tile. See RoomBackground. */}
      <RoomBackground photoUrl={huddle.photoUrl} />
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <HuddleHeader huddle={huddle} onInvite={() => setShowInvite(true)} />

        {/* The JUMP rail used to be here: a horizontal strip of room pills
            costing ~40px of every room on every screen, whether or not anybody
            wanted to leave. Moving between rooms is navigation, not furniture,
            so it's a swipe now — see useRoomSwipe, wired to the thread below.
            Same rooms, same order, zero pixels until you use it. */}

        {/* Fades live in the chat as cards. The rail that used to sit here ate
            the top of every room even when there was nothing to take, so the
            entry point is now a chip in the presence bar. */}
        {/* A DM IS NOT A ROOM. Underneath it is a huddle, which is why this
            furniture was turning up in a conversation between two people: a
            strip of faces of the two of you, and an Add for a thread that
            cannot take a third. */}
        {huddle.isDm ? null : (
        <PresenceBar
          users={presentUsers}
          members={roomMembers}
          entryBanner={entryBanner}
          onSeeAll={() =>
            (navigation as any).navigate("HuddleSettings", { huddleId })
          }
          onInvite={() => setShowInvite(true)}
          rightSlot={
            <View className="flex-row items-center gap-2">
              {/* Fade is gone from the room. It was retired as a mechanic and
                  this chip was the last surface still offering it — a button
                  that starts something nobody is going to finish. Polls and
                  trivia are the direction instead, and they sit in the ＋ as
                  coming rather than pretending to work. FadeButton and
                  PostFadeSheet stay in the tree, unmounted, so the work is
                  recoverable if the mechanic comes back. */}
              {/* Rally moved into the ⋯ menu. The renderings put nothing in
                  this row but the faces and the invite ＋ — a green button
                  shouting "Rally the huddle" above the thread is chrome
                  competing with the conversation, and it is a thing you do
                  once a game rather than something that needs a permanent
                  seat. */}
            </View>
          }
        />
        )}

        {/* UNDER THE AVATARS, which is where the design put it and where it
            belongs — it is about those faces. I had it above the composer
            because that is where the other action bars live in this file,
            which is an implementation habit, not a reason. */}
        {huddle.isGameRoom && huddle.gameId && !huddle.isDm ? (
          <SpinUpBar
            gameId={huddle.gameId}
            friendsHere={friendsHere}
            navigation={navigation}
          />
        ) : null}

        {/* The same move out of the community room, which is the one room on
            a team that is full of strangers by design. */}
        {huddle.isOfficialTeam && huddle.teamId && !huddle.isDm && user ? (
          <CommunitySpinUpBar
            userId={user.id}
            teamId={huddle.teamId}
            teamName={huddle.teamName ?? null}
            displayName={profile?.displayName ?? null}
            friendsHere={friendsHere}
            navigation={navigation}
          />
        ) : null}

        {/* THE ROOM'S OWN PICTURE, behind the conversation.
            Header, jump row and composer stay opaque on purpose — a photo
            running under the chrome makes the room name hard to read and the
            screen feel like a poster instead of a chat.

            The scrim is doing real work: message bubbles are already solid
            (ChatMessage uses bg-card / bg-primary), but the day separators,
            the empty state and the timestamps sit directly on the background,
            and a bright tailgate photo turns those into nothing. */}
        {showSwipeHint ? (
          <Pressable
            onPress={() => setShowSwipeHint(false)}
            className="flex-row items-center justify-center gap-2 border-b border-border px-4 py-2"
            style={{ backgroundColor: "rgba(245,197,24,0.08)" }}
          >
            <Type variant="data" tone="primary" style={{ fontSize: 11 }}>
              ← swipe sideways to your other rooms
            </Type>
          </Pressable>
        ) : null}

        <View className="flex-1" {...swipeHandlers}>
          {/* NO BACKGROUND PHOTO. "Before, During, After" ends with the
              reason, and it is not a style opinion: "the upload made text
              harder to read and added nothing." A tiled crest behind every
              message is the thing that made the built room look nothing like
              the design, and no scrim setting rescues it — 0.72, 0.88 and 0.94
              were all tried and all of them still fight the thread.

              The room photo still exists as a setting; it just isn't wallpaper
              any more. */}

        {messagesLoading ? (
          <LoadingSpinner className="flex-1" />
        ) : (
          <FlatList
            ref={flatListRef}
            data={listItems}
            keyExtractor={(item) =>
              item.type === "separator" || item.type === "load-more"
                ? item.key
                : item.data.id
            }
            renderItem={({ item, index }) => {
              if (item.type === "separator") {
                return (
                  <View className="my-4 flex-row items-center gap-3 px-6">
                    <View className="h-px flex-1 bg-border" />
                    <Type variant="captionStrong" tone="muted">
                      {item.label}
                    </Type>
                    <View className="h-px flex-1 bg-border" />
                  </View>
                );
              }

              if (item.type === "load-more") {
                return (
                  <Pressable
                    className="my-4 items-center py-3"
                    onPress={loadMore}
                    disabled={loadingMore}
                  >
                    {loadingMore ? (
                      <ActivityIndicator color={colors.primary} />
                    ) : (
                      <Type variant="captionStrong" tone="primary">
                        Load older messages
                      </Type>
                    )}
                  </Pressable>
                );
              }

              const msg = item.data;
              const parentMsg = msg.replyToId ? messageMap.get(msg.replyToId) : undefined;
              const isReply = !!parentMsg;

              // Consecutive grouping: drop the name when the line directly
              // ABOVE is the same person inside five minutes.
              //
              // In reading order index-1 is the older message, so the delta is
              // positive and the five-minute window means something. Built the
              // other way round it was always negative, so the window never
              // applied and a name was dropped from a message an hour later.
              const prev = index > 0 ? listItems[index - 1] : null;
              const prevMsg =
                prev && (prev as any).type === "message"
                  ? (prev as any).data
                  : null;
              const isGroupedWithPrev =
                !!prevMsg &&
                prevMsg.userId === msg.userId &&
                new Date(msg.createdAt).getTime() -
                  new Date(prevMsg.createdAt).getTime() <
                  5 * 60 * 1000 &&
                !msg.isBotMessage;

              return (
                <ChatMessage
                  message={msg}
                  isOwnMessage={msg.userId === user?.id}
                  huddleId={huddleId}
                  huddleName={huddle.name}
                  huddleIsLocked={huddle.isPrivate}
                  partnerName={partnerName}
                  reactions={reactionsMap?.get(msg.id)}
                  onReact={(emoji) =>
                    toggleReaction(msg.id, emoji, huddleId)
                  }
                  onReply={() => handleReply(msg)}
                  isReply={isReply}
                  hideReplyQuote={!!prevMsg && prevMsg.id === msg.replyToId}
                  isGroupedWithPrev={isGroupedWithPrev}
                  onPhoto={isRealRoomPhoto(huddle.photoUrl)}
                  // Drives the admin_welcome card's single CTA straight into
                  // the invite sheet the header already opens.
                  onInvite={() => setShowInvite(true)}
                  onDeleted={() =>
                    queryClient.invalidateQueries({ queryKey: ["huddle-messages", huddleId] })
                  }
                  replyTo={
                    parentMsg
                      ? {
                          displayName:
                            parentMsg.displayName ?? parentMsg.username ?? "User",
                          content: parentMsg.content,
                        }
                      : null
                  }
                />
              );
            }}
            // Prediction cards are NOT pinned chrome — the bot drops them
            // inline in chat around game time, and the perpetual home for
            // your team's markets is the Picks tab.
            ListEmptyComponent={
              <View className="flex-1 items-center justify-center px-4 py-12">
                <Type variant="caption" tone="muted">
                  Say something to start the room.
                </Type>
              </View>
            }
            // Bottom-anchored. A two-message room sits just above the
            // composer instead of stranded under the header with a screen of
            // black beneath it.
            contentContainerStyle={{
              paddingTop: 8,
              paddingBottom: 14,
              flexGrow: 1,
              justifyContent: "flex-end",
            }}
            onContentSizeChange={keepAtBottom}
            onLayout={keepAtBottom}
            onScroll={(e) => {
              const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
              atBottomRef.current =
                contentSize.height - layoutMeasurement.height - contentOffset.y < 80;
            }}
            scrollEventThrottle={16}
            keyboardShouldPersistTaps="handled"
            // Getting OUT of the composer. "Tap outside to dismiss" cannot work
            // in a chat: nearly everything above the keyboard is a message
            // bubble, and bubbles are pressable (reply, long-press), so
            // keyboardShouldPersistTaps="handled" correctly treats those taps as
            // handled and the keyboard stays up. Dragging is the gesture every
            // messaging app actually uses — on iOS "interactive" follows your
            // finger the way iMessage does, and Android has no equivalent so it
            // dismisses on the drag instead.
            keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
            onScrollToIndexFailed={(info) => {
              setTimeout(() => {
                flatListRef.current?.scrollToIndex({
                  index: info.index,
                  animated: true,
                  viewPosition: 0.5,
                });
              }, 500);
            }}
          />
        )}

        {/* Reactions in flight, over the thread and under nothing. They write
            no message — a close fourth quarter produces hundreds of these and
            recording each one would bury the conversation under its own
            applause. Everyone in the room sees them at the same moment, and
            in four seconds they're gone. */}
        <FloatingReactions reactions={liveReactions} />
        </View>

        {/* Not a member: a way IN, rather than nothing.
            The message box was simply not rendered for non-members, so
            somebody who tapped "Jump in" from a friend's presence could read
            the room and had no input, no explanation and no button — they
            were "in" by every visible sign and mute. That is the bug people
            hit when they were invited and gave up. */}
        {user && !huddle.isMember && (
          <View className="border-t border-border px-4 py-3" style={{ backgroundColor: colors.huddleGroundAlt }}>
            <Type center variant="caption" tone="muted" className="mb-2">
              You're reading {huddle.name}. Join to chat.
            </Type>
            <Pressable
              disabled={joining}
              onPress={async () => {
                setJoining(true);
                try {
                  const { error } = await supabase
                    .from("huddle_members")
                    .insert({ huddle_id: huddleId, user_id: user.id });
                  // Already a member is not a failure — treat it as success
                  // and let the refetch settle the truth.
                  if (error && !String(error.code).startsWith("23505")) throw error;
                  await queryClient.invalidateQueries({ queryKey: ["huddle-details", huddleId] });
                  await queryClient.invalidateQueries({ queryKey: ["user-huddles"] });
                } catch (e) {
                  Alert.alert(
                    "Couldn't join",
                    e instanceof Error && e.message.includes("row-level security")
                      ? "This room is invite-only. Ask whoever runs it for a link."
                      : e instanceof Error ? e.message : String(e),
                  );
                } finally {
                  setJoining(false);
                }
              }}
              className="rounded-full bg-primary py-3.5 active:opacity-80"
            >
              <Type center variant="heading" tone="onPrimary">
                {joining ? "Joining…" : "Join this huddle"}
              </Type>
            </Pressable>
          </View>
        )}

        {user && huddle.isMember && (
          <>
            {typingUsers.length > 0 && (
              <Type variant="caption" tone="muted" className="border-t border-border px-4 pt-2 italic"
                style={{ backgroundColor: colors.huddleGroundAlt }}>
                {typingUsers.map((typingUser) => typingUser.displayName).join(", ")}
                {typingUsers.length === 1 ? " is" : " are"} typing...
              </Type>
            )}
            {coachThinking && <CoachThinking />}
            {/* THE RAIL IS GONE. It was one of three ways to react — rail,
                double-tap, long-press picker — and the three disagreed with
                each other and with the hint under the composer. Reacting is
                double-tapping the message you are reacting TO, which is also
                the only one of the three that says what it is about.

                ReactionRail stays in the tree for FloatingReactions, which
                still draws the ones in flight. */}
            {/* THE PRE-GAME RSVP IS GONE. It was mine — commit 99367fb, not
                in any artifact and never asked for. The seed is real ("Before,
                During, After" opens the pre-game screen with a "Who's actually
                watching?" card) but that is a card IN the thread that scrolls
                away, not a permanent bar wedged between the thread and the
                composer clipping the newest message.

                PregameStrip and huddle_game_rsvps stay in the tree, unmounted,
                so the work is recoverable if the pre-game screen gets built
                properly. */}
          <MessageInput
            onSend={handleSend}
            replyTo={replyTo}
            onCancelReply={() => setReplyTo(null)}
            onFocus={scrollToBottom}
            onTypingChange={sendTyping}
            mentionables={mentionables}
            // Not gated on a live game any more. The ◉ is the capture
            // button; what it captures should not change because a game
            // finished twenty minutes ago.
            onFaceReaction={handleFaceReaction}
          />
          </>
        )}
      </KeyboardAvoidingView>

      <PullInFriendsModal
        visible={showInvite}
        huddleId={huddleId}
        huddleName={huddle.name}
        rallied={invitedViaRally}
        onClose={() => {
          setShowInvite(false);
          setInvitedViaRally(false);
        }}
      />
    </SafeAreaView>
  );
}

type DevRoomMessage = {
  id: string;
  author: string;
  content: string;
  isOwn?: boolean;
  isBot?: boolean;
  isSystem?: boolean;
  botType?: "news" | "prediction";
  mediaUri?: string;
  // "video" belongs here as well — face reactions are videos, and
  // leaving it out made the local echo reject its own message.
  mediaType?: "image" | "audio" | "video";
  replies?: { id: string; author: string; content: string; isOwn?: boolean }[];
  time?: string;
};

type DevRoomPerson = {
  id: string;
  name: string;
  status: "watching" | "online" | "away";
};

type DevStoredRoom = {
  id: string;
  name: string;
  teamId?: string | null;
  teamName?: string | null;
  teamCity?: string | null;
  teamLogoUrl?: string | null;
  relationship?: "owner" | "joined";
  accessMode?: "link" | "private";
  memberCount?: number;
  createdAt?: string;
};

const DEV_ROOM_MESSAGES_STORAGE_PREFIX = "side-huddle-dev-room-v5-messages";

const DEV_TEAM_VISUALS: Record<
  string,
  { abbr: string; color: string; ink: string }
> = {
  "10000000-0000-4000-8000-000000000001": {
    abbr: "CHI",
    color: "#0B162A",
    ink: "#C83803",
  },
  "10000000-0000-4000-8000-000000000002": {
    abbr: "CHI",
    color: "#1A1A1E",
    ink: "#CE1141",
  },
  "10000000-0000-4000-8000-000000000009": {
    abbr: "NYK",
    color: "#0B2240",
    ink: "#F58426",
  },
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return (parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : name.slice(0, 2)).toUpperCase();
}

function personColors(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) h = (h * 31 + name.charCodeAt(i)) % 360;
  return {
    bg: `hsl(${h}, 26%, 19%)`,
    fg: `hsl(${h}, 48%, 74%)`,
    line: `hsl(${h}, 24%, 30%)`,
  };
}

function getDevTeamVisual(teamId?: string, fallbackName = "Team") {
  const configured = teamId ? DEV_TEAM_VISUALS[teamId] : undefined;
  if (configured) return configured;
  return {
    abbr: fallbackName
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .slice(0, 3)
      .toUpperCase() || "SH",
    color: "#171A21",
    ink: colors.primary,
  };
}

function getBotName(teamLabel: string) {
  const parts = teamLabel.split(/\s+/).filter(Boolean);
  const name = parts[parts.length - 1] ?? "Team";
  return name.toLowerCase() === "team" ? "Room Bot" : `${name} Bot`;
}

function DevAvatar({ name, size = 34 }: { name: string; size?: number }) {
  const p = personColors(name);
  return (
    <View
      className="items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        backgroundColor: p.bg,
        borderColor: p.line,
        borderWidth: 1,
      }}
    >
      <Text style={{ color: p.fg, fontSize: size * 0.35, fontFamily: fonts.display }}>
        {initials(name)}
      </Text>
    </View>
  );
}

function TeamTile({
  visual,
  size = 34,
}: {
  visual: { abbr: string; color: string; ink: string };
  size?: number;
}) {
  return (
    <View
      className="items-center justify-center overflow-hidden"
      style={{
        width: size,
        height: size,
        borderRadius: Math.max(8, size * 0.28),
        backgroundColor: visual.color,
        borderColor: "rgba(255,255,255,0.12)",
        borderWidth: 1,
      }}
    >
      <View
        className="absolute bottom-0 left-0 top-0"
        style={{ width: 3, backgroundColor: visual.ink }}
      />
      <Type variant="heading"  style={{ fontSize: size * 0.29 }}>
        {visual.abbr}
      </Type>
    </View>
  );
}

function AvatarStack({
  names,
  size = 22,
}: {
  names: string[];
  size?: number;
}) {
  return (
    <View className="flex-row items-center">
      {names.slice(0, 4).map((name, index) => (
        <View
          key={`${name}-${index}`}
          className="rounded-full"
          style={{
            marginLeft: index > 0 ? -size * 0.35 : 0,
            borderWidth: 2,
            borderColor: colors.card,
          }}
        >
          <DevAvatar name={name} size={size} />
        </View>
      ))}
    </View>
  );
}

function renderMentionText(text: string, className: string) {
  return text.split(/(@\w+)/g).map((part, index) => (
    <Text
      key={`${part}-${index}`}
      className={/^@\w+/.test(part) ? "font-black text-primary" : className}
    >
      {part}
    </Text>
  ));
}

function titleFromDevRoomId(huddleId: string) {
  return huddleId
    .replace(/^dev-room-/, "")
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function DevRoomMessageRow({
  item,
  teamVisual,
  onReply,
  onImagePress,
}: {
  item: DevRoomMessage;
  teamVisual: { abbr: string; color: string; ink: string };
  onReply: (item: DevRoomMessage) => void;
  onImagePress: (uri: string) => void;
}) {
  if (item.isSystem) {
    return (
      <View className="items-center px-4 py-3">
        <Type variant="captionStrong" tone="muted">
          {item.content}
        </Type>
      </View>
    );
  }

  if (item.isBot) {
    return (
      <View className="mb-4 px-1">
        <View className="mb-2 flex-row items-center gap-2">
          <TeamTile visual={teamVisual} size={23} />
          <Type variant="caption" tone="muted" className="ml-auto">
            {item.time ?? "now"}
          </Type>
        </View>

        {item.botType === "prediction" ? (
          <View className="rounded-xl border border-border bg-card">
            <View className="flex-row items-center gap-2 border-b border-border px-4 py-2.5">
              <Type variant="eyebrow" tone="muted" className="rounded border border-info/40 bg-info/10 px-1.5 py-0.5 text-info">
                Market
              </Type>
              <Type variant="eyebrow" tone="muted">
                Prediction Market
              </Type>
              <Type variant="captionStrong" tone="success" className="ml-auto">+4%</Type>
            </View>
            <View className="p-4">
              <Type variant="heading">
                {item.content}
              </Type>
              <View className="mt-4 h-1.5 flex-row overflow-hidden rounded-full bg-destructive/45">
                <View className="h-full bg-success" style={{ width: "54%" }} />
              </View>
              <View className="mt-3 flex-row gap-2">
                <Pressable className="flex-1 flex-row items-center justify-center gap-2 rounded-xl border border-success/50 bg-success/15 py-3 active:opacity-80">
                  <Type variant="heading" tone="success">Yes</Type>
                  <Type variant="heading" tone="success">54c</Type>
                </Pressable>
                <Pressable className="flex-1 flex-row items-center justify-center gap-2 rounded-xl border border-border bg-muted py-3 active:opacity-80">
                  <Type variant="heading">No</Type>
                  <Type variant="heading" tone="muted">46c</Type>
                </Pressable>
              </View>
            </View>
          </View>
        ) : (
          <View className="rounded-xl border border-border bg-muted p-4">
            <Type variant="bodyStrong">
              {item.content}
            </Type>
          </View>
        )}
      </View>
    );
  }

  return (
    <View className="mb-4 px-1">
      <View className={item.isOwn ? "flex-row-reverse gap-2" : "flex-row gap-2"}>
        {item.isOwn ? (
          <View className="w-8" />
        ) : (
          <View className="pt-5">
            <DevAvatar name={item.author} size={30} />
          </View>
        )}
        <View className={item.isOwn ? "flex-1 items-end" : "flex-1 items-start"}>
          {!item.isOwn ? (
            <View className="mb-1 flex-row items-baseline gap-2 pl-1">
              <Type variant="captionStrong">{item.author}</Type>
              <Type variant="data" tone="muted">
                {item.time ?? "now"}
              </Type>
            </View>
          ) : null}

          <View
            className={
              item.isOwn
                ? "max-w-[82%] rounded-2xl bg-primary px-4 py-3"
                : "max-w-[82%] rounded-2xl border border-border bg-muted px-4 py-3"
            }
            style={{
              borderTopRightRadius: item.isOwn ? 5 : 16,
              borderTopLeftRadius: item.isOwn ? 16 : 5,
            }}
          >
            <Text
              className={
                item.isOwn
                  ? "text-base font-semibold leading-6 text-primary-foreground"
                  : "text-base leading-6 text-foreground"
              }
            >
              {renderMentionText(
                item.content,
                item.isOwn ? "text-primary-foreground" : "text-foreground",
              )}
            </Text>
            {item.mediaUri && item.mediaType === "image" ? (
              <Pressable onPress={() => onImagePress(item.mediaUri!)} className="mt-3">
                <Image
                  source={{ uri: item.mediaUri }}
                  className="h-48 w-64 rounded-xl"
                  resizeMode="cover"
                />
              </Pressable>
            ) : null}
            {item.mediaUri && item.mediaType === "audio" ? (
              <Text
                className={
                  item.isOwn
                    ? "mt-2 text-sm font-semibold text-primary-foreground"
                    : "mt-2 text-sm font-semibold text-muted-foreground"
                }
              >
                Voice message attached
              </Text>
            ) : null}
          </View>

          {item.replies?.length ? (
            <View
              className={
                item.isOwn
                  ? "mr-3 mt-2 gap-2 border-r-2 border-border pr-3"
                  : "ml-3 mt-2 gap-2 border-l-2 border-border pl-3"
              }
            >
              {item.replies.map((reply) => (
                <View
                  key={reply.id}
                  className={
                    item.isOwn
                      ? "flex-row-reverse items-start gap-2"
                      : "flex-row items-start gap-2"
                  }
                >
                  <DevAvatar name={reply.author} size={21} />
                  <Text
                    className={
                      item.isOwn
                        ? "max-w-[220px] text-right text-xs leading-5 text-muted-foreground"
                        : "max-w-[220px] text-xs leading-5 text-muted-foreground"
                    }
                  >
                    <Type variant="heading">{reply.author} </Type>
                    {reply.content}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          <Pressable onPress={() => onReply(item)} hitSlop={8}>
            <Type variant="dataStrong" tone="muted" className="mt-1.5">
              Reply
            </Type>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function DevHuddleRoom({ huddleId }: { huddleId: string }) {
  const navigation = useNavigation();
  const [roomTitle, setRoomTitle] = useState(
    titleFromDevRoomId(huddleId) || "Game Room",
  );
  const [showPeople, setShowPeople] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [roomRelationship, setRoomRelationship] = useState<"owner" | "joined">(
    huddleId.includes("my-room") ? "owner" : "joined",
  );
  const [roomAccessMode, setRoomAccessMode] = useState<"link" | "private">("link");
  const [expandedImageUri, setExpandedImageUri] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<{
    id: string;
    displayName: string;
    content: string;
  } | null>(null);
  const [roomTeamId, setRoomTeamId] = useState<string | undefined>(undefined);
  const [availableRooms, setAvailableRooms] = useState<DevStoredRoom[]>([]);
  const flatListRef = useRef<FlatList<DevRoomMessage>>(null);
  const roomTeam = roomTeamId ? getDevTeamById(roomTeamId) : undefined;
  const { data: game } = useLiveGameContext(roomTeam?.id);
  const gameState = getGameState(game ?? null);
  const teamLabel = roomTeam
    ? `${roomTeam.city} ${roomTeam.name}`
    : roomTitle;
  const present = useMemo<DevRoomPerson[]>(
    () => [{ id: "you", name: "You", status: "watching" }],
    [],
  );
  const teamVisual = getDevTeamVisual(roomTeamId, teamLabel);
  const botName = roomTeam ? getBotName(teamLabel) : "Room Bot";
  const isOwnerRoom = roomRelationship === "owner";
  const [pinnedMessage, setPinnedMessage] = useState("");
  // Rooms start empty. The real bot fills in content; no fake seed messages.
  const buildSeedMessages = useCallback((): DevRoomMessage[] => [], []);
  const [messages, setMessages] = useState<DevRoomMessage[]>(() => buildSeedMessages());

  useEffect(() => {
    const loadDevRoom = async () => {
      const storedRooms = await AsyncStorage.getItem(DEV_ROOMS_STORAGE_KEY);
      const rooms = storedRooms ? (JSON.parse(storedRooms) as DevStoredRoom[]) : [];
      const room = rooms.find((item: any) => item.id === huddleId);
      // Prefer same-team rooms; fall back to all other rooms if the user has
      // no other rooms attached to the current room's team. Empty pills =
      // bad UX (esp. for users testing single rooms).
      const currentTeamId = room?.teamId ?? null;
      const others = rooms.filter((item) => item.id !== huddleId);
      const sameTeam = currentTeamId
        ? others.filter((item) => item.teamId === currentTeamId)
        : [];
      setAvailableRooms(sameTeam.length > 0 ? sameTeam : others);
      if (room?.name) {
        setRoomTitle(room.name);
        setRoomRelationship(room.relationship === "joined" ? "joined" : "owner");
        setRoomAccessMode(room.accessMode === "private" ? "private" : "link");
        setRoomTeamId(room.teamId ?? undefined);
      } else {
        setRoomTitle(titleFromDevRoomId(huddleId) || "Game Room");
        setRoomRelationship("owner");
        setRoomAccessMode("link");
        setRoomTeamId(undefined);
      }
      setShowMenu(false);
      setShowPeople(false);
      setReplyTo(null);
      setPinnedMessage("");

      const storedMessages = await AsyncStorage.getItem(
        `${DEV_ROOM_MESSAGES_STORAGE_PREFIX}-${huddleId}`,
      );
      const savedMessages = storedMessages
        ? (JSON.parse(storedMessages) as DevRoomMessage[])
        : [];
      setMessages(savedMessages);
    };

    loadDevRoom();
  }, [buildSeedMessages, huddleId]);

  useEffect(() => {
    requestAnimationFrame(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    });
  }, [messages.length]);

  const handleSend = async (
    content: string,
    replyToId?: string,
    media?: { uri: string; type: "image" | "audio" | "video" },
  ) => {
    const nextMessage = {
      id: `own-${Date.now()}`,
      author: "You",
      content,
      isOwn: true,
      mediaUri: media?.uri,
      mediaType: media?.type,
      time: "now",
    } satisfies DevRoomMessage;

    if (replyToId) {
      setMessages((prev) =>
        prev.map((message) =>
          message.id === replyToId
            ? {
                ...message,
                replies: [
                  ...(message.replies ?? []),
                  {
                    id: `reply-${Date.now()}`,
                    author: "You",
                    content,
                    isOwn: true,
                  },
                ],
              }
            : message,
        ),
      );
    } else {
      setMessages((prev) => [...prev, nextMessage]);
    }
    setReplyTo(null);
    Keyboard.dismiss();

    const storageKey = `${DEV_ROOM_MESSAGES_STORAGE_PREFIX}-${huddleId}`;
    const storedMessages = await AsyncStorage.getItem(storageKey);
    const existing = storedMessages
      ? (JSON.parse(storedMessages) as DevRoomMessage[])
      : [];
    if (!replyToId) {
      await AsyncStorage.setItem(
        storageKey,
        JSON.stringify([...existing, nextMessage]),
      );
    }
    return { error: null };
  };

  const handleReply = (message: DevRoomMessage) => {
    if (message.isBot || message.isSystem) return;
    setReplyTo({
      id: message.id,
      displayName: message.author,
      content: message.content,
    });
  };

  const handleShareRoom = () => {
    Share.share({
      message: `Jump into ${roomTitle} on Side Huddle.`,
    });
  };

  const handlePin = () => {
    if (pinnedMessage) {
      setPinnedMessage("");
      return;
    }
    // iOS supports Alert.prompt; Android falls back to a fixed default.
    if (Platform.OS === "ios" && (Alert as any).prompt) {
      (Alert as any).prompt(
        "Pin a message",
        "Pin a short note to the top of this room.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Pin",
            onPress: (value?: string) => {
              const text = (value ?? "").trim();
              if (text) setPinnedMessage(text);
            },
          },
        ],
        "plain-text",
      );
    } else {
      setPinnedMessage("Room is open. Check in while you watch.");
    }
  };

  const handleCloseRoom = () => {
    Alert.alert(
      isOwnerRoom ? "Close room?" : "Leave room?",
      isOwnerRoom
        ? "This will remove the room from your device. People you invited will lose access."
        : "You can rejoin later from your invite link.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: isOwnerRoom ? "Close" : "Leave",
          style: "destructive",
          onPress: async () => {
            try {
              const stored = await AsyncStorage.getItem(DEV_ROOMS_STORAGE_KEY);
              if (stored) {
                const rooms = JSON.parse(stored) as DevStoredRoom[];
                const next = rooms.filter((r) => r.id !== huddleId);
                await AsyncStorage.setItem(DEV_ROOMS_STORAGE_KEY, JSON.stringify(next));
              }
              await AsyncStorage.removeItem(`${DEV_ROOM_MESSAGES_STORAGE_PREFIX}-${huddleId}`);
            } finally {
              navigation.goBack();
            }
          },
        },
      ],
    );
  };

  const opponentLabel =
    game?.homeTeamName || game?.awayTeamName
      ? `${game.awayTeamCity ?? ""} ${game.awayTeamName ?? "Away"} at ${game.homeTeamCity ?? ""} ${game.homeTeamName ?? "Home"}`
      : "No live game found";
  const scoreLabel = game
    ? `${game.awayScore ?? "-"}-${game.homeScore ?? "-"}`
    : "No score";
  const gameLabel =
    gameState === "live"
      ? "Live"
      : gameState === "pregame"
        ? "Next"
        : gameState === "postgame"
          ? "Final"
          : "Game";
  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View
          className="border-b border-border px-3 pb-2 pt-2"
          style={{ backgroundColor: colors.card }}
        >
          <View
            className="absolute left-0 right-0 top-0 h-0.5"
            style={{ backgroundColor: teamVisual.ink }}
          />
          <View className="flex-row items-center gap-2.5">
            <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
              <Type variant="display" tone="primary" className="px-1">‹</Type>
            </Pressable>
            <TeamTile visual={teamVisual} size={36} />
            <Pressable className="flex-1" onPress={() => setShowPeople(true)}>
              <View className="flex-row items-center gap-2">
                <Type variant="title" className="flex-1" numberOfLines={1}>
                  {roomTitle}
                </Type>
              </View>
              <View className="mt-1 flex-row items-center gap-2">
                <Type variant="caption" tone="muted"  numberOfLines={1}>
                  Members · {present.length} in room
                </Type>
              </View>
            </Pressable>
            <Pressable
              className="h-9 w-9 items-center justify-center rounded-full active:bg-muted"
              onPress={() => setShowMenu(true)}
              hitSlop={8}
            >
              <MoreVertical color={colors.mutedForeground} size={20} />
            </Pressable>
          </View>

          {game && gameState !== "none" ? (
            <View className="mt-2 rounded-lg border border-border bg-muted px-3 py-1.5">
              <View className="flex-row items-center gap-1.5">
                {gameState === "live" ? (
                  <View className="h-1.5 w-1.5 rounded-full bg-destructive" />
                ) : null}
                <Text
                  className={
                    gameState === "live"
                      ? "text-[10px] font-black uppercase tracking-wider text-destructive"
                      : "text-[10px] font-black uppercase tracking-wider text-primary"
                  }
                >
                  {gameLabel}
                </Text>
                <Type variant="data" tone="muted"  numberOfLines={1}>
                  {game ? formatGameClock(game) : ""}
                </Type>
              </View>
              <Type variant="captionStrong" className="mt-0.5" numberOfLines={1}>
                <Text>{game?.awayTeamName ?? "Away"} </Text>
                <Type variant="heading">{game?.awayScore ?? "-"}</Type>
                <Type variant="body" tone="muted"> · </Type>
                <Text>{game?.homeTeamName ?? "Home"} </Text>
                <Type variant="heading">{game?.homeScore ?? "-"}</Type>
              </Type>
            </View>
          ) : null}

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ alignItems: "center", gap: 8, paddingTop: 10 }}
          >
            <Type variant="eyebrow" tone="muted">
              Jump
            </Type>
            {availableRooms.length === 0 ? (
              <Type variant="captionStrong" tone="muted">
                No other rooms yet
              </Type>
            ) : null}
            {availableRooms.map((room) => {
              const active = room.id === huddleId;
              const avatarCount = Math.min(3, Math.max(1, room.memberCount ?? 1));
              return (
                <Pressable
                  key={room.id}
                  className={
                    active
                      ? "flex-row items-center gap-2 rounded-full border border-primary/40 bg-primary/15 py-1.5 pl-1.5 pr-3"
                      : "flex-row items-center gap-2 rounded-full border border-border bg-muted py-1.5 pl-1.5 pr-3"
                  }
                  onPress={() => {
                    if (!active) {
                      (navigation as any).navigate("Huddle", {
                        huddleId: room.id,
                      });
                    }
                  }}
                >
                  {/* Up to 3 overlapping avatar placeholders */}
                  <View className="flex-row" style={{ paddingRight: (avatarCount - 1) * 6 }}>
                    {Array.from({ length: avatarCount }).map((_, i) => (
                      <View
                        key={i}
                        className="h-5 w-5 items-center justify-center rounded-full border border-card bg-muted-foreground/40"
                        style={{ marginLeft: i === 0 ? 0 : -6 }}
                      >
                        <User color={colors.background} size={10} />
                      </View>
                    ))}
                  </View>
                  <Text
                    className={
                      active
                        ? "text-xs font-black text-primary"
                        : "text-xs font-bold text-muted-foreground"
                    }
                  >
                    {room.name}
                  </Text>
                  {!active ? <View className="h-1.5 w-1.5 rounded-full bg-primary" /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {pinnedMessage ? (
          <View className="flex-row items-center gap-2 border-b border-border bg-primary/10 px-4 py-2">
            <Pin color={colors.primary} size={13} />
            <Type variant="eyebrow" tone="primary">
              Pinned
            </Type>
            <Type variant="captionStrong" className="flex-1" numberOfLines={1}>
              {pinnedMessage}
            </Type>
          </View>
        ) : null}

        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-end", padding: 12, paddingBottom: 16 }}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
          onScrollBeginDrag={Keyboard.dismiss}
          renderItem={({ item }) => (
            <DevRoomMessageRow
              item={item}
              teamVisual={teamVisual}
              onReply={handleReply}
              onImagePress={setExpandedImageUri}
            />
          )}
          ListFooterComponent={null}
        />

        <MessageInput
          onSend={handleSend}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          onFocus={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />
      </KeyboardAvoidingView>

      <Modal
        visible={showMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMenu(false)}
      >
        <Pressable className="flex-1 bg-black/20" onPress={() => setShowMenu(false)}>
          <View className="items-end px-3 pt-24">
            <Pressable className="w-60 overflow-hidden rounded-2xl border border-border bg-card">
              {isOwnerRoom ? (
                <Pressable
                  className="flex-row items-center gap-3 border-b border-border px-4 py-3"
                  onPress={() => {
                    setShowMenu(false);
                    handlePin();
                  }}
                >
                  <Pin color={colors.primary} size={18} />
                  <Type variant="bodyStrong" tone="primary">
                    {pinnedMessage ? "Unpin message" : "Pin a message"}
                  </Type>
                </Pressable>
              ) : null}
              <Pressable
                className="flex-row items-center gap-3 border-b border-border px-4 py-3"
                onPress={() => {
                  setShowMenu(false);
                  handleShareRoom();
                }}
              >
                <UserPlus color={colors.mutedForeground} size={18} />
                <Type variant="bodyStrong">Invite people</Type>
              </Pressable>
              <Pressable
                className="flex-row items-center gap-3 px-4 py-3"
                onPress={() => {
                  setShowMenu(false);
                  handleCloseRoom();
                }}
              >
                <LogOut color={colors.destructive} size={18} />
                <Type variant="bodyStrong" tone="danger">
                  {isOwnerRoom ? "Close room" : "Leave room"}
                </Type>
              </Pressable>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={!!expandedImageUri}
        transparent
        animationType="fade"
        onRequestClose={() => setExpandedImageUri(null)}
      >
        <Pressable
          className="flex-1 items-center justify-center bg-black/90 px-4"
          onPress={() => setExpandedImageUri(null)}
        >
          {expandedImageUri ? (
            <Image
              source={{ uri: expandedImageUri }}
              className="h-[72%] w-full rounded-2xl"
              resizeMode="contain"
            />
          ) : null}
          <Type variant="captionStrong" className="mt-4">Tap anywhere to close</Type>
        </Pressable>
      </Modal>

      <Modal
        visible={showPeople}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPeople(false)}
      >
        <Pressable
          className="flex-1 justify-end bg-black/60"
          onPress={() => setShowPeople(false)}
        >
          <Pressable className="rounded-t-3xl border border-border bg-card px-5 pb-8 pt-4">
            <View className="mx-auto mb-4 h-1 w-12 rounded-full bg-muted-foreground/40" />
            <View className="flex-row items-start justify-between">
              <View>
                <Type variant="title">
                  Who’s in the room
                </Type>
                <Type variant="caption" tone="muted" className="mt-1">
                  {present.length} online · watching together
                </Type>
              </View>
              <Pressable onPress={() => setShowPeople(false)} hitSlop={8}>
                <Type variant="title" tone="muted">×</Type>
              </Pressable>
            </View>

            <View className="mt-5 gap-3">
              {present.map((friend) => (
                <View key={friend.id} className="flex-row items-center gap-3">
                  <DevAvatar name={friend.name} size={44} />
                  <View className="flex-1">
                    <Type variant="bodyStrong">{friend.name}</Type>
                    <Type variant="caption" tone="muted">
                      {friend.status === "watching"
                        ? "Watching game"
                        : friend.status === "online"
                          ? "Online"
                          : "Away"}
                    </Type>
                  </View>
                  <View
                    className={
                      friend.status === "watching"
                        ? "h-2.5 w-2.5 rounded-full bg-destructive"
                        : "h-2.5 w-2.5 rounded-full bg-success"
                    }
                  />
                </View>
              ))}
            </View>
            <Pressable
              className="mt-6 rounded-full bg-primary px-4 py-3 active:opacity-80"
              onPress={handleShareRoom}
            >
              <Type center variant="captionStrong" tone="onPrimary">
                Invite more friends
              </Type>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
