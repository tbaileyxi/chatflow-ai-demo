import { useMemo } from "react";
import { Image, Pressable, ScrollView, View } from "react-native";
import { Type } from "@/components/ui/Type";
import { useUserHuddles } from "@/hooks/useUserHuddles";
import { useFollowedTeams } from "@/hooks/useFollowedTeams";
import { useKnownPeople } from "@/hooks/useFriends";
import { colors } from "@/theme/colors";

/**
 * The top of your profile, built to the "Getting in, getting people" rendering.
 *
 * WHAT IT COUNTS IS THE ARGUMENT. Huddles, people, saved reactions — not
 * messages sent, which is a vanity number nobody has ever been proud of, and
 * not your pick record, which is a row further down rather than a headline. The
 * counts are the three things that mean you have a place here.
 *
 * TEAMS ARE A LIST. Chips with an ＋ Add on the end, never a single value, in
 * onboarding and on your profile and on everyone else's. That is the whole
 * reason `user_follows` exists.
 */
export function ProfileHeader({
  displayName,
  username,
  avatarUrl,
  joinedAt,
  onEdit,
  onAddTeams,
}: {
  displayName: string;
  username: string | null;
  avatarUrl: string | null;
  joinedAt: string | null;
  onEdit: () => void;
  onAddTeams: () => void;
}) {
  const { data: huddles } = useUserHuddles();
  const { data: teams } = useFollowedTeams();

  const { data: people } = useKnownPeople();

  const initials = useMemo(
    () =>
      (displayName || username || "U")
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
        .toUpperCase(),
    [displayName, username],
  );

  // Auto-minted handles look like "12035550142_ffd42b1c". A real one has
  // letters, no underscore-hex tail, and isn't mostly digits.
  const chosenHandle =
    username && !/^\d/.test(username) && !/_[0-9a-f]{6,}$/i.test(username)
      ? username
      : null;

  const joined = joinedAt
    ? new Date(joinedAt)
        .toLocaleDateString("en-US", { month: "short", year: "numeric" })
        .toLowerCase()
    : null;

  return (
    <View>
      <View className="items-center pb-1.5 pt-1">
        <Pressable onPress={onEdit} className="active:opacity-80">
          <View
            className="h-[78px] w-[78px] items-center justify-center overflow-hidden rounded-full"
            style={{ backgroundColor: avatarUrl ? colors.muted : colors.primary }}
          >
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} className="h-full w-full" />
            ) : (
              <Type variant="title" style={{ color: "#000", fontSize: 26 }}>
                {initials}
              </Type>
            )}
          </View>
          {/* The pencil sits on the avatar rather than in a nav bar: the thing
              you want to change is the thing you are looking at. */}
          <View
            className="absolute -bottom-0.5 -right-0.5 h-[26px] w-[26px] items-center justify-center rounded-full"
            style={{ backgroundColor: colors.foreground, borderWidth: 3, borderColor: colors.background }}
          >
            <Type variant="caption" style={{ color: "#000", fontSize: 11 }}>
              ✎
            </Type>
          </View>
        </Pressable>

        <Type variant="title" className="mt-3" style={{ fontSize: 23 }}>
          {displayName || "You"}
        </Type>
        {/* A handle nobody chose is not a handle. Signing up by SMS mints
            one from the phone number — "@12035550142_ffd42b1c" — and printing
            that under somebody's name makes their own profile look like a
            database row. Shown only when it reads like a name. */}
        <Type variant="data" tone="tertiary" className="mt-1">
          {[chosenHandle ? `@${chosenHandle}` : null, joined ? `joined ${joined}` : null]
            .filter(Boolean)
            .join(" · ")}
        </Type>
      </View>

      {/* Teams as chips, with ＋ Add on the end. Never a single value. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 7, paddingHorizontal: 16, paddingTop: 13 }}
      >
        {(teams ?? []).map((t) => (
          <View
            key={t.id}
            className="flex-row items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3"
            style={{
              borderWidth: 1,
              borderColor: colors.primary,
              backgroundColor: "rgba(245,197,24,0.10)",
            }}
          >
            <View className="h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-muted">
              {t.logoUrl ? (
                <Image source={{ uri: t.logoUrl }} className="h-full w-full" />
              ) : (
                <Type variant="data" tone="muted" style={{ fontSize: 11 }}>
                  {t.name.slice(0, 2).toUpperCase()}
                </Type>
              )}
            </View>
            <Type variant="captionStrong">{t.name}</Type>
          </View>
        ))}
        <Pressable
          onPress={onAddTeams}
          className="flex-row items-center rounded-full px-3 py-1.5 active:opacity-70"
          style={{ borderWidth: 1, borderColor: "#2A2A31" }}
        >
          <Type variant="captionStrong" tone="primary">
            ＋ Add
          </Type>
        </Pressable>
      </ScrollView>

      <View className="mt-4 flex-row gap-2 px-4">
        <Stat value={(huddles ?? []).length} label="Huddles" />
        <Stat value={(people ?? []).length} label="People" />
        <Stat
          value={(huddles ?? []).filter((h) => h.roomRole === "owner").length}
          label="You run"
          gold
        />
      </View>
    </View>
  );
}

function Stat({
  value,
  label,
  gold,
}: {
  value: number;
  label: string;
  gold?: boolean;
}) {
  return (
    <View
      className="flex-1 items-center rounded-[14px] px-2 py-3"
      style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: "#22222A" }}
    >
      {/* These carried fontSize overrides of 20 and 7.5 — the 292px-frame
          mistake surviving as two inline numbers after the scale was fixed
          everywhere else. 7.5pt is smaller than a legal disclaimer. */}
      <Type variant="score" tone={gold ? "primary" : "default"} style={{ fontSize: 27 }}>
        {value}
      </Type>
      <Type variant="eyebrow" tone="tertiary" className="mt-1">
        {label}
      </Type>
    </View>
  );
}
