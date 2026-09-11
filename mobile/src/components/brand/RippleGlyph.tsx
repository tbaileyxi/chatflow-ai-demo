import { View } from "react-native";
import { colors } from "@/theme/colors";

/**
 * The mark, small and still.
 *
 * RippleMark is the full-screen ambient version that opens the app. This is
 * the same geometry at rest, for the places that need a logo rather than a
 * moment: the corner of an onboarding step, a header, an empty state.
 *
 * It replaces a 56px raster crop of the App Store icon — a white rounded
 * square sitting on a black screen, which is what the icon looks like when you
 * take it out of the context iOS draws it in. Drawn instead of cropped, it
 * scales, it carries no white plate, and it is the same shape as the favicon
 * and the opening screen, which is the whole point of having a mark at all.
 */
export function RippleGlyph({
  size = 40,
  color = colors.primary,
}: {
  size?: number;
  color?: string;
}) {
  // Ring widths scale with the glyph so it reads the same at 24 and at 80.
  const outer = size;
  const mid = size * 0.66;
  const core = size * 0.26;
  const stroke = Math.max(1, size * 0.045);

  return (
    <View style={{ width: outer, height: outer, alignItems: "center", justifyContent: "center" }}>
      <View
        style={{
          position: "absolute",
          width: outer,
          height: outer,
          borderRadius: outer / 2,
          borderWidth: stroke,
          borderColor: color,
          opacity: 0.3,
        }}
      />
      <View
        style={{
          position: "absolute",
          width: mid,
          height: mid,
          borderRadius: mid / 2,
          borderWidth: stroke,
          borderColor: color,
          opacity: 0.62,
        }}
      />
      <View
        style={{
          width: core,
          height: core,
          borderRadius: core / 2,
          backgroundColor: color,
        }}
      />
    </View>
  );
}
