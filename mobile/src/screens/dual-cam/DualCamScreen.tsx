import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import { SwitchCamera, X } from "lucide-react-native";
import { DualCam, DualCamPreview } from "../../../modules/dual-cam";
import { Type } from "@/components/ui/Type";
import { MAX_SECONDS } from "@/lib/faceReaction";
import { colors } from "@/theme/colors";
import type { RootStackParamList } from "@/navigation/types";

type Route = RouteProp<RootStackParamList, "DualCam">;

/** Below this a press is a tap, not a very short film. */
const TAP_MS = 350;

/**
 * Both cameras. Tap for a photo, hold to record.
 *
 * WHY IT LATCHES. Holding a button while pointing a phone at a television is a
 * two-hand job, and the moment worth filming is exactly the one you need both
 * hands to line up for. So a hold past 1.2 seconds locks: let go, frame the
 * shot, tap again to stop. Short holds still behave the way every camera app
 * has trained people — press, film, release — because that is what a
 * three-second reaction wants.
 *
 * Your face is the frame and the game sits in the corner, the same arrangement
 * the recorder composites, so what you line up is what you get. The swap button
 * puts the field back in front for anyone who wants it that way.
 *
 * The score line sits under the preview rather than over it. It is burned into
 * the message, not the video: rendering it into the frame would bake a
 * scoreboard into a file we cannot correct if the feed was wrong, and it would
 * be unreadable at thumbnail size anyway.
 */
