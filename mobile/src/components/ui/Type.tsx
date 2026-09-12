import { View, Text as RNText, type TextProps, type TextStyle } from "react-native";
import { colors } from "@/theme/colors";
import { type as typeScale } from "@/theme/type";

/**
 * Text, but it has to say what job it's doing.
 *
 * The whole point is that no screen sets a font size again. If something needs
 * a size that isn't here, the scale is wrong and the scale gets fixed — one
 * more inline `text-[13px]` is how the last design ended up as 830 scattered
 * text- classes and no system at all.
 *
 * Colour is a role, not a hex. `tone` maps to the palette so a caption is the
 * same grey in every list in the app.
 */

type Variant = keyof typeof typeScale;

type Tone =
  | "default"
  | "muted"
  | "tertiary"
  | "primary"
  | "success"
  | "danger"
  | "onPrimary"
  | "info"
  | "inverse";

const tones: Record<Tone, string> = {
  default: colors.foreground,
  muted: colors.mutedForeground,
  tertiary: colors.textTertiary,
  primary: colors.primary,
  success: colors.success,
  danger: colors.destructive,
  onPrimary: colors.primaryForeground,
  info: colors.info,
  inverse: colors.background,
};

export type TypeProps = TextProps & {
  variant?: Variant;
  tone?: Tone;
  /** Centre it. Common enough to be worth not reaching for style. */
  center?: boolean;
};

export function Type({
  variant = "body",
  tone = "default",
  center,
  style,
  ...rest
}: TypeProps) {
  return (
    <RNText
      {...rest}
      style={[
        typeScale[variant] as TextStyle,
        { color: tones[tone] },
        center && { textAlign: "center" },
        style,
      ]}
    />
  );
}

/**
 * A section label. Mono, uppercase, tracked — the one piece of chrome that
 * makes a screen read as broadcast rather than as a settings list.
 *
 * Takes its own component rather than <Type variant="eyebrow"> because it
 * nearly always sits in a row with a count or an action beside it, and that
 * row has spacing of its own that shouldn't be re-invented per screen.
 */
export function Eyebrow({
  children,
  tone = "tertiary",
  right,
}: {
  children: React.ReactNode;
  tone?: Tone;
  right?: React.ReactNode;
}) {
  return (
    <RNText style={[typeScale.eyebrow as TextStyle, { color: tones[tone] }]}>
      {children}
      {right}
    </RNText>
  );
}

/**
 * A section label with its count, as a row.
 *
 * BIG AND BOLD, not a whisper. The renderings set these in the display face at
 * 20 uppercase with an icon beside them and a gold count on the right —
 * "FRIENDS · 4 on · 11", "ON NOW · 6 ›". Built as a tiny tracked mono label
 * they read as fine print on a form, which is the opposite of what a section
 * header in a broadcast layout does.
 *
 * The count is the difference between a label and a reading: the header says
 * what is below AND how much of it there is, so a section you were about to
 * scroll past announces itself.
 */
export function SectionLabel({
  children,
  count,
  action,
  icon,
  tone = "default",
}: {
  children: React.ReactNode;
  count?: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: Tone;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 4,
        marginTop: 18,
        marginBottom: 9,
        gap: 8,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
        {icon}
        <RNText
          style={[
            typeScale.title as TextStyle,
            {
              color: tones[tone],
              fontSize: 20,
              lineHeight: 24,
              letterSpacing: 0.4,
              textTransform: "uppercase",
            },
          ]}
        >
          {children}
        </RNText>
      </View>
      {action ??
        (count != null ? (
          <RNText
            style={[
              typeScale.data as TextStyle,
              { color: tones.primary, fontSize: 14 },
            ]}
          >
            {count}
          </RNText>
        ) : null)}
    </View>
  );
}
