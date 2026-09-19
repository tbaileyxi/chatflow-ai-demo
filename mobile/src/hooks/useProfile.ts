import { useQuery, useQueryClient } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type UserProfile = {
  userId: string;
  displayName: string | null;
  username: string | null;
  phoneNumber: string | null;
  bio: string | null;
  avatarUrl: string | null;
  onboardingCompleted: boolean;
  isAppAdmin: boolean;
};

export function useProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<UserProfile | null> => {
      if (!user) return null;

      if (user.app_metadata?.provider === "dev_test") {
        const stored = await AsyncStorage.getItem(`side-huddle-dev-profile-${user.id}`);
        const localProfile = stored
          ? (JSON.parse(stored) as Partial<UserProfile>)
          : {};
        return {
          userId: user.id,
          displayName:
            localProfile.displayName ??
            (user.user_metadata?.display_name as string | undefined) ??
            null,
          username:
            localProfile.username ??
            (user.user_metadata?.username as string | undefined) ??
            null,
          phoneNumber:
            localProfile.phoneNumber ??
            user.phone ??
            (user.user_metadata?.phone as string | undefined) ??
            null,
          bio: localProfile.bio ?? null,
          avatarUrl: localProfile.avatarUrl ?? null,
          onboardingCompleted:
            localProfile.onboardingCompleted ??
            Boolean(user.user_metadata?.onboarding_completed),
          isAppAdmin: false,
        };
      }

      // is_app_admin added in 20260608000005 — types lag. Cast through any.
      const { data: rawData, error } = await (supabase as any)
        .from("profiles")
        // phone_number is NOT readable off profiles any more — the app's
        // public key could read the whole table, so the private columns are
        // ungranted and asking for one fails the entire select. Your own
        // comes back from my_private_profile() below.
        .select(
          "user_id, display_name, username, bio, avatar_url, onboarding_completed, is_app_admin",
        )
        .eq("user_id", user.id)
        .maybeSingle();
      const data: any = rawData;

      if (error || !data) return null;

      const { data: priv } = await (supabase.rpc as any)("my_private_profile");
      const privRow = Array.isArray(priv) ? priv[0] : priv;

      return {
        userId: data.user_id,
        displayName: data.display_name,
        username: data.username,
        phoneNumber: privRow?.phone_number ?? null,
        bio: data.bio,
        avatarUrl: data.avatar_url,
        onboardingCompleted: data.onboarding_completed ?? false,
        isAppAdmin: data.is_app_admin ?? false,
      };
    },
  });

  const updateProfile = async (
    updates: Partial<{
      display_name: string | null;
      username: string | null;
      bio: string | null;
      avatar_url: string;
    }>,
  ) => {
    if (!user) return { error: new Error("Not authenticated") };

    if (user.app_metadata?.provider === "dev_test") {
      const key = `side-huddle-dev-profile-${user.id}`;
      const existing = await AsyncStorage.getItem(key);
      const current = existing
        ? (JSON.parse(existing) as Partial<UserProfile>)
        : {};
      const next: Partial<UserProfile> = {
        ...current,
        displayName:
          updates.display_name !== undefined
            ? updates.display_name
            : current.displayName,
        username:
          updates.username !== undefined ? updates.username : current.username,
        bio: updates.bio !== undefined ? updates.bio : current.bio,
        avatarUrl:
          updates.avatar_url !== undefined
            ? updates.avatar_url
            : current.avatarUrl,
      };
      await AsyncStorage.setItem(key, JSON.stringify(next));
      queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
      return { error: null };
    }

    const { error } = await supabase
      .from("profiles")
      .upsert({ user_id: user.id, ...updates }, { onConflict: "user_id" });

    if (!error) {
      queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
    }
    return { error };
  };

  return { ...query, updateProfile };
}
