import { View, Text, Pressable } from "react-native";
import { UserPlus } from "lucide-react-native";
import { Type } from "@/components/ui/Type";
import { colors } from "@/theme/colors";

type Props = {
  content: string;
  onInvite?: () => void;
};

/**
 * The admin's welcome / nudge card.
 *
 * One action, not a list. The admin is the only person who can turn a 1-person
 * room into a 40-person room, so everything else is stripped out and the single
 * CTA drives straight into the invite sheet that already exists.
 *
 * The server writes "**→ Add your crew**" as the last line of the body; we pull
 * it out and render a real button instead, so the copy stays readable in any
 * surface that doesn't know about this card (push previews, the huddle list's
 * last-message line).
 */

const CTA_LINE = /^\s*\*\*→\s*.*?\*\*\s*$/;

/** Minimal **bold** renderer — enough for this card, no markdown dependency. */
function renderRich(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <Text key={i} style={{ fontWeight: "800", color: colors.foreground }}>
          {part.slice(2, -2)}
        </Text>
      );
    }
    return part;
  });
}

export function AdminWelcomeCard({ content, onInvite }: Props) {
  const lines = (content || "").split("\n");
  const ctaIndex = lines.findIndex((l) => CTA_LINE.test(l));
  const body = (ctaIndex >= 0 ? lines.slice(0, ctaIndex) : lines)
    .join("\n")
    .trim();
  const ctaLabel = ctaIndex >= 0
    ? lines[ctaIndex].replace(/\*\*/g, "").replace(/^\s*→\s*/, "").trim()
    : "Add your crew";

  return (
    <View
      className="rounded-2xl bg-card px-4 py-3"
      style={{ borderLeftWidth: 3, borderLeftColor: colors.primary }}
    >
      <Type variant="body" className="leading-6"  style={{ color: colors.foreground }}>
        {renderRich(body)}
      </Type>

      <Pressable
        onPress={onInvite}
        disabled={!onInvite}
        className="mt-3 flex-row items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 active:opacity-80"
        style={{ opacity: onInvite ? 1 : 0.5 }}
        hitSlop={6}
      >
        <UserPlus color={colors.primaryForeground} size={16} />
        <Type variant="captionStrong" tone="onPrimary">
          {ctaLabel}
        </Type>
      </Pressable>
    </View>
  );
}
