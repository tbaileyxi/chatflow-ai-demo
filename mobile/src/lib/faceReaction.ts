import { Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";

/**
 * Your face, at the moment something happened.
 *
 * WHY THERE IS NO SECOND CAMERA. The design called for front and back at once
 * — your face plus proof of what caused it, BeReal-style. Neither expo-camera
 * (not a dependency here) nor React Native core exposes a simultaneous
 * multi-cam session; it needs react-native-vision-camera or a custom native
 * module, and even then it's device-gated to newer hardware.
 *
 * But filming the TV was never the point — proving what you were reacting to
 * was. And the app already KNOWS: the score, the clock, the period, down to
 * the second. So the proof is rendered from data instead of filmed, which
 * needs no native surface at all and looks better than a phone pointed at a
 * screen across a room. See the reaction card in ChatMessage.
 *
 * LIMITS. Cost at expected use is negligible, but a loop uploading video is
 * the one genuinely unbounded case, so: fifteen seconds, fifteen megabytes,
 * and a server-side ceiling of twenty an hour that the client cannot talk its
 * way past (RUN_THIS_UGC_POLICY.sql).
 *
 * Ten seconds cut people off mid-sentence on a big play — the reaction worth
 * keeping is the one that runs a beat long. The byte ceiling moves with it:
 * at the same quality a fifteen-second clip is half again the file, and
 * leaving the cap at ten megabytes would have rejected the very clips the
 * longer limit exists to allow.
 */

export const MAX_SECONDS = 15;
export const MAX_BYTES = 15 * 1024 * 1024;

export type FaceReaction = {
  uri: string;
  /** The state of the game at the instant it was taken, burned into the card. */
  context: string | null;
};

export async function captureFaceReaction(
  gameContext: string | null,
): Promise<FaceReaction | null> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== "granted") {
    Alert.alert(
      "Camera is off",
      "Side Huddle needs the camera to record a reaction. You can turn it on in Settings.",
    );
    return null;
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ["videos"],
    videoMaxDuration: MAX_SECONDS,
    // Front camera by default — this is a reaction, and the subject is you.
    // The system camera still lets people flip if the room is the shot.
    cameraType: ImagePicker.CameraType.front,
    quality: 0.7,
    allowsEditing: false,
  });

  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];

  // Duration is capped by videoMaxDuration on iOS, but Android has honoured
  // it inconsistently and a 60-second clip is six times the file we planned
  // for. Check rather than trust.
  const info = await FileSystem.getInfoAsync(asset.uri);
  const size = info.exists ? (info as any).size ?? 0 : 0;

  if (size > MAX_BYTES) {
    Alert.alert(
      "That one's too long",
      `Reactions are up to ${MAX_SECONDS} seconds. Try a shorter one.`,
    );
    return null;
  }

  return { uri: asset.uri, context: gameContext };
}

/**
 * "COLO 24 · UTAH 21 — 4TH 9:38", or null when nothing is on.
 *
 * Captured at the moment of recording rather than read at render time: the
 * whole point is what the score was WHEN you pulled that face. Resolving it
 * later would relabel every old reaction with the final score and quietly
 * destroy the thing that makes them worth keeping.
 */
export function gameContextLabel(game: {
  awayTeamName?: string | null;
  homeTeamName?: string | null;
  awayScore?: number | null;
  homeScore?: number | null;
  period?: string | null;
  clock?: string | null;
} | null | undefined): string | null {
  if (!game) return null;
  const away = game.awayTeamName ?? "Away";
  const home = game.homeTeamName ?? "Home";
  if (game.awayScore == null && game.homeScore == null) return null;

  const when = [game.period, game.clock].filter(Boolean).join(" ");
  const score = `${away} ${game.awayScore ?? 0} · ${home} ${game.homeScore ?? 0}`;
  return when ? `${score} — ${when}` : score;
}