export function DualCamScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<Route>();
  const gameContext = route.params?.gameContext ?? null;

  const [ready, setReady] = useState(false);
  const [recording, setRecording] = useState(false);
  /** Which camera is the frame. Back by default — the game is the subject,
      your face is the reaction to it. */
  // SELFIE IN FRONT BY DEFAULT.
  //
  // The back camera was the frame and the face was the corner inset, which is
  // the arrangement every camera app uses and the wrong one here: the thing
  // nobody else can film is the person's reaction, and the game is on
  // television. The face leads, the game sits in the corner, and the swap
  // button still puts it back for anyone who wants the field big.
  const [swapped, setSwapped] = useState(true);
  const [elapsed, setElapsed] = useState(0);

  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pressedAt = useRef(0);
  // Interval and timeout callbacks close over the render that created them, so
  // the live values have to live in refs rather than state.
  const recordingRef = useRef(false);

  const clearTimers = () => {
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      const perms = await DualCam.requestPermissions();
      if (!alive) return;
      if (!perms.camera || !perms.microphone) {
        Alert.alert(
          "Camera and mic are off",
          "Side Huddle needs both to record a reaction. You can turn them on in Settings.",
          [{ text: "OK", onPress: () => navigation.goBack() }],
        );
        return;
      }
      // Bring the session up before anybody touches anything. A tap has to
      // produce a photo immediately, and a camera that only starts on first
      // press misses the thing the press was for.
      await DualCam.prepare();
      if (alive) setReady(true);
    })();

    return () => {
      alive = false;
      clearTimers();
      // Two live camera inputs is the most expensive thing this app can leave
      // running. Never rely on the screen unmounting quietly.
      DualCam.dismiss();
    };
  }, [navigation]);

  // The recorder starts at its own default, and the screen's state is only
  // pushed across when somebody taps swap — so a default set in one place and
  // not the other composites a video that does not match the preview. Say it
  // once on mount.
  useEffect(() => {
    DualCam.setSwapped(swapped);
    // Mount only: every later change goes through the button, which sets both.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hand = useCallback(
    (uri: string, isVideo: boolean) => {
      route.params?.onCapture?.({ uri, context: gameContext, isVideo });
      navigation.goBack();
    },
    [gameContext, navigation, route.params],
  );

  const stopRecording = useCallback(async () => {
    clearTimers();
    recordingRef.current = false;
    setRecording(false);

    try {
      const { uri } = await DualCam.stop();
      hand(uri, true);
    } catch (err: any) {
      Alert.alert("Couldn't save that", err?.message ?? "Try again in a moment.");
    }
  }, [hand]);

  const takePhoto = useCallback(async () => {
    try {
      const uri = await DualCam.capturePhoto();
      hand(uri, false);
    } catch (err: any) {
      Alert.alert("Couldn't take that", err?.message ?? "Try again in a moment.");
    }
  }, [hand]);

  const beginRecording = useCallback(async () => {
    try {
      await DualCam.start();
    } catch (err: any) {
      Alert.alert("Couldn't start", err?.message ?? "Try again in a moment.");
      return;
    }
    recordingRef.current = true;
    setRecording(true);
    setElapsed(0);

    timer.current = setInterval(() => {
      setElapsed((n) => {
        const next = n + 0.1;
        // A backstop, not the main mechanism: letting go is what normally
        // ends a recording now.
        if (next >= MAX_SECONDS) void stopRecording();
        return next;
      });
    }, 100);
  }, [stopRecording]);

  const onPressIn = useCallback(() => {
    if (!ready) return;
    pressedAt.current = Date.now();
    void beginRecording();
  }, [beginRecording, ready]);

  const onPressOut = useCallback(() => {
    if (!ready) return;
    const held = Date.now() - pressedAt.current;

    // A quick press is a photo, not a quarter-second film. Recording starts on
    // press-down either way — waiting to find out which it was would miss the
    // first moment of every clip — so a tap throws that fragment away.
    if (held < TAP_MS) {
      clearTimers();
      recordingRef.current = false;
      setRecording(false);
      DualCam.stop().catch(() => {});
      void takePhoto();
      return;
    }

    void stopRecording();
  }, [ready, stopRecording, takePhoto]);



  return (
    <SafeAreaView className="flex-1 bg-black" edges={["top", "bottom"]}>
      <View className="flex-1">
        <DualCamPreview active={ready} swapped={swapped} style={StyleSheet.absoluteFill} />

        {!ready ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : null}

        <Pressable
          onPress={() => navigation.goBack()}
          className="absolute right-4 top-4 h-10 w-10 items-center justify-center rounded-full bg-black/60 active:opacity-70"
          hitSlop={8}
        >
          <X color="#FFFFFF" size={20} />
        </Pressable>

        {/* Swap which camera is the frame. Sits under the close button rather
            than near the shutter — it is a decision you make once while
            setting up, not something you reach for mid-play. */}
        {ready ? (
          <Pressable
            onPress={() => {
              const next = !swapped;
              setSwapped(next);
              DualCam.setSwapped(next);
            }}
            className="absolute right-4 top-[68px] h-10 w-10 items-center justify-center rounded-full bg-black/60 active:opacity-70"
            hitSlop={8}
            accessibilityLabel="Swap cameras"
          >
            <SwitchCamera color="#FFFFFF" size={20} />
          </Pressable>
        ) : null}

        {gameContext ? (
          <View className="absolute bottom-44 left-0 right-0 items-center px-6">
            <View className="rounded-full bg-black/70 px-4 py-2">
              <Type variant="dataStrong">{gameContext}</Type>
            </View>
          </View>
        ) : null}

        <View className="absolute bottom-0 left-0 right-0 items-center pb-10">
          <Type
            variant={recording ? "dataStrong" : "captionStrong"}
            tone={recording ? "primary" : "muted"}
            className="mb-3"
          >
            {recording
              ? `${Math.min(elapsed, MAX_SECONDS).toFixed(1)}s · let go to stop`
              : `Tap for a photo · hold to record · ${MAX_SECONDS}s max`}
          </Type>

          <Pressable
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            disabled={!ready}
            className="h-20 w-20 items-center justify-center rounded-full border-4"
            style={{ borderColor: recording ? colors.primary : "rgba(255,255,255,0.8)" }}
          >
            <Animated.View
              style={{
                width: recording ? 32 : 60,
                height: recording ? 32 : 60,
                borderRadius: recording ? 8 : 30,
                backgroundColor: recording ? colors.destructive : "#FFFFFF",
              }}
            />
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

export default DualCamScreen;
