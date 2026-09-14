import { Image, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "@/theme/colors";

/**
 * Is this an actual photo somebody chose, or a seeded default?
 *
 * Real uploads land in storage under `room-photos/`. Everything on
 * `sidehuddlesports.com/og-teams/` is a generated card — `default-room.png`
 * is the step-and-repeat of the SH badge on navy, and there are per-team
 * variants of the same thing.
 *
 * Those exist to be the preview image on a shared link, where a tiled logo is
 * exactly right. Behind a conversation it is wallpaper nobody asked for, and
 * it is what made the room look broken — so the room draws a photo only when
 * a person actually set one.
 */
export function isRealRoomPhoto(url: string | null | undefined): boolean {
  return !!url && url.includes("/room-photos/");
}

/**
 * The room's ground: a gradient by default, your photo when you set one.
 *
 * Gold bleeding out of the top-left and blue out of the bottom-right. The
 * study draws these at 2.5%, which was picked on a desktop monitor showing a
 * 290px mock — on a real screen at real brightness that is invisible, and the
 * room came out flat black and read as unfinished. These are roughly five
 * times the drawn value: enough that the screen has a temperature, not enough
 * to be a shape.
 *
 * With a photo the gradient stays on top of it, so the warm corner still
 * belongs to the room rather than to whatever someone photographed.
 */
export function RoomBackground({ photoUrl }: { photoUrl?: string | null }) {
  const photo = isRealRoomPhoto(photoUrl) ? photoUrl! : null;

  return (
    <View
      style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.huddleGround }]}
      pointerEvents="none"
    >
      {photo ? (
        <>
          <Image
            source={{ uri: photo }}
            style={StyleSheet.absoluteFillObject}
            resizeMode="cover"
          />
          {/* LIGHT. This was 0.80, which is not a scrim, it is switching the
              photo off — somebody uploads a tailgate shot and sees a dark
              grey wall. Legibility is the plate behind each message's words
              now (see ChatMessage), which is where the contrast is actually
              needed. This just takes the edge off so the gradient and the
              chrome still read. */}
          <View
            style={[
              StyleSheet.absoluteFillObject,
              { backgroundColor: "rgba(10,10,11,0.35)" },
            ]}
          />
        </>
      ) : null}

      {/* Full-height, both of them. Sized to a 420px box these left a visible
          seam across the thread: a diagonal gradient reaching transparent at
          the far CORNER is still half-opaque along the bottom edge of its box,
          so the box edge draws itself as a line. */}
      <LinearGradient
        colors={[
          "rgba(245,197,24,0.14)",
          "rgba(245,197,24,0.04)",
          "rgba(245,197,24,0)",
        ]}
        locations={[0, 0.28, 0.62]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <LinearGradient
        colors={[
          "rgba(59,130,246,0)",
          "rgba(59,130,246,0.04)",
          "rgba(59,130,246,0.12)",
        ]}
        locations={[0.38, 0.72, 1]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
    </View>
  );
}
