// FindYourPeople — the contact-match list. Used as an onboarding step and
// reachable again later from Profile, because the answer changes as more
// people join.

import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Check, UserPlus } from "lucide-react-native";
import { Type } from "@/components/ui/Type";
import { useContactMatch } from "@/hooks/useContactMatch";
import { useProfile } from "@/hooks/useProfile";
import { createRoomAndShare } from "@/lib/invite";
import { colors } from "@/theme/colors";

function Monogram({ name, size = 40 }: { name: string; size?: number }) {
  const letter = (name || "?").charAt(0).toUpperCase();
  return (
    <View
      className="items-center justify-center rounded-full bg-muted"
      style={{ width: size, height: size }}
    >
      <Type variant="bodyStrong" tone="muted">{letter}</Type>
    </View>
  );
}

export function FindYourPeople({ onDone }: { onDone?: () => void }) {
  const { state, matches, run, connect } = useContactMatch();
  const { data: profile } = useProfile();
  const [busy, setBusy] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);

  const handleConnect = async (userId: string) => {
    setBusy(userId);
    await connect(userId);
    setBusy(null);
  };

  if (state === "idle") {
    return (
      <View>
        <Type variant="display" className="leading-tight">
          Find your people.
        </Type>
        <Type variant="title" tone="muted" className="mt-4 leading-8">
          See which of your contacts are already watching games here.
        </Type>
        <Type variant="caption" tone="muted" className="mt-4 leading-5">
          Your contacts never leave your phone. We scramble them on this device
          and only check for matches — no names, no numbers, nothing stored.
        </Type>

        <Pressable
          onPress={run}
          className="mt-8 rounded-full bg-primary px-5 py-4 active:opacity-80"
        >
          <Type variant="heading" tone="onPrimary" className="text-center">
            Check my contacts
          </Type>
        </Pressable>

        {/* Only in onboarding, where onDone is the way forward. On the profile
            there is nothing to skip TO — the screen is the destination. */}
        {onDone ? (
          <Pressable onPress={onDone} className="mt-4 py-3 active:opacity-70">
            <Type variant="bodyStrong" tone="muted" className="text-center">
              Not now
            </Type>
          </Pressable>
        ) : null}
      </View>
    );
  }

  if (state === "requesting" || state === "scanning") {
    return (
      <View className="items-center py-16">
        <ActivityIndicator color={colors.primary} />
        <Type variant="body" tone="muted" className="mt-4">
          {state === "requesting" ? "Asking permission..." : "Looking..."}
        </Type>
      </View>
    );
  }

  if (state === "denied" || state === "error") {
    return (
      <View>
        <Type variant="title">
          {state === "denied" ? "No problem." : "That didn't work."}
        </Type>
        <Type variant="body" tone="muted" className="mt-3 leading-6">
          {state === "denied"
            ? "You can still invite people with a link, or turn contacts on later in Settings."
            : "You can try again later from your profile."}
        </Type>
        {onDone ? (
          <Pressable
            onPress={onDone}
            className="mt-8 rounded-full bg-primary px-5 py-4 active:opacity-80"
          >
            <Type variant="heading" tone="onPrimary" className="text-center">
              Continue
            </Type>
          </Pressable>
        ) : null}
      </View>
    );
  }

  // state === "done"
  // The cold start. This used to say "invite someone with a link" and then
  // offer only a Continue button — naming the one action that changes anything
  // and not providing it. There was no link to give, either: a brand-new user
  // owns no room, and an earlier version sent the bare homepage, which is why
  // invites never converted.
  //
  // Now the invite makes the room. It's the only honest screen here: the app
  // has no value for one person, so everything except "bring somebody" is a
  // holding pattern, and saying so is better than dressing one up.
  if (matches.length === 0) {
    return (
      <View>
        <Type variant="title">
          Nobody you know is here yet.
        </Type>
        <Type variant="body" tone="muted" className="mt-3 leading-6">
          None of your contacts are on Side Huddle so far. That's normal this
          early — the app is one person until it's two.
        </Type>

        <View className="mt-6 flex-row gap-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <View
              key={i}
              className="h-11 w-11 items-center justify-center rounded-full border border-dashed border-border"
            >
              <Type variant="heading" tone="muted">+</Type>
            </View>
          ))}
        </View>

        <Pressable
          disabled={inviting}
          onPress={async () => {
            setInviting(true);
            const result = await createRoomAndShare(profile?.displayName);
            setInviting(false);
            if (!result.ok) {
              Alert.alert(
                "Couldn't make an invite",
                "Try again in a moment, or skip and do it from your room.",
              );
              return;
            }
            // Onward either way. Whether they actually hit send in the share
            // sheet is not something to hold onboarding hostage over — the
            // room exists now regardless, so there's somewhere to land.
            onDone?.();
          }}
          className="mt-7 rounded-full bg-primary px-5 py-4 active:opacity-80"
        >
          <Type variant="heading" tone="onPrimary" className="text-center">
            {inviting ? "One moment..." : "Text someone the link"}
          </Type>
          <Type variant="captionStrong" className="mt-0.5 text-center text-primary-foreground/70">
            One person is all it takes
          </Type>
        </Pressable>

        {onDone ? (
          <Pressable onPress={onDone} className="mt-4 py-2 active:opacity-70">
            <Type variant="captionStrong" tone="muted" className="text-center">
              I'll do it later
            </Type>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <View>
      <Type variant="title">
        {matches.length} {matches.length === 1 ? "person" : "people"} you know.
      </Type>

      <ScrollView style={{ maxHeight: 340 }} className="mt-4">
        <View className="gap-1">
          {matches.map((m) => {
            const theirName = m.displayName || m.username || "Someone";
            // Lead with the name from YOUR phone. Their Side Huddle name can be
            // anything — "burnsyny2000" identifies nobody — so it goes second,
            // as the thing you'll see them called in a room.
            const primary = m.contactName || theirName;
            const secondary = m.contactName ? theirName : null;
            return (
              <View
                key={m.userId}
                className="flex-row items-center gap-3 rounded-xl px-1 py-2"
              >
                {m.avatarUrl ? (
                  <Image
                    source={{ uri: m.avatarUrl }}
                    className="h-10 w-10 rounded-full"
                  />
                ) : (
                  <Monogram name={primary} />
                )}
                <View className="flex-1">
                  <Type variant="bodyStrong"
                    
                    numberOfLines={1}>
                    {primary}
                  </Type>
                  {secondary ? (
                    <Type variant="caption" tone="muted"
                      
                      numberOfLines={1}>
                      {secondary} on Side Huddle
                    </Type>
                  ) : null}
                </View>

                {m.alreadyConnected ? (
                  <View className="flex-row items-center gap-1.5 rounded-full bg-muted px-3 py-1.5">
                    <Check color={colors.mutedForeground} size={14} />
                    <Type variant="captionStrong" tone="muted">
                      Added
                    </Type>
                  </View>
                ) : (
                  <Pressable
                    onPress={() => handleConnect(m.userId)}
                    disabled={busy === m.userId}
                    className="flex-row items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 active:opacity-80"
                  >
                    {busy === m.userId ? (
                      <ActivityIndicator
                        size="small"
                        color={colors.primaryForeground}
                      />
                    ) : (
                      <UserPlus color={colors.primaryForeground} size={14} />
                    )}
                    <Type variant="captionStrong" tone="onPrimary">
                      Add
                    </Type>
                  </Pressable>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>

      {onDone ? (
        <Pressable
          onPress={onDone}
          className="mt-6 rounded-full bg-primary px-5 py-4 active:opacity-80"
        >
          <Type variant="heading" tone="onPrimary" className="text-center">
            Continue
          </Type>
        </Pressable>
      ) : null}
    </View>
  );
}
