import { useQuery } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  DEV_FOLLOWS_STORAGE_KEY,
  DEV_ROOMS_STORAGE_KEY,
  getDevTeamById,
  getDevTeamsByIds,
} from "@/config/devData";
import {
  getGameState,
  resolveExternalGameForTeam,
  type GameContext,
  type GameState,
} from "@/hooks/useLiveGameContext";

export type GameNightRoom = {
  id: string;
  name: string;
  memberCount: number;
  isPrivate: boolean;
  isOfficialTeam: boolean;
  teamId: string;
  teamName: string | null;
  teamCity: string | null;
  teamLogoUrl: string | null;
  lastMessageAt: string | null;
  game: GameContext | null;
  gameState: GameState;
};

export type GameNightMarket = {
  id: string;
  question: string;
  currentYesPrice: number;
  eventStartTime: string;
  huddleId: string | null;
};

export type GameNightCommunity = {
  teamId: string;
  teamName: string;
  teamCity: string;
  teamLogoUrl: string | null;
  officialHuddleId: string | null;
  rooms: GameNightRoom[];
  game: GameContext | null;
  gameState: GameState;
  topMarket: GameNightMarket | null;
};

async function resolveGamesForTeams(teamIds: string[]) {
  if (teamIds.length === 0) return new Map<string, GameContext>();

  const now = new Date();
  const twoDaysOutIso = new Date(
    now.getTime() + 48 * 60 * 60 * 1000,
  ).toISOString();
  const oneDayAgoIso = new Date(
    now.getTime() - 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data: games } = await supabase
    .from("games")
    .select("*")
    .or(
      `home_team_id.in.(${teamIds.join(",")}),away_team_id.in.(${teamIds.join(",")})`,
    )
    .in("status", [
      "in_progress",
      "live",
      "scheduled",
      "final",
      "completed",
      "closed",
    ])
    .gte("start_time", oneDayAgoIso)
    .lte("start_time", twoDaysOutIso)
    .order("start_time", { ascending: true });

  const allTeamIds = [
    ...new Set(
      (games ?? [])
        .flatMap((g) => [g.home_team_id, g.away_team_id])
        .filter(Boolean),
    ),
  ] as string[];

  const { data: teams } =
    allTeamIds.length > 0
      ? await supabase
          .from("teams")
          .select("id, name, city")
          .in("id", allTeamIds)
      : { data: [] };

  const teamMap = new Map((teams ?? []).map((t) => [t.id, t]));
  const gameByTeam = new Map<string, GameContext>();

  for (const game of games ?? []) {
    const context: GameContext = {
      id: game.id,
      homeTeamId: game.home_team_id,
      awayTeamId: game.away_team_id,
      homeScore: game.home_score,
      awayScore: game.away_score,
      clock: game.clock,
      period: game.period,
      status: game.status,
      startTime: game.start_time,
      sportKey: game.sport_key ?? "",
      // Sourced from the `games` table above, so fade-settle can grade it.
      settleable: true,
      homeTeamName: game.home_team_id
        ? teamMap.get(game.home_team_id)?.name ?? null
        : null,
      awayTeamName: game.away_team_id
        ? teamMap.get(game.away_team_id)?.name ?? null
        : null,
      homeTeamCity: game.home_team_id
        ? teamMap.get(game.home_team_id)?.city ?? null
        : null,
      awayTeamCity: game.away_team_id
        ? teamMap.get(game.away_team_id)?.city ?? null
        : null,
    };

    const state = getGameState(context);
    for (const teamId of [game.home_team_id, game.away_team_id]) {
      if (!teamId || !teamIds.includes(teamId)) continue;
      const existing = gameByTeam.get(teamId);
      if (!existing || compareGamePriority(context, existing) < 0) {
        gameByTeam.set(teamId, context);
      }
      if (state === "live") {
        gameByTeam.set(teamId, context);
      }
    }
  }

  const missingTeamIds = teamIds.filter((teamId) => !gameByTeam.has(teamId));
  if (missingTeamIds.length > 0) {
    const devTeams = missingTeamIds
      .map((teamId) => getDevTeamById(teamId))
      .filter(Boolean);

    const supabaseTeamIds = missingTeamIds.filter(
      (teamId) => !getDevTeamById(teamId),
    );
    const { data: missingDbTeams } =
      supabaseTeamIds.length > 0
        ? await supabase
            .from("teams")
            .select("id, name, city, league")
            .in("id", supabaseTeamIds)
        : { data: [] };

    const fallbackGames = await Promise.all(
      [...devTeams, ...(missingDbTeams ?? [])].map(async (team) => ({
        teamId: team!.id,
        game: await resolveExternalGameForTeam(team as any),
      })),
    );

    for (const item of fallbackGames) {
      if (item.game) gameByTeam.set(item.teamId, item.game);
    }
  }

  return gameByTeam;
}

