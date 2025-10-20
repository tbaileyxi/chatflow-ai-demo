// Highlightly.net API Client
// Base URL for American Football API
const BASE_URL = "https://american-football.highlightly.net";

export interface HighlightlyMatch {
  id: number;
  league: string;
  season: number;
  week?: number;
  round?: string;
  date?: string;
  startTime?: string;
  status: "scheduled" | "in_progress" | "finished" | "postponed" | "suspended" | "cancelled" | "abandoned";
  homeTeam: {
    id: number;
    name: string;
    displayName?: string;
    abbreviation: string;
    score?: number;
  };
  awayTeam: {
    id: number;
    name: string;
    displayName?: string;
    abbreviation: string;
    score?: number;
  };
  period?: number;
  clock?: string;
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

    // Check for rate limiting
    if (response.status === 429) {
      console.error("⚠️ Highlightly API rate limit hit - backing off");
      throw new Error("RATE_LIMIT_EXCEEDED");
    }

    // Check for other HTTP errors
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Highlightly API error (${response.status}):`, errorText);
      throw new Error(`API_ERROR_${response.status}: ${errorText}`);
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
    season?: number;
    homeTeamId?: number;
    awayTeamId?: number;
    limit?: number;
    offset?: number;
  }): Promise<HighlightlyMatch[]> {
    const queryParams = new URLSearchParams();
    if (params.league) queryParams.append("league", params.league);
    if (params.date) queryParams.append("date", params.date);
    if (params.season) queryParams.append("season", params.season.toString());
    if (params.homeTeamId) queryParams.append("homeTeamId", params.homeTeamId.toString());
    if (params.awayTeamId) queryParams.append("awayTeamId", params.awayTeamId.toString());
    if (params.limit) queryParams.append("limit", params.limit.toString());
    if (params.offset) queryParams.append("offset", params.offset.toString());

    const url = `/matches${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    console.log(`🔍 Highlightly API Request: GET ${url}`);
    
    const response = await this.fetch<{ data: any[] }>(url);
    
    // Extract data from nested structure
    const rawMatches = response?.data || [];
    
    console.log(`📊 Highlightly API Response: ${rawMatches.length} matches returned`);
    
    // Debug: Log raw API response for first match to see actual field names
    if (rawMatches.length > 0) {
      console.log(`🔍 RAW API RESPONSE (first match):`, JSON.stringify(rawMatches[0], null, 2));
    }
    
    // Map API fields to expected format - extract from nested 'state' object
    const matches: HighlightlyMatch[] = rawMatches.map((match: any) => {
      // Parse scores from state.score.current string (e.g., "14 - 7")
      // API returns scores in "home - away" format
      const scoreString = match.state?.score?.current || "0 - 0";
      const [homeScoreStr, awayScoreStr] = scoreString.split(" - ").map((s: string) => s.trim());
      
      // Normalize status description to expected values
      let normalizedStatus = (match.state?.description || 'scheduled').toLowerCase();
      if (normalizedStatus.includes('progress') || normalizedStatus.includes('live')) {
        normalizedStatus = 'in_progress';
      } else if (normalizedStatus.includes('final') || normalizedStatus.includes('complete')) {
        normalizedStatus = 'finished';
      } else if (normalizedStatus.includes('schedul')) {
        normalizedStatus = 'scheduled';
      }
      
      return {
        id: match.id,
        league: match.league,
        season: match.season,
        week: match.week,
        round: match.round,
        date: match.date,
        startTime: match.date, // Use date field as start time
        status: normalizedStatus as any,
        homeTeam: {
          id: match.homeTeam?.id,
          name: match.homeTeam?.name,
          displayName: match.homeTeam?.displayName,
          abbreviation: match.homeTeam?.abbreviation,
          score: Number(homeScoreStr) || 0
        },
        awayTeam: {
          id: match.awayTeam?.id,
          name: match.awayTeam?.name,
          displayName: match.awayTeam?.displayName,
          abbreviation: match.awayTeam?.abbreviation,
          score: Number(awayScoreStr) || 0
        },
        period: match.state?.period || 0,
        clock: match.state?.clock?.toString() || '',
        venue: match.venue
      };
    });
    
    // Log first few matches for debugging
    if (matches.length > 0) {
      matches.slice(0, 3).forEach(m => {
        const home = m.homeTeam?.name || m.homeTeam?.abbreviation || 'Unknown';
        const away = m.awayTeam?.name || m.awayTeam?.abbreviation || 'Unknown';
        console.log(`   📋 ${away} @ ${home} - Status: ${m.status}`);
      });
    }
    
    return matches;
  }

  // Get specific match details
  async getMatch(matchId: number): Promise<HighlightlyMatch> {
    return this.fetch<HighlightlyMatch>(`/matches/${matchId}`);
  }

  // Get highlights for a match - FIXED to use correct API parameters
  async getHighlights(params: {
    date?: string;        // YYYY-MM-DD
    leagueName?: "NFL" | "NCAA";
    matchId?: number;     // Keep for filtering after fetch
    limit?: number;
  }): Promise<HighlightlyHighlight[]> {
    const queryParams = new URLSearchParams();
    if (params.date) queryParams.append("date", params.date);
    if (params.leagueName) queryParams.append("leagueName", params.leagueName);
    if (params.limit) queryParams.append("limit", params.limit.toString());
    
    const url = `/highlights${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    console.log(`🔍 Highlightly Highlights API Request: GET ${url}`);
    
    const response = await this.fetch<{ data: any[] }>(url);
    const rawHighlights = response?.data || [];
    
    console.log(`📊 Highlightly Highlights API Response: ${rawHighlights.length} highlights returned`);
    
    // DEBUG: Log first highlight to see actual structure
    if (rawHighlights.length > 0) {
      console.log(`🔍 SAMPLE HIGHLIGHT STRUCTURE:`, JSON.stringify(rawHighlights[0], null, 2));
    }
    
    // Filter by matchId if provided (since API doesn't support matchId param directly)
    let highlights = rawHighlights;
    if (params.matchId) {
      highlights = rawHighlights.filter((h: any) => h.match?.id === params.matchId);
      console.log(`🔍 Filtered to ${highlights.length} highlights for match ${params.matchId}`);
    }
    
    // Map API response to our interface
    return highlights.map((h: any) => ({
      id: h.id,
      matchId: h.match?.id || 0,
      title: h.title || '',
      description: h.description || '',
      embedUrl: h.embedUrl || h.url || '',
      thumbnailUrl: h.imgUrl || h.thumbnailUrl || h.thumbnail || '',
      duration: h.duration || 0,
      timestamp: h.timestamp || h.createdAt || '',
      period: h.period || 0,
      clock: h.clock || ''
    }));
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
