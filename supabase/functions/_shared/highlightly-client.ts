// Shared Highlightly API client for all edge functions
export function createHighlightlyClient() {
  const apiKey = Deno.env.get("HIGHLIGHTLY_API_KEY");
  const baseUrl = "https://american-football.highlightly.net";

  return {
    // Get single match by ID
    async getMatch(matchId: number) {
      const response = await fetch(`${baseUrl}/matches/${matchId}`, {
        headers: {
          "x-rapidapi-key": apiKey || "",
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) return null;
      return await response.json();
    },

    // Get multiple matches with filters
    async getMatches(params: { team?: string; teamId?: number; league?: string; date?: string; season?: number; limit?: number; status?: string }) {
      const url = new URL(`${baseUrl}/matches`);
      if (params.team) url.searchParams.append("team", params.team);
      if (params.teamId) url.searchParams.append("teamId", params.teamId.toString());
      if (params.league) url.searchParams.append("league", params.league);
      if (params.date) url.searchParams.append("date", params.date);
      if (params.season) url.searchParams.append("season", params.season.toString());
      if (params.limit) url.searchParams.append("limit", params.limit.toString());
      if (params.status) url.searchParams.append("status", params.status);

      const response = await fetch(url.toString(), {
        headers: {
          "x-rapidapi-key": apiKey || "",
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) return [];
      return await response.json();
    },

    // Get teams by league
    async getTeams(league: string) {
      const response = await fetch(`${baseUrl}/teams?league=${encodeURIComponent(league)}`, {
        headers: {
          "x-rapidapi-key": apiKey || "",
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) return [];
      return await response.json();
    },

    // Get team info by name
    async getTeamInfo(teamName: string) {
      const response = await fetch(`${baseUrl}/teams/${encodeURIComponent(teamName)}`, {
        headers: {
          "x-rapidapi-key": apiKey || "",
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) return null;
      return await response.json();
    },

    // Get team stats
    async getTeamStats(teamName: string, season?: number) {
      const url = new URL(`${baseUrl}/teams/${encodeURIComponent(teamName)}/stats`);
      if (season) url.searchParams.append("season", season.toString());
      
      const response = await fetch(url.toString(), {
        headers: {
          "x-rapidapi-key": apiKey || "",
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) return null;
      return await response.json();
    },

    // Get team injuries
    async getInjuries(teamName: string) {
      const response = await fetch(`${baseUrl}/teams/${encodeURIComponent(teamName)}/injuries`, {
        headers: {
          "x-rapidapi-key": apiKey || "",
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) return null;
      return await response.json();
    },

    // Get match odds
    async getMatchOdds(matchId: number) {
      const response = await fetch(`${baseUrl}/matches/${matchId}/odds`, {
        headers: {
          "x-rapidapi-key": apiKey || "",
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) return null;
      return await response.json();
    },

    // Get league standings
    async getStandings(params: { league?: string; season?: number }) {
      const url = new URL(`${baseUrl}/standings`);
      if (params.league) url.searchParams.append("league", params.league);
      if (params.season) url.searchParams.append("season", params.season.toString());
      
      const response = await fetch(url.toString(), {
        headers: {
          "x-rapidapi-key": apiKey || "",
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) return null;
      return await response.json();
    },

    // Get match lineups
    async getLineups(matchId: number) {
      const response = await fetch(`${baseUrl}/matches/${matchId}/lineups`, {
        headers: {
          "x-rapidapi-key": apiKey || "",
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) return null;
      return await response.json();
    },


    // Get player stats
    async getPlayerStats(params: { team?: string; player?: string; season?: number; league?: string }) {
      const url = new URL(`${baseUrl}/players/stats`);
      if (params.team) url.searchParams.append("team", params.team);
      if (params.player) url.searchParams.append("player", params.player);
      if (params.season) url.searchParams.append("season", params.season.toString());
      if (params.league) url.searchParams.append("league", params.league);
      
      const response = await fetch(url.toString(), {
        headers: {
          "x-rapidapi-key": apiKey || "",
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) return null;
      return await response.json();
    },

    // Get head-to-head stats
    async getHeadToHead(team1: string, team2: string, league?: string) {
      const url = new URL(`${baseUrl}/head-to-head`);
      url.searchParams.append("team1", team1);
      url.searchParams.append("team2", team2);
      if (league) url.searchParams.append("league", league);
      
      const response = await fetch(url.toString(), {
        headers: {
          "x-rapidapi-key": apiKey || "",
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) return null;
      return await response.json();
    },
  };
}
