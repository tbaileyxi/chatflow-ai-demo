import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import { X } from "lucide-react-native";
import { DualCam, DualCamPreview } from "../../../modules/dual-cam";
import { MAX_SECONDS } from "@/lib/faceReaction";
import { colors } from "@/theme/colors";
import type { RootStackParamList } from "@/navigation/types";

type Route = RouteProp<RootStackParamList, "DualCam">;

/**
 * Both cameras, ten seconds, hold to record.
 *
 * The back camera is the frame and your face sits in the corner — the same
 * arrangement the recorder composites, so what you line up is what you get.
 *
 * The score line sits under the preview rather than over it. It is burned into
 * the message, not the video: rendering it as part of the frame would bake a
 * scoreboard into a file we cannot correct if the feed was wrong, and it would
 * be unreadable at thumbnail size anyway.
 */
export function DualCamScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<Route>();
  const gameContext = route.params?.gameContext ?? null;

  const [ready, setReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const ring = useRef(new Animated.Value(0)).current;

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
      setReady(true);
    })();

    return () => {
      alive = false;
      if (timer.current) clearInterval(timer.current);
      // Two live camera inputs is the most expensive thing this app can leave
      // running. Never rely on the screen unmounting quietly.
      DualCam.dismiss();
    };
  }, [navigation]);

  const finish = useCallback(async () => {
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
    setRecording(false);
    ring.stopAnimation();
    ring.setValue(0);

    try {
      const { uri } = await DualCam.stop();
      route.params?.onCapture?.({ uri, context: gameContext });
      navigation.goBack();
    } catch (err: any) {
      Alert.alert("Couldn't save that", err?.message ?? "Try again in a moment.");
    }
  }, [gameContext, navigation, ring, route.params]);

  const begin = useCallback(async () => {
    if (recording || !ready) return;
    try {
      await DualCam.start();
    } catch (err: any) {
      Alert.alert("Couldn't start", err?.message ?? "Try again in a moment.");
      return;
    }

    setRecording(true);
    setElapsed(0);

    Animated.timing(ring, {
      toValue: 1,
      duration: MAX_SECONDS * 1000,
      useNativeDriver: false,
    }).start();

    timer.current = setInterval(() => {
      setElapsed((n) => {
        const next = n + 0.1;
        // Stop ourselves at the cap rather than trusting a finger to let go.
        if (next >= MAX_SECONDS) finish();
        return next;
      });
    }, 100);
  }, [finish, ready, recording, ring]);

  return (
    <SafeAreaView className="flex-1 bg-black" edges={["top", "bottom"]}>
      <View className="flex-1">
        <DualCamPreview active={ready} style={StyleSheet.absoluteFill} />

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

        {gameContext ? (
          <View className="absolute bottom-44 left-0 right-0 items-center px-6">
            <View className="rounded-full bg-black/70 px-4 py-2">
              <Text className="text-xs font-black tracking-wide text-white">
                {gameContext}
              </Text>
            </View>
          </View>
        ) : null}

        <View className="absolute bottom-0 left-0 right-0 items-center pb-10">
          <Text className="mb-3 text-xs font-bold text-white/70">
            {recording
              ? `${Math.min(elapsed, MAX_SECONDS).toFixed(1)}s`
              : `Hold to record · ${MAX_SECONDS}s max`}
          </Text>

          <Pressable
            onPressIn={begin}
            onPressOut={() => recording && finish()}
            disabled={!ready}
            className="h-20 w-20 items-center justify-center rounded-full border-4 border-white/80"
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
