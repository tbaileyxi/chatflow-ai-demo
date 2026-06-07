import { useQuery } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  DEV_FOLLOWS_STORAGE_KEY,
  getDevTeamsByIds,
} from "@/config/devData";
import {
  formatGameClock,
  getGameState,
  resolveExternalGameForTeam,
} from "@/hooks/useLiveGameContext";

export type SuperHuddlePost = {
  id: string;
  content: string;
  mediaUrl: string | null;
  teamName: string;
  teamCity: string;
  teamLogoUrl: string | null;
  teamId: string;
  createdAt: string;
  // Trending / embed fields
  embedUrl: string | null;
  authorUsername: string | null;
  source: "post" | "trending";
  cardType: "bot" | "x" | "prediction";
};

function formatGameTeam(city: string | null, name: string | null, score: number | null) {
  const cityText = city ?? "";
  const nameText = name ?? "";
  const label =
    cityText && nameText && cityText.toLowerCase() !== nameText.toLowerCase()
      ? `${cityText} ${nameText}`
      : nameText || cityText || "Team";
  return `${label}${score === null ? "" : ` ${score}`}`;
}

export function useSuperHuddleFeed() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["super-huddle-feed", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<SuperHuddlePost[]> => {
      if (!user) return [];

      if (user.app_metadata?.provider === "dev_test") {
        const stored = await AsyncStorage.getItem(DEV_FOLLOWS_STORAGE_KEY);
        const teamIds = stored ? (JSON.parse(stored) as string[]) : [];
        const teams = getDevTeamsByIds(teamIds);
        const gamePairs = await Promise.all(
          teams.map(async (team) => ({
            teamId: team.id,
            game: await resolveExternalGameForTeam(team),
          })),
        );
        const gameByTeam = new Map(
          gamePairs.map((pair) => [pair.teamId, pair.game]),
        );

        return teams.flatMap((team, index) => {
          const baseTime = Date.now() - index * 7 * 60 * 1000;
          const game = gameByTeam.get(team.id) ?? null;
          const gameState = getGameState(game);
          const gameText =
            gameState === "none" || !game
              ? "No live game found right now. The bot is waiting for schedule and score context."
              : `${formatGameTeam(game.awayTeamCity, game.awayTeamName, game.awayScore)} at ${formatGameTeam(game.homeTeamCity, game.homeTeamName, game.homeScore)} · ${formatGameClock(game)}`;
          return [
            {
              id: `dev-${team.id}-bot`,
              content: `${team.city} ${team.name} bot: ${gameText}`,
              mediaUrl: null,
              teamName: team.name,
              teamCity: team.city,
              teamLogoUrl: team.logoUrl,
              teamId: team.id,
              createdAt: new Date(baseTime).toISOString(),
              embedUrl: null,
              authorUsername: "sidehuddlebot",
              source: "trending" as const,
              cardType: "bot" as const,
            },
            {
              id: `dev-${team.id}-x`,
              content: `X signal queue: highlights, beat reporter clips, and viral fan reactions for ${team.city} ${team.name} should land here from team_trending when X sources are configured.`,
              mediaUrl: null,
              teamName: team.name,
              teamCity: team.city,
              teamLogoUrl: team.logoUrl,
              teamId: team.id,
              createdAt: new Date(baseTime - 90 * 1000).toISOString(),
              embedUrl: null,
              authorUsername: "x-source",
              source: "trending" as const,
              cardType: "x" as const,
            },
            {
              id: `dev-${team.id}-market`,
              content: `Prediction market: ${team.city} ${team.name} next result · Yes 54¢ / No 46¢.`,
              mediaUrl: null,
              teamName: team.name,
              teamCity: team.city,
              teamLogoUrl: team.logoUrl,
              teamId: team.id,
              createdAt: new Date(baseTime - 90 * 1000).toISOString(),
              embedUrl: null,
              authorUsername: "sidehuddlebot",
              source: "trending" as const,
              cardType: "prediction" as const,
            },
          ];
        });
      }

      // Get followed team IDs
      const { data: follows, error: followError } = await supabase
        .from("user_follows")
        .select("team_id")
        .eq("user_id", user.id);

      if (followError || !follows || follows.length === 0) return [];

      const teamIds = follows.map((f) => f.team_id);

      // Fetch both sources in parallel
      const twentyFourHoursAgo = new Date(
        Date.now() - 24 * 60 * 60 * 1000,
      ).toISOString();

      const [postsResult, trendingResult, marketsResult] = await Promise.all([
        // 1. Regular posts
        supabase
          .from("posts")
          .select(
            `
            id, content, media_url, created_at, team_id,
            teams!team_id (name, city, logo_url)
          `,
          )
          .in("team_id", teamIds)
          .eq("delivery_status", "sent")
          .order("created_at", { ascending: false })
          .limit(30),

        // 2. Trending X posts (approved/broadcasted, last 24h)
        supabase
          .from("team_trending")
          .select(
            `
            id, content, embed_url, author_username, created_at, team_id,
            teams!team_id (name, city, logo_url)
          `,
          )
          .in("team_id", teamIds)
          .in("status", ["approved", "broadcasted"])
          .gte("created_at", twentyFourHoursAgo)
          .order("created_at", { ascending: false })
          .limit(20),

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
          .order("event_start_time", { ascending: true })
          .limit(20),
      ]);

      const posts: SuperHuddlePost[] = (postsResult.data ?? []).map((p) => {
        const team = (p as any).teams;
        return {
          id: p.id,
          content: p.content ?? "",
          mediaUrl: p.media_url,
          teamName: team?.name ?? "",
          teamCity: team?.city ?? "",
          teamLogoUrl: team?.logo_url ?? null,
          teamId: p.team_id ?? "",
          createdAt: p.created_at,
          embedUrl: null,
          authorUsername: null,
          source: "post" as const,
          cardType: "bot" as const,
        };
      });

      const trending: SuperHuddlePost[] = (trendingResult.data ?? []).map(
        (t: any) => {
          const team = t.teams;
          return {
            id: `trending-${t.id}`,
            content: t.content ?? "",
            mediaUrl: null,
            teamName: team?.name ?? "",
            teamCity: team?.city ?? "",
            teamLogoUrl: team?.logo_url ?? null,
            teamId: t.team_id ?? "",
            createdAt: t.created_at,
            embedUrl: t.embed_url,
            authorUsername: t.author_username,
            source: "trending" as const,
            cardType: "x" as const,
          };
        },
      );

      const marketTeamIds = [
        ...new Set((marketsResult.data ?? []).map((m) => m.team_id).filter(Boolean)),
      ] as string[];
      const { data: marketTeams } =
        marketTeamIds.length > 0
          ? await supabase
              .from("teams")
              .select("id, name, city, logo_url")
              .in("id", marketTeamIds)
          : { data: [] };
      const marketTeamMap = new Map((marketTeams ?? []).map((t) => [t.id, t]));

      const markets: SuperHuddlePost[] = (marketsResult.data ?? []).map((m) => {
        const team = m.team_id ? marketTeamMap.get(m.team_id) : null;
        return {
          id: `market-${m.id}`,
          content: `${m.question} · Yes ${m.current_yes_price ?? 50}¢ / No ${100 - (m.current_yes_price ?? 50)}¢`,
          mediaUrl: null,
          teamName: team?.name ?? "",
          teamCity: team?.city ?? "",
          teamLogoUrl: team?.logo_url ?? null,
          teamId: m.team_id ?? "",
          createdAt: m.event_start_time ?? new Date().toISOString(),
          embedUrl: null,
          authorUsername: "market",
          source: "post" as const,
          cardType: "prediction" as const,
        };
      });

      // Merge and sort by date, newest first
      return [...posts, ...trending, ...markets].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    },
  });
}
