import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * A person's verified-creator badge: their X handle when verified, else null.
 *
 * Its own tiny query, and silent on failure, so a profile never breaks over
 * a badge. Pass nothing for the signed-in user.
 */
export function useCreatorBadge(userId?: string | null) {
  const { user } = useAuth();
  const id = userId ?? user?.id ?? null;
  return useQuery({
    queryKey: ["creator-badge", id],
    enabled: !!id,
    staleTime: 60_000,
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await (supabase as any)
        .from("profiles")
        .select("x_handle, verified_creator")
        .eq("user_id", id)
        .maybeSingle();
      if (error || !data?.verified_creator || !data?.x_handle) return null;
      return data.x_handle as string;
    },
  });
}
