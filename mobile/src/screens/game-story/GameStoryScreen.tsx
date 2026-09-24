// The game story — everything the room shot, back to back.
//
// Nothing here is rendered or stitched into a file. The pieces are already in
// storage and already served to this room; this plays them in order, which is
// what stitched means to the person watching. A still holds for a beat, a clip
// runs but never past MAX_CLIP_MS — reactions go to fifteen seconds now, and
// six of those is a minute and a half of story nobody finishes.
//
// The sponsor's mark sits on the whole playback rather than under one message,
// and only when that team actually has a partner. It is small on purpose: the
// moment this reads as an advert people stop sharing it, and then it is worth
// nothing to the sponsor either.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import { Video, ResizeMode, type AVPlaybackStatus } from "expo-av";
import { X } from "lucide-react-native";
import { Type } from "@/components/ui/Type";
import { colors } from "@/theme/colors";
import { useHuddleMessages } from "@/hooks/useHuddleMessages";
import { useHuddleDetails } from "@/hooks/useHuddleDetails";
import { useLiveGameContext } from "@/hooks/useLiveGameContext";
import { useTeamSponsors, logSponsorTap } from "@/hooks/useTeamSponsor";
import { useAuth } from "@/hooks/useAuth";
import { useGameStory, PHOTO_MS, MAX_CLIP_MS } from "@/hooks/useGameStory";
import type { RootStackParamList } from "@/navigation/types";

type Route = RouteProp<RootStackParamList, "GameStory">;

