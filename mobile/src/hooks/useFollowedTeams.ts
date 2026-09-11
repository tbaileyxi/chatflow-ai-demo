import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getFollowedTeamIds } from "@/lib/follows";

export type FollowedTeam = {
  id: string;
  name: string;
  city: string | null;
  league: string | null;
  logoUrl: string | null;
};

export type TeamHuddle = {
  id: string;
  name: string;
  bio: string | null;
  teamId: string;
  memberCount: number;
  isPrivate: boolean;
  isOfficial: boolean;
  /** The team's auto-created community room, as opposed to a paid/verified one. */
  isTeamRoom: boolean;
  isMember: boolean;
  lastMessageAt: string | null;
  knownNames: string[];
};

/**
 * The teams you follow, in the order you'd expect to see them.
 *
 * `user_follows` has been written since onboarding was rewritten but nothing
 * ever read it back except the games strip, so a person could follow five
 * teams and never see a list of them anywhere.
 */
export function useFollowedTeams() {
  return useQuery({
    queryKey: ["followed-teams-full"],
    staleTime: 60_000,
    queryFn: async (): Promise<FollowedTeam[]> => {
      const ids = await getFollowedTeamIds();
      if (ids.length === 0) return [];

      const { data, error } = await supabase
        .from("teams")
        .select("id, name, city, league, logo_url")
        .in("id", ids);

      if (error || !data) return [];

      return data
        .map((t: any) => ({
          id: t.id,
          name: t.name,
          city: t.city ?? null,
          league: t.league ?? null,
          logoUrl: t.logo_url ?? null,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },
  });
}

/**
 * Every room for those teams that you're allowed to see, grouped by team.
 *
 * One RPC for all the teams rather than one per team — a person following
 * eight teams shouldn't fan out eight round trips on tab open.
 */
export function useTeamHuddles(teamIds: string[]) {
  const key = [...teamIds].sort().join(",");

  return useQuery({
    queryKey: ["huddles-for-teams", key],
    enabled: teamIds.length > 0,
    staleTime: 30_000,
    queryFn: async (): Promise<Map<string, TeamHuddle[]>> => {
      const { data, error } = await (supabase.rpc as any)("huddles_for_teams", {
        p_team_ids: teamIds,
        p_limit: 60,
      });

      const grouped = new Map<string, TeamHuddle[]>();
      if (error) {
        console.warn("[teams] huddles_for_teams failed", error.message);
        return grouped;
      }

      for (const h of (data ?? []) as any[]) {
        // The team's community room is cut. There is exactly one per team,
        // it is empty in almost every case, and a shelf of empty rooms with
        // team logos on them is the problem this tab was meant to solve, not
        // a solution to it. The row still exists — the bot writes to it and
        // the /t/ landing pages read it — it just isn't offered as somewhere
        // to go.
        //
        // Membership is not the exception it looked like: following a team
        // auto-joins you to its community room, so "hide the ones you haven't
        // joined" hid nothing at all. They go regardless.
        if (h.is_team_room) continue;
        const row: TeamHuddle = {
          id: h.id,
          name: h.name,
          bio: h.bio ?? null,
          teamId: h.team_id,
          memberCount: h.member_count ?? 0,
          isPrivate: !!h.is_private,
          isOfficial: !!h.is_official,
          isTeamRoom: !!h.is_team_room,
          isMember: !!h.is_member,
          lastMessageAt: h.last_message_at ?? null,
          knownNames: (h.known_names ?? []) as string[],
        };
        const list = grouped.get(row.teamId);
        if (list) list.push(row);
        else grouped.set(row.teamId, [row]);
      }
      return grouped;
    },
  });
}
