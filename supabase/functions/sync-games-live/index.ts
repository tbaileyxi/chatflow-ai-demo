import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Sport keys for Odds API
const SPORT_KEYS = [
  'americanfootball_nfl',
  'americanfootball_ncaaf', 
  'basketball_nba',
  'basketball_ncaab',
  'icehockey_nhl',
  'baseball_mlb'
];

// Cooldown duration in milliseconds (90 minutes)
const COOLDOWN_DURATION_MS = 90 * 60 * 1000;

interface OddsApiGame {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  completed: boolean;
  home_team: string;
  away_team: string;
  scores?: Array<{ name: string; score: string }>;
}

interface Team {
  id: string;
  name: string;
  city: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ODDS_API_KEY = Deno.env.get('ODDS_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!ODDS_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing required environment variables');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log('Starting games sync...');

    // Teams, indexed PER LEAGUE, never by nickname alone.
    //
    // This is where the wrong-team games came from. The old index keyed every
    // team by its bare nickname and then matched by substring in both
    // directions, with a final fallback that compared only the LAST WORD. So:
    //
    //   "New Mexico State Aggies"   -> aggies    -> Texas A&M Aggies
    //   "Hawai'i Rainbow Warriors"  -> warriors  -> Golden State Warriors
    //   "Sacramento State"          -> sacramento-> Sacramento Kings
    //   "San Jose State Spartans"   -> san jose  -> San Jose Sharks
    //
    // A Texas A&M room carried a 34-17 loss to Florida State for a game New
    // Mexico State played. And because this upserts on odds_game_id, it wrote
    // the wrong team back every run — a hand-repaired row was correct until the
    // next sync undid it.
    const SPORT_TO_DB_LEAGUE: Record<string, string> = {
      americanfootball_nfl: 'NFL',
      americanfootball_ncaaf: 'NCAA',
      basketball_nba: 'NBA',
      basketball_ncaab: 'NCAA',
      icehockey_nhl: 'NHL',
      baseball_mlb: 'MLB',
    };

    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select('id, name, city, league')
      .eq('status', 'active');

    if (teamsError) throw teamsError;

