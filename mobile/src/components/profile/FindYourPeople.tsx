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
      <Text className="font-bold text-muted-foreground">{letter}</Text>
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
        <Text className="text-4xl font-black leading-tight text-foreground">
          Find your people.
        </Text>
        <Text className="mt-4 text-xl leading-8 text-muted-foreground">
          See which of your contacts are already watching games here.
        </Text>
        <Text className="mt-4 text-sm leading-5 text-muted-foreground">
          Your contacts never leave your phone. We scramble them on this device
          and only check for matches — no names, no numbers, nothing stored.
        </Text>

        <Pressable
          onPress={run}
          className="mt-8 rounded-full bg-primary px-5 py-4 active:opacity-80"
        >
          <Text className="text-center text-base font-black text-primary-foreground">
            Check my contacts
          </Text>
        </Pressable>

        {/* Only in onboarding, where onDone is the way forward. On the profile
            there is nothing to skip TO — the screen is the destination. */}
        {onDone ? (
          <Pressable onPress={onDone} className="mt-4 py-3 active:opacity-70">
            <Text className="text-center text-base font-semibold text-muted-foreground">
              Not now
            </Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  if (state === "requesting" || state === "scanning") {
    return (
      <View className="items-center py-16">
        <ActivityIndicator color={colors.primary} />
        <Text className="mt-4 text-base text-muted-foreground">
          {state === "requesting" ? "Asking permission..." : "Looking..."}
        </Text>
      </View>
    );
  }

  if (state === "denied" || state === "error") {
    return (
      <View>
        <Text className="text-2xl font-black text-foreground">
          {state === "denied" ? "No problem." : "That didn't work."}
        </Text>
        <Text className="mt-3 text-base leading-6 text-muted-foreground">
          {state === "denied"
            ? "You can still invite people with a link, or turn contacts on later in Settings."
            : "You can try again later from your profile."}
        </Text>
        {onDone ? (
          <Pressable
            onPress={onDone}
            className="mt-8 rounded-full bg-primary px-5 py-4 active:opacity-80"
          >
            <Text className="text-center text-base font-black text-primary-foreground">
              Continue
            </Text>
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
        <Text className="text-2xl font-black text-foreground">
          Nobody you know is here yet.
        </Text>
        <Text className="mt-3 text-base leading-6 text-muted-foreground">
          None of your contacts are on Side Huddle so far. That's normal this
          early — the app is one person until it's two.
        </Text>

        <View className="mt-6 flex-row gap-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <View
              key={i}
              className="h-11 w-11 items-center justify-center rounded-full border border-dashed border-border"
            >
              <Text className="text-lg text-muted-foreground">+</Text>
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
          <Text className="text-center text-base font-black text-primary-foreground">
            {inviting ? "One moment..." : "Text someone the link"}
          </Text>
          <Text className="mt-0.5 text-center text-xs font-bold text-primary-foreground/70">
            One person is all it takes
          </Text>
        </Pressable>

        {onDone ? (
          <Pressable onPress={onDone} className="mt-4 py-2 active:opacity-70">
            <Text className="text-center text-sm font-black text-muted-foreground">
              I'll do it later
            </Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <View>
      <Text className="text-2xl font-black text-foreground">
        {matches.length} {matches.length === 1 ? "person" : "people"} you know.
      </Text>

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
                  <Text
                    className="text-base font-bold text-foreground"
                    numberOfLines={1}
                  >
                    {primary}
                  </Text>
                  {secondary ? (
                    <Text
                      className="text-xs text-muted-foreground"
                      numberOfLines={1}
                    >
                      {secondary} on Side Huddle
                    </Text>
                  ) : null}
                </View>

                {m.alreadyConnected ? (
                  <View className="flex-row items-center gap-1.5 rounded-full bg-muted px-3 py-1.5">
                    <Check color={colors.mutedForeground} size={14} />
                    <Text className="text-xs font-black text-muted-foreground">
                      Added
                    </Text>
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
                    <Text className="text-xs font-black text-primary-foreground">
                      Add
                    </Text>
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
          <Text className="text-center text-base font-black text-primary-foreground">
            Continue
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
