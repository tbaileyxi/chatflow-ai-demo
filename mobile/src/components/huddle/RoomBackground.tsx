import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "@/theme/colors";

/**
 * The room's ground.
 *
 * Two things, both from the shipped-palette prototype, and together they are
 * most of what "it doesn't look like the renderings" meant:
 *
 *   background: #141418
 *   backgroundImage:
 *     radial-gradient(circle at 0% 0%,     rgba(245,197,24,0.025), transparent 50%),
 *     radial-gradient(circle at 100% 100%, rgba(59,130,246,0.02),  transparent 50%)
 *
 * Gold bleeding out of the top-left corner, blue out of the bottom-right, both
 * at two-and-a-half percent. You are not meant to see it. You are meant to
 * notice that the screen has a temperature — warm where the room's own colour
 * lives, cool at the far corner — instead of being a flat black rectangle.
 *
 * RN has no radial gradient, so each corner gets a diagonal linear one over a
 * square wider than the screen. The difference between a circle and a diagonal
 * is not a thing any eye resolves at this opacity.
 *
 * THE STUDY'S OWN VALUES ARE 2.5% AND 2%, AND THEY ARE INVISIBLE ON A PHONE.
 * They were picked on a desktop monitor showing a 290px mock. Taken to a real
 * screen at real brightness the room came out flat black and read as
 * unfinished, so these are roughly five times the drawn value — still subtle
 * enough that you notice a temperature rather than a shape.
 */
export function RoomBackground() {
  return (
    <View
      style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.huddleGround }]}
      pointerEvents="none"
    >
      {/* FULL-HEIGHT, BOTH OF THEM. Sized to a 420px box these left a visible
          seam across the thread: a diagonal gradient reaching transparent at
          the far CORNER is still half-opaque along the bottom edge of its box,
          so the box edge draws itself as a line. Covering the whole screen
          means there is no edge to see. */}
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