function compareGamePriority(a: GameContext, b: GameContext) {
  const order: Record<GameState, number> = {
    live: 0,
    pregame: 1,
    postgame: 2,
    none: 3,
  };
  const aState = getGameState(a);
  const bState = getGameState(b);
  if (order[aState] !== order[bState]) return order[aState] - order[bState];
  return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
}

function roomPriority(room: GameNightRoom) {
  const order: Record<GameState, number> = {
    live: 0,
    pregame: 1,
    postgame: 2,
    none: 3,
  };
  const recency = room.lastMessageAt
    ? -new Date(room.lastMessageAt).getTime()
    : 0;
  return [
    order[room.gameState],
    room.isOfficialTeam ? 1 : 0,
    recency,
  ] as const;
}

export function useGameNightRooms() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["game-night-rooms", user?.id],
    enabled: !!user,
    refetchInterval: 60 * 1000,
    queryFn: async (): Promise<GameNightRoom[]> => {
      if (!user) return [];

      const { data: memberships, error } = await supabase
        .from("huddle_members")
        .select(
          `
          huddles (
            id, name, member_count, last_message_at,
            is_private, is_official_team_huddle, team_id,
            teams!team_id (name, city, logo_url)
          )
        `,
        )
        .eq("user_id", user.id);

      if (error || !memberships) return [];

      const rawRooms = memberships
        .map((m) => (m.huddles as any) ?? null)
        .filter((h): h is Record<string, any> => !!h?.team_id);

      const teamIds = [...new Set(rawRooms.map((h) => h.team_id))];
      const gameByTeam = await resolveGamesForTeams(teamIds);

      return rawRooms
        .map((h) => {
          const team = h.teams;
          const game = gameByTeam.get(h.team_id) ?? null;
          return {
            id: h.id,
            name: h.name,
            memberCount: h.member_count ?? 0,
            isPrivate: h.is_private ?? false,
            isOfficialTeam: h.is_official_team_huddle ?? false,
            teamId: h.team_id,
            teamName: team?.name ?? null,
            teamCity: team?.city ?? null,
            teamLogoUrl: team?.logo_url ?? null,
            lastMessageAt: h.last_message_at,
            game,
            gameState: getGameState(game),
          };
        })
        .sort((a, b) => {
          const ap = roomPriority(a);
          const bp = roomPriority(b);
          return ap[0] - bp[0] || ap[1] - bp[1] || ap[2] - bp[2];
        });
    },
  });
}

