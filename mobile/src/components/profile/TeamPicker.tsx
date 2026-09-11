/**
 * Pick the teams you follow. Plural, on purpose.
 *
 * This used to be single-pick and did something quite different: tapping a
 * team called join_team_huddle(), which dropped you into that team's official
 * Community room — a room with, on average, nobody in it. So the one screen
 * that asks what you care about answered by putting you somewhere empty, and
 * recorded your answer nowhere.
 *
 * Now it writes user_follows and joins nothing. Rooms get made later, from a
 * game or from an invite, where there are people. Following is the lightweight
 * thing: it says which games matter to you and which rooms should find you,
 * and you can follow a team you have no room in.
 *
 * Doubles as the edit surface — it loads your current follows pre-selected, so
 * the same component works from a profile as it does in onboarding.
 */
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Type } from "@/components/ui/Type";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { colors } from "@/theme/colors";
import { followTeam, getFollowedTeamIds, unfollowTeam } from "@/lib/follows";

type Team = {
  id: string;
  name: string;
  city: string | null;
  logoUrl: string | null;
  league: string | null;
};

export function TeamPicker({
  onDone,
  onSkip,
  title = "Who do you watch?",
  subtitle = "Pick as many as you like. This decides which games find you, and which team's voice you hear in a room.",
  ctaLabel = "Continue",
}: {
  onDone: () => void;
  onSkip?: () => void;
  title?: string;
  subtitle?: string;
  ctaLabel?: string;
}) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // What they followed when the screen opened, so Continue can work out what
  // actually changed rather than rewriting every row every time.
  const [initial, setInitial] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [teamsRes, followed] = await Promise.all([
        supabase
          .from("teams")
          .select("id, name, city, logo_url, league")
          .eq("status", "active")
          .order("name"),
        getFollowedTeamIds(),
      ]);
      if (cancelled) return;

      setTeams(
        (teamsRes.data ?? []).map((t: any) => ({
          id: t.id,
          name: t.name,
          city: t.city ?? null,
          logoUrl: t.logo_url ?? null,
          league: t.league ?? null,
        })),
      );
      const already = new Set(followed);
      setSelected(already);
      setInitial(already);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return teams;
    return teams.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.city ?? "").toLowerCase().includes(q) ||
        (t.league ?? "").toLowerCase().includes(q),
    );
  }, [teams, search]);

  const chosen = useMemo(
    () => teams.filter((t) => selected.has(t.id)),
    [teams, selected],
  );

  const toggle = (teamId: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(teamId)) next.delete(teamId);
      else next.add(teamId);
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      const added = [...selected].filter((id) => !initial.has(id));
      const removed = [...initial].filter((id) => !selected.has(id));
      await Promise.all([
        ...added.map((id) => followTeam(id)),
        ...removed.map((id) => unfollowTeam(id)),
      ]);
    } catch (err) {
      // Never strand someone in onboarding over this — they can fix their
      // teams later from a profile, but there is no later if they're stuck.
      console.warn("[team-picker] save failed", err);
    } finally {
      setSaving(false);
      onDone();
    }
  };

  return (
    <View>
      <Type variant="display">
        {title}
      </Type>
      <Type variant="heading" tone="muted" className="mt-3">
        {subtitle}
      </Type>

      {chosen.length > 0 ? (
        <View className="mt-4 flex-row flex-wrap gap-2">
          {chosen.map((t) => (
            <Pressable
              key={t.id}
              onPress={() => toggle(t.id)}
              className="flex-row items-center gap-2 rounded-full border border-primary/40 bg-primary/10 py-1.5 pl-1.5 pr-3 active:opacity-70"
            >
              <View className="h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-muted">
                {t.logoUrl ? (
                  <Image source={{ uri: t.logoUrl }} className="h-full w-full" resizeMode="cover" />
                ) : (
                  <Type variant="dataStrong" tone="muted">
                    {t.name.charAt(0)}
                  </Type>
                )}
              </View>
              <Type variant="captionStrong"  numberOfLines={1}>
                {t.name}
              </Type>
              <Type variant="captionStrong" tone="primary">×</Type>
            </Pressable>
          ))}
        </View>
      ) : null}

      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search teams"
        placeholderTextColor={colors.mutedForeground}
        autoCorrect={false}
        className="mt-4 rounded-xl border border-border bg-muted px-4 py-3 text-foreground"
        style={{ color: colors.foreground }}
      />

      {loading ? (
        <View className="items-center py-10">
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          style={{ maxHeight: 280 }}
          className="mt-3"
          keyboardShouldPersistTaps="handled"
        >
          <View className="gap-1">
            {filtered.map((t) => {
              const on = selected.has(t.id);
              return (
                <Pressable
                  key={t.id}
                  onPress={() => toggle(t.id)}
                  className="flex-row items-center gap-3 rounded-xl px-2 py-2.5 active:bg-muted/40"
                >
                  <View className="h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-muted">
                    {t.logoUrl ? (
                      <Image
                        source={{ uri: t.logoUrl }}
                        className="h-full w-full"
                        resizeMode="cover"
                      />
                    ) : (
                      <Type variant="captionStrong" tone="muted">
                        {t.name.charAt(0)}
                      </Type>
                    )}
                  </View>
                  <View className="flex-1">
                    <Type variant="bodyStrong"
                      
                      numberOfLines={1}>
                      {t.city ? `${t.city} ${t.name}` : t.name}
                    </Type>
                    {t.league ? (
                      <Type variant="caption" tone="muted">
                        {t.league}
                      </Type>
                    ) : null}
                  </View>
                  <View
                    className={
                      on
                        ? "h-6 w-6 items-center justify-center rounded-full bg-primary"
                        : "h-6 w-6 rounded-full border border-border"
                    }
                  >
                    {on ? (
                      <Type variant="captionStrong" tone="onPrimary">
                        ✓
                      </Type>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}

            {filtered.length === 0 ? (
              <Type center variant="caption" tone="muted" className="py-8">
                No teams match that.
              </Type>
            ) : null}
          </View>
        </ScrollView>
      )}

      <View className="mt-4">
        <Button size="lg" onPress={save} disabled={saving || selected.size === 0}>
          {saving
            ? "Saving..."
            : selected.size === 0
              ? ctaLabel
              : `${ctaLabel} with ${selected.size}`}
        </Button>
      </View>

      {onSkip ? (
        <Pressable onPress={onSkip} className="mt-3 py-2 active:opacity-70">
          <Type center variant="captionStrong" tone="muted">
            Skip for now
          </Type>
        </Pressable>
      ) : null}
    </View>
  );
}
