// Highlightly.net API Client
// Base URL for American Football API
const BASE_URL = "https://american-football.highlightly.net";

export interface HighlightlyMatch {
  id: number;
  league: string;
  season: number;
  week: number;
  startTime: string;
  status: "scheduled" | "in_progress" | "finished";
  homeTeam: {
    id: number;
    name: string;
    abbreviation: string;
    score: number;
  };
  awayTeam: {
    id: number;
    name: string;
    abbreviation: string;
    score: number;
  };
  period: number;
  clock: string;
  venue?: string;
}

export interface HighlightlyTeam {
  id: number;
  name: string;
  abbreviation: string;
  city: string;
  conference?: string;
  division?: string;
  logo?: string;
}

export interface HighlightlyHighlight {
  id: number;
  matchId: number;
  title: string;
  description: string;
  embedUrl: string;
  thumbnailUrl: string;
  duration: number;
  timestamp: string;
  period: number;
  clock: string;
}

export class HighlightlyClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async fetch<T>(endpoint: string): Promise<T> {
    const url = `${BASE_URL}${endpoint}`;
    
    const response = await fetch(url, {
      headers: {
        "x-rapidapi-key": this.apiKey,
        "x-rapidapi-host": "american-football.highlightly.net",
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Highlightly API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  // Get teams by league
  async getTeams(league: "NFL" | "NCAA"): Promise<HighlightlyTeam[]> {
    return this.fetch<HighlightlyTeam[]>(`/teams?league=${league}`);
  }

  // Get matches by date and league
  async getMatches(params: {
    league?: "NFL" | "NCAA";
    date?: string; // YYYY-MM-DD
    week?: number;
    season?: number;
    teamId?: number;
    status?: "scheduled" | "in_progress" | "finished";
  }): Promise<HighlightlyMatch[]> {
    const queryParams = new URLSearchParams();
    if (params.league) queryParams.append("league", params.league);
    if (params.date) queryParams.append("date", params.date);
    if (params.week) queryParams.append("week", params.week.toString());
    if (params.season) queryParams.append("season", params.season.toString());
    if (params.teamId) queryParams.append("teamId", params.teamId.toString());
    if (params.status) queryParams.append("status", params.status);

    return this.fetch<HighlightlyMatch[]>(`/matches?${queryParams.toString()}`);
  }

  // Get specific match details
  async getMatch(matchId: number): Promise<HighlightlyMatch> {
    return this.fetch<HighlightlyMatch>(`/matches/${matchId}`);
  }

  // Get highlights for a match
  async getHighlights(matchId: number, limit = 10): Promise<HighlightlyHighlight[]> {
    return this.fetch<HighlightlyHighlight[]>(`/highlights?matchId=${matchId}&limit=${limit}`);
  }

  // Get recent highlights for a team
  async getTeamHighlights(teamId: number, limit = 5): Promise<HighlightlyHighlight[]> {
    return this.fetch<HighlightlyHighlight[]>(`/highlights?teamId=${teamId}&limit=${limit}`);
  }
}

export function createHighlightlyClient(): HighlightlyClient {
  const apiKey = Deno.env.get("HIGHLIGHTLY_API_KEY");
  if (!apiKey) {
    throw new Error("HIGHLIGHTLY_API_KEY not found in environment");
  }
  return new HighlightlyClient(apiKey);
}