export function useGameNightCommunities() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["game-night-communities", user?.id],
    enabled: !!user,
    refetchInterval: 60 * 1000,
    queryFn: async (): Promise<GameNightCommunity[]> => {
      if (!user) return [];

      if (user.app_metadata?.provider === "dev_test") {
        const stored = await AsyncStorage.getItem(DEV_FOLLOWS_STORAGE_KEY);
        const teamIds = stored ? (JSON.parse(stored) as string[]) : [];
        const storedRooms = await AsyncStorage.getItem(DEV_ROOMS_STORAGE_KEY);
        const devRooms = storedRooms ? JSON.parse(storedRooms) : [];
        const teams = getDevTeamsByIds(teamIds);
        const gameByTeam = await resolveGamesForTeams(teamIds);
        return teams.map((team) => {
          const game = gameByTeam.get(team.id) ?? null;
          const rooms = devRooms
            .filter((room: any) => room.teamId === team.id)
            .map((room: any) => ({
              id: room.id,
              name: room.name,
              memberCount: 1,
              isPrivate: true,
              isOfficialTeam: false,
              teamId: team.id,
              teamName: team.name,
              teamCity: team.city,
              teamLogoUrl: team.logoUrl,
              lastMessageAt: room.createdAt ?? null,
              game,
              gameState: getGameState(game),
            }));
          return {
            teamId: team.id,
            teamName: team.name,
            teamCity: team.city,
            teamLogoUrl: team.logoUrl,
            officialHuddleId: null,
            rooms,
            game,
            gameState: getGameState(game),
            topMarket: {
              id: `dev-market-${team.id}`,
              question: `${team.city} ${team.name}: next result / market card`,
              currentYesPrice: 54,
              eventStartTime:
                game?.startTime ??
                new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
              huddleId: null,
            },
          };
        });
      }

      const { data: follows } = await supabase
        .from("user_follows")
        .select("team_id")
        .eq("user_id", user.id);

      const teamIds = [...new Set((follows ?? []).map((f) => f.team_id))];
      if (teamIds.length === 0) return [];

      const [
        { data: teams },
        { data: officialHuddles },
        { data: memberships },
        { data: markets },
      ] = await Promise.all([
        supabase
          .from("teams")
          .select("id, name, city, logo_url")
          .in("id", teamIds),
        supabase
          .from("huddles")
          .select(
            "id, name, member_count, last_message_at, is_private, is_official_team_huddle, team_id",
          )
          .in("team_id", teamIds)
          .eq("is_official_team_huddle", true),
        supabase
          .from("huddle_members")
          .select(
            `
            huddles (
              id, name, member_count, last_message_at,
              is_private, is_official_team_huddle, team_id
            )
          `,
          )
          .eq("user_id", user.id),
        supabase
          .from("kalshi_markets")
          .select(
            "id, question, current_yes_price, event_start_time, team_id, huddle_id",
          )
          .in("team_id", teamIds)
          .eq("is_resolved", false)
          .gte("event_start_time", new Date().toISOString())
          .lte(
            "event_start_time",
            new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          )
          .order("event_start_time", { ascending: true }),
      ]);

      const gameByTeam = await resolveGamesForTeams(teamIds);
      const teamMap = new Map((teams ?? []).map((t) => [t.id, t]));
      const officialByTeam = new Map(
        (officialHuddles ?? []).map((h) => [h.team_id, h]),
      );

      const roomsByTeam = new Map<string, GameNightRoom[]>();
      for (const membership of memberships ?? []) {
        const h = (membership.huddles as any) ?? null;
        if (!h?.team_id || !teamIds.includes(h.team_id)) continue;
        const team = teamMap.get(h.team_id);
        const game = gameByTeam.get(h.team_id) ?? null;
        const room: GameNightRoom = {
          id: h.id,
          name: h.name,
          memberCount: h.member_count ?? 0,
          isPrivate: h.is_private ?? false,
          isOfficialTeam: h.is_official_team_huddle ?? false,
          teamId: h.team_id,
          teamName: team?.name ?? null,
          teamCity: team?.city ?? null,
          teamLogoUrl: team?.logo_url ?? null,
          lastMessageAt: h.last_message_at,
          game,
          gameState: getGameState(game),
        };
        const list = roomsByTeam.get(h.team_id) ?? [];
        list.push(room);
        roomsByTeam.set(h.team_id, list);
      }

      for (const h of officialHuddles ?? []) {
        if (!h.team_id || roomsByTeam.get(h.team_id)?.some((r) => r.id === h.id)) {
          continue;
        }
        const team = teamMap.get(h.team_id);
        const game = gameByTeam.get(h.team_id) ?? null;
        const list = roomsByTeam.get(h.team_id) ?? [];
        list.push({
          id: h.id,
          name: h.name,
          memberCount: h.member_count ?? 0,
          isPrivate: h.is_private ?? false,
          isOfficialTeam: h.is_official_team_huddle ?? false,
          teamId: h.team_id,
          teamName: team?.name ?? null,
          teamCity: team?.city ?? null,
          teamLogoUrl: team?.logo_url ?? null,
          lastMessageAt: h.last_message_at,
          game,
          gameState: getGameState(game),
        });
        roomsByTeam.set(h.team_id, list);
      }

      const marketByTeam = new Map<string, GameNightMarket>();
      for (const market of markets ?? []) {
        if (!market.team_id || marketByTeam.has(market.team_id)) continue;
        marketByTeam.set(market.team_id, {
          id: market.id,
          question: market.question,
          currentYesPrice: market.current_yes_price ?? 50,
          eventStartTime: market.event_start_time ?? "",
          huddleId: market.huddle_id ?? officialByTeam.get(market.team_id)?.id ?? null,
        });
      }

      const communities = teamIds
        .map((teamId) => {
          const team = teamMap.get(teamId);
          if (!team) return null;
          const game = gameByTeam.get(teamId) ?? null;
          const rooms = (roomsByTeam.get(teamId) ?? []).sort((a, b) => {
            const ap = roomPriority(a);
            const bp = roomPriority(b);
            return ap[0] - bp[0] || ap[1] - bp[1] || ap[2] - bp[2];
          });
          return {
            teamId,
            teamName: team.name,
            teamCity: team.city,
            teamLogoUrl: team.logo_url ?? null,
            officialHuddleId: officialByTeam.get(teamId)?.id ?? null,
            rooms,
            game,
            gameState: getGameState(game),
            topMarket: marketByTeam.get(teamId) ?? null,
          };
        })
        .filter((c): c is GameNightCommunity => !!c);

      const order: Record<GameState, number> = {
        live: 0,
        pregame: 1,
        postgame: 2,
        none: 3,
      };

      return communities.sort((a, b) => {
        return (
          order[a.gameState] - order[b.gameState] ||
          (b.rooms.length > 0 ? 1 : 0) - (a.rooms.length > 0 ? 1 : 0) ||
          (b.topMarket ? 1 : 0) - (a.topMarket ? 1 : 0)
        );
      });
    },
  });
}
