import { Text as RNText, type TextProps, type TextStyle } from "react-native";
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
  | "inverse";

const tones: Record<Tone, string> = {
  default: colors.foreground,
  muted: colors.mutedForeground,
  tertiary: colors.textTertiary,
  primary: colors.primary,
  success: colors.success,
  danger: colors.destructive,
  onPrimary: colors.primaryForeground,
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
  tone = "muted",
  right,
}: {
  children: React.ReactNode;
  tone?: Tone;
  right?: React.ReactNode;
}) {
  return (
    <RNText
      style={[
        typeScale.eyebrow as TextStyle,
        { color: tones[tone] },
      ]}
    >
      {children}
      {right}
    </RNText>
  );
}
