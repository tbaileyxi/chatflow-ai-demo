import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ActiveHuddle = {
  id: string;
  name: string;
  teamName: string | null;
  teamLogoUrl: string | null;
  lastMessageAt: string;
};

export type DiscoveryTeam = {
  id: string;
  name: string;
  city: string;
  logoUrl: string | null;
  league: string;
  huddleId: string | null;
  isActive: boolean;
};

export function useActiveHuddles() {
  return useQuery({
    queryKey: ["active-huddles"],
    queryFn: async (): Promise<ActiveHuddle[]> => {
      const sixHoursAgo = new Date(
        Date.now() - 6 * 60 * 60 * 1000,
      ).toISOString();

      const { data, error } = await supabase
        .from("huddles")
        .select(
          `
          id, name, last_message_at,
          teams!team_id (name, logo_url)
        `,
        )
        .eq("is_official_team_huddle", true)
        .not("last_message_at", "is", null)
        .gte("last_message_at", sixHoursAgo)
        .order("last_message_at", { ascending: false })
        .limit(4);

      if (error || !data) return [];

      return data.map((h) => {
        const team = (h as any).teams;
        return {
          id: h.id,
          name: h.name,
          teamName: team?.name ?? null,
          teamLogoUrl: team?.logo_url ?? null,
          lastMessageAt: h.last_message_at!,
        };
      });
    },
  });
}

const LEAGUES = ["NFL", "NCAAF", "NBA", "NHL", "MLB"] as const;
export type League = (typeof LEAGUES)[number];
export { LEAGUES };

export function useDiscoveryTeams() {
  return useQuery({
    queryKey: ["discovery-teams"],
    queryFn: async (): Promise<DiscoveryTeam[]> => {
      const oneHourAgo = new Date(
        Date.now() - 60 * 60 * 1000,
      ).toISOString();

      const [teamsRes, huddlesRes] = await Promise.all([
        supabase
          .from("teams")
          .select("id, name, city, logo_url, league")
          .eq("status", "active")
          .order("name"),
        supabase
          .from("huddles")
          .select("id, team_id, last_message_at")
          .eq("is_official_team_huddle", true),
      ]);

      if (teamsRes.error || !teamsRes.data) return [];

      const huddleMap = new Map<
        string,
        { id: string; lastMessageAt: string | null }
      >();
      if (huddlesRes.data) {
        for (const h of huddlesRes.data) {
          if (h.team_id) {
            huddleMap.set(h.team_id, {
              id: h.id,
              lastMessageAt: h.last_message_at,
            });
          }
        }
      }

      return teamsRes.data.map((t) => {
        const huddle = huddleMap.get(t.id);
        return {
          id: t.id,
          name: t.name,
          city: t.city,
          logoUrl: t.logo_url,
          league: t.league ?? "",
          huddleId: huddle?.id ?? null,
          isActive: huddle?.lastMessageAt
            ? huddle.lastMessageAt > oneHourAgo
            : false,
        };
      });
    },
  });
}