    // Fold accents and punctuation so "San José State" and "Hawai'i" compare as
    // their plain-ASCII spellings.
    const norm = (v: string) =>
      (v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

    const byLeague = new Map<string, Map<string, Team>>();
    const shortByLeague = new Map<string, Map<string, Team>>();
    const poisoned = new Map<string, Set<string>>();

    for (const team of (teams ?? []) as (Team & { league: string })[]) {
      const lg = team.league;
      if (!byLeague.has(lg)) byLeague.set(lg, new Map());
      if (!shortByLeague.has(lg)) shortByLeague.set(lg, new Map());
      if (!poisoned.has(lg)) poisoned.set(lg, new Set());

      byLeague.get(lg)!.set(norm(`${team.city} ${team.name}`), team);

      // The school/city on its own, because the odds feed names college teams
      // that way ("New Mexico State", not "New Mexico State Aggies"). Only where
      // it is unambiguous IN THAT LEAGUE: "new york" is two NFL teams, so a key
      // that would resolve to more than one is poisoned rather than left
      // pointing at whichever row happened to load first.
      const shortMap = shortByLeague.get(lg)!;
      const bad = poisoned.get(lg)!;
      const key = norm(team.city ?? '');
      if (!key) continue;
      if (bad.has(key)) continue;
      if (shortMap.has(key)) { shortMap.delete(key); bad.add(key); continue; }
      shortMap.set(key, team);
    }

    // Exact keys only. No substring, no last-word: those are what produced the
    // collisions above, and a wrong team is far worse than no team — an
    // unmatched game is invisible, while a mismatched one posts a result into
    // the wrong fans' room.
    const findTeam = (teamName: string, sportKey: string): Team | null => {
      const lg = SPORT_TO_DB_LEAGUE[sportKey];
      if (!lg) return null;
      const key = norm(teamName);
      return byLeague.get(lg)?.get(key)
        ?? shortByLeague.get(lg)?.get(key)
        ?? null;
    };

    let gamesUpserted = 0;
    let teamsUpdated = 0;
    const liveTeamIds = new Set<string>();
    const finalTeamIds = new Set<string>();

    // Fetch games from Odds API for each sport
    for (const sportKey of SPORT_KEYS) {
      try {
        // Fetch scores for live/completed games
        const scoresUrl = `https://api.the-odds-api.com/v4/sports/${sportKey}/scores/?apiKey=${ODDS_API_KEY}&daysFrom=1`;
        const scoresResponse = await fetch(scoresUrl);
        
        if (!scoresResponse.ok) {
          console.log(`Skipping ${sportKey}: ${scoresResponse.status}`);
          continue;
        }

        const games: OddsApiGame[] = await scoresResponse.json();
        console.log(`Fetched ${games.length} games for ${sportKey}`);

        for (const game of games) {
          const homeTeam = findTeam(game.home_team, sportKey);
          const awayTeam = findTeam(game.away_team, sportKey);

          // Determine game status
          let status: 'scheduled' | 'in_progress' | 'final' = 'scheduled';
          const now = new Date();
          const commenceTime = new Date(game.commence_time);
          
          if (game.completed) {
            status = 'final';
          } else if (commenceTime <= now) {
            status = 'in_progress';
          }

          // Parse scores
          let homeScore: number | null = null;
          let awayScore: number | null = null;
          
          if (game.scores) {
            const homeScoreData = game.scores.find(s => s.name === game.home_team);
            const awayScoreData = game.scores.find(s => s.name === game.away_team);
            homeScore = homeScoreData ? parseInt(homeScoreData.score) : null;
            awayScore = awayScoreData ? parseInt(awayScoreData.score) : null;
          }

          // Upsert game
          const { error: upsertError } = await supabase
            .from('games')
            .upsert({
              odds_game_id: game.id,
              sport_key: sportKey,
              start_time: game.commence_time,
              status,
              // Only written when we actually resolved them. Sending null on
              // every run overwrote the opponent that sync-live-scores had
              // filled in, so a room's scoreboard flipped between a team name
              // and the word "Away" once a minute. Omitted columns are left
              // alone by ON CONFLICT DO UPDATE; a new row simply starts null and
              // gets repaired on the next pass.
              ...(homeTeam?.id ? { home_team_id: homeTeam.id } : {}),
              ...(awayTeam?.id ? { away_team_id: awayTeam.id } : {}),
              home_score: homeScore,
              away_score: awayScore,
              last_synced_at: new Date().toISOString()
            }, { onConflict: 'odds_game_id' });

          if (upsertError) {
            console.error('Error upserting game:', upsertError);
            continue;
          }

          gamesUpserted++;

          // Track live/final teams
          if (status === 'live') {
            if (homeTeam) liveTeamIds.add(homeTeam.id);
            if (awayTeam) liveTeamIds.add(awayTeam.id);
          } else if (status === 'final') {
            if (homeTeam) finalTeamIds.add(homeTeam.id);
            if (awayTeam) finalTeamIds.add(awayTeam.id);
          }
        }
      } catch (sportError) {
        console.error(`Error fetching ${sportKey}:`, sportError);
      }
    }

    console.log(`Upserted ${gamesUpserted} games`);

    // A live game showing "0:00".
    //
    // This job flips a game to in_progress on TIME — kickoff has passed — but
    // it carries no clock, so the row keeps whatever the last sync left there.
    // Before a game starts that value is "0:00", and the room header renders
    // [period, clock], where a truthy "0:00" beats the "Live" fallback. Colorado
    // kicked off under a weather delay and the scoreboard read 0:00 as though a
    // quarter had ended.
    //
    // Null it and the header falls back to "Live", which is the true statement
    // we can make. Self-correcting: the moment ESPN reports a running clock,
    // sync-live-scores writes it and this stops matching.
    const { error: clockErr } = await supabase
      .from('games')
      .update({ clock: null })
      .eq('status', 'in_progress')
      .eq('clock', '0:00')
      .is('period', null);
    if (clockErr) console.error('clock reset failed:', clockErr.message);

    // Now update teams_live_state based on current games
    const now = new Date();

    // Get current live games with team mappings
    const { data: liveGames } = await supabase
      .from('games')
      .select('*')
      .eq('status', 'live');

    // Update live teams
    for (const game of liveGames || []) {
      if (game.home_team_id) {
        await supabase.from('teams_live_state').upsert({
          team_id: game.home_team_id,
          state: 'live',
          active_game_id: game.id,
          active_opponent_team_id: game.away_team_id,
          home_score: game.home_score,
          away_score: game.away_score,
          is_home_team: true,
          cooldown_ends_at: null,
          updated_at: now.toISOString()
        }, { onConflict: 'team_id' });
        teamsUpdated++;
      }

      if (game.away_team_id) {
        await supabase.from('teams_live_state').upsert({
          team_id: game.away_team_id,
          state: 'live',
          active_game_id: game.id,
          active_opponent_team_id: game.home_team_id,
          home_score: game.away_score,
          away_score: game.home_score,
          is_home_team: false,
          cooldown_ends_at: null,
          updated_at: now.toISOString()
        }, { onConflict: 'team_id' });
        teamsUpdated++;
      }
    }

    // Handle cooldown for recently finished games
    const { data: finalGames } = await supabase
      .from('games')
      .select('*')
      .eq('status', 'final')
      .gte('last_synced_at', new Date(now.getTime() - COOLDOWN_DURATION_MS).toISOString());

    for (const game of finalGames || []) {
      const cooldownEnds = new Date(now.getTime() + COOLDOWN_DURATION_MS);
      
      // Check if team isn't already in a live game
      if (game.home_team_id && !liveTeamIds.has(game.home_team_id)) {
        const { data: existing } = await supabase
          .from('teams_live_state')
          .select('state')
          .eq('team_id', game.home_team_id)
          .single();

        if (!existing || existing.state !== 'live') {
          await supabase.from('teams_live_state').upsert({
            team_id: game.home_team_id,
            state: 'cooldown',
            active_game_id: game.id,
            active_opponent_team_id: game.away_team_id,
            home_score: game.home_score,
            away_score: game.away_score,
            is_home_team: true,
            cooldown_ends_at: cooldownEnds.toISOString(),
            updated_at: now.toISOString()
          }, { onConflict: 'team_id' });
          teamsUpdated++;
        }
      }

      if (game.away_team_id && !liveTeamIds.has(game.away_team_id)) {
        const { data: existing } = await supabase
          .from('teams_live_state')
          .select('state')
          .eq('team_id', game.away_team_id)
          .single();

        if (!existing || existing.state !== 'live') {
          await supabase.from('teams_live_state').upsert({
            team_id: game.away_team_id,
            state: 'cooldown',
            active_game_id: game.id,
            active_opponent_team_id: game.home_team_id,
            home_score: game.away_score,
            away_score: game.home_score,
            is_home_team: false,
            cooldown_ends_at: cooldownEnds.toISOString(),
            updated_at: now.toISOString()
          }, { onConflict: 'team_id' });
          teamsUpdated++;
        }
      }
    }

    // Clear expired cooldowns (set to normal)
    const { data: expiredCooldowns } = await supabase
      .from('teams_live_state')
      .select('team_id')
      .eq('state', 'cooldown')
      .lt('cooldown_ends_at', now.toISOString());

    for (const item of expiredCooldowns || []) {
      await supabase.from('teams_live_state').update({
        state: 'normal',
        active_game_id: null,
        active_opponent_team_id: null,
        home_score: null,
        away_score: null,
        cooldown_ends_at: null,
        updated_at: now.toISOString()
      }).eq('team_id', item.team_id);
      teamsUpdated++;
    }

    // Clear teams that are no longer in any active game
    const liveTeamIdsArray = Array.from(liveTeamIds);
    if (liveTeamIdsArray.length > 0) {
      const { data: staleStates } = await supabase
        .from('teams_live_state')
        .select('team_id')
        .eq('state', 'live')
        .not('team_id', 'in', `(${liveTeamIdsArray.join(',')})`);

      for (const item of staleStates || []) {
        // Move to cooldown instead of immediately to normal
        await supabase.from('teams_live_state').update({
          state: 'cooldown',
          cooldown_ends_at: new Date(now.getTime() + COOLDOWN_DURATION_MS).toISOString(),
          updated_at: now.toISOString()
        }).eq('team_id', item.team_id);
        teamsUpdated++;
      }
    }

    console.log(`Updated ${teamsUpdated} team states`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        games_synced: gamesUpserted,
        teams_updated: teamsUpdated,
        live_teams: liveTeamIds.size
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Sync games error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