export function GameStoryScreen() {
  const navigation = useNavigation();
  const { huddleId } = useRoute<Route>().params;
  const { user } = useAuth();

  const { data: huddle } = useHuddleDetails(huddleId);
  const { data: messages } = useHuddleMessages(huddleId);
  const { data: game } = useLiveGameContext(huddle?.teamId ?? undefined);
  const story = useGameStory(messages, game);
  const { data: sponsors } = useTeamSponsors(huddle?.teamId ?? null);
  const sponsor = sponsors?.[0] ?? null;

  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  // 0..1 across the current piece, so the bar moves with what is on screen
  // rather than on a timer that has nothing to do with it.
  const [progress, setProgress] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const items = story.items;
  const item = items[i] ?? null;

  const next = useCallback(() => {
    setProgress(0);
    setI((v) => {
      if (v + 1 >= items.length) {
        navigation.goBack();
        return v;
      }
      return v + 1;
    });
  }, [items.length, navigation]);

  const prev = () => {
    setProgress(0);
    setI((v) => Math.max(0, v - 1));
  };

  // A still advances on a clock. A clip advances when it ends, so its own
  // progress comes from playback below and this timer stays out of the way.
  useEffect(() => {
    if (timer.current) clearInterval(timer.current);
    if (!item || item.isVideo || paused) return;
    const step = 50;
    let elapsed = 0;
    timer.current = setInterval(() => {
      elapsed += step;
      setProgress(Math.min(1, elapsed / PHOTO_MS));
      if (elapsed >= PHOTO_MS) next();
    }, step);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [item, paused, next]);

  const onPlayback = (s: AVPlaybackStatus) => {
    if (!s.isLoaded) return;
    const dur = Math.min(s.durationMillis ?? MAX_CLIP_MS, MAX_CLIP_MS);
    setProgress(Math.min(1, (s.positionMillis ?? 0) / dur));
    // Cut a long reaction off at the cap rather than letting one clip eat the
    // story; didJustFinish covers the short ones.
    if (s.didJustFinish || (s.positionMillis ?? 0) >= dur) next();
  };

  if (!story.ready || !item) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: "#000000" }}>
      <SafeAreaView className="flex-1" edges={["top", "bottom"]}>
        {/* The piece itself, under everything. */}
        <View className="absolute inset-0 items-center justify-center">
          {item.isVideo ? (
            <Video
              key={item.id}
              source={{ uri: item.url }}
              style={{ width: "100%", height: "100%" }}
              resizeMode={ResizeMode.COVER}
              shouldPlay={!paused}
              isMuted={false}
              onPlaybackStatusUpdate={onPlayback}
            />
          ) : (
            <Image
              key={item.id}
              source={{ uri: item.url }}
              style={{ width: "100%", height: "100%" }}
              resizeMode="cover"
            />
          )}
        </View>

        {/* Tap right to go on, left to go back, hold anywhere to stop. The
            halves sit under the chrome so the close button still wins. */}
        <View className="absolute inset-0 flex-row">
          <Pressable
            className="flex-1"
            onPress={prev}
            onLongPress={() => setPaused(true)}
            onPressOut={() => setPaused(false)}
            delayLongPress={180}
          />
          <Pressable
            className="flex-1"
            onPress={next}
            onLongPress={() => setPaused(true)}
            onPressOut={() => setPaused(false)}
            delayLongPress={180}
          />
        </View>

        {/* Progress — one segment per piece, filled behind you, live on the
            one playing. */}
        <View className="flex-row gap-1 px-3 pt-2" pointerEvents="none">
          {items.map((it, k) => (
            <View
              key={it.id}
              className="h-0.5 flex-1 overflow-hidden rounded-full"
              style={{ backgroundColor: "rgba(255,255,255,0.3)" }}
            >
              <View
                style={{
                  height: "100%",
                  borderRadius: 999,
                  backgroundColor: colors.primary,
                  width: k < i ? "100%" : k === i ? `${progress * 100}%` : "0%",
                }}
              />
            </View>
          ))}
        </View>

        <View className="flex-row items-center gap-2.5 px-4 pt-3">
          {item.avatarUrl ? (
            <Image
              source={{ uri: item.avatarUrl }}
              style={{ width: 28, height: 28, borderRadius: 999 }}
            />
          ) : (
            <View
              className="h-7 w-7 items-center justify-center rounded-full"
              style={{ backgroundColor: colors.muted }}
            >
              <Type variant="caption" style={{ color: colors.foreground }}>
                {item.authorName.slice(0, 1).toUpperCase()}
              </Type>
            </View>
          )}
          <View className="flex-1">
            <Type variant="captionStrong" style={{ color: "#FFFFFF" }} numberOfLines={1}>
              {item.authorName}
            </Type>
            <Type variant="caption" style={{ color: "rgba(255,255,255,0.7)" }} numberOfLines={1}>
              {huddle?.name ?? "The room"}
            </Type>
          </View>
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={10}
            accessibilityLabel="Close story"
            className="h-9 w-9 items-center justify-center"
          >
            <X color="#FFFFFF" size={22} />
          </Pressable>
        </View>

        <View className="flex-1" pointerEvents="none" />

        <View className="px-4 pb-3" pointerEvents="box-none">
          {item.caption ? (
            <View
              className="mb-3 self-start rounded-xl px-3 py-2"
              style={{ backgroundColor: "rgba(9,9,12,0.82)" }}
            >
              <Type variant="caption" style={{ color: "#E4E4EC" }}>
                {item.caption}
              </Type>
            </View>
          ) : null}

          {sponsor ? (
            <Pressable
              onPress={() => {
                logSponsorTap({
                  sponsorId: sponsor.id,
                  huddleId,
                  userId: user?.id ?? null,
                });
                Linking.openURL(sponsor.linkUrl).catch(() => {});
              }}
              className="flex-row items-center gap-2 self-start"
            >
              <Type variant="caption" style={{ color: "rgba(255,255,255,0.55)" }}>
                powered by
              </Type>
              {sponsor.logoUrl ? (
                <Image
                  source={{ uri: sponsor.logoUrl }}
                  style={{ width: 18, height: 18, borderRadius: 4 }}
                />
              ) : null}
              <Type variant="captionStrong" style={{ color: "rgba(255,255,255,0.85)" }}>
                {sponsor.brandName}
              </Type>
            </Pressable>
          ) : null}
        </View>
      </SafeAreaView>
    </View>
  );
}
