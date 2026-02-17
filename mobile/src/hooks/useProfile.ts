import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type UserProfile = {
  userId: string;
  displayName: string | null;
  username: string | null;
  phoneNumber: string | null;
  bio: string | null;
  avatarUrl: string | null;
};

export function useProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<UserProfile | null> => {
      if (!user) return null;

      const { data, error } = await supabase
        .from("profiles")
        .select(
          "user_id, display_name, username, phone_number, bio, avatar_url",
        )
        .eq("user_id", user.id)
        .maybeSingle();

      if (error || !data) return null;

      return {
        userId: data.user_id,
        displayName: data.display_name,
        username: data.username,
        phoneNumber: data.phone_number,
        bio: data.bio,
        avatarUrl: data.avatar_url,
      };
    },
  });

  const updateProfile = async (
    updates: Partial<{
      display_name: string;
      username: string;
      bio: string;
      avatar_url: string;
    }>,
  ) => {
    if (!user) return { error: new Error("Not authenticated") };

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
