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
 * square the width of the screen. At 2.5% opacity the difference between a
 * circle and a diagonal is not a thing any eye resolves.
 */
export function RoomBackground() {
  return (
    <View
      style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.huddleGround }]}
      pointerEvents="none"
    >
      <LinearGradient
        colors={["rgba(245,197,24,0.045)", "rgba(245,197,24,0)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: "absolute", top: 0, left: 0, width: "115%", height: 330 }}
      />
      <LinearGradient
        colors={["rgba(59,130,246,0)", "rgba(59,130,246,0.05)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: "absolute", bottom: 0, right: 0, width: "115%", height: 330 }}
      />
    </View>
  );
}
