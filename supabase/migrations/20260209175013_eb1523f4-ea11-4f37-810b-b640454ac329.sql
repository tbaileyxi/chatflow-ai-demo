
-- Fix NC State Wolfpack logo (was using UNC Tar Heels ESPN ID 153, correct is 152)
UPDATE public.teams SET logo_url = 'https://a.espncdn.com/i/teamlogos/ncaa/500/152.png' WHERE id = '6b3f3727-f0e0-466a-ac71-21ebc835667a';

-- Create a function to cascade delete a team and all related data
CREATE OR REPLACE FUNCTION public.delete_team_cascade(team_id_input UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  huddle_rec RECORD;
BEGIN
  -- Delete huddle-related data for all huddles belonging to this team
  FOR huddle_rec IN SELECT id FROM huddles WHERE team_id = team_id_input OR parent_team_id = team_id_input
  LOOP
    -- Delete deep huddle dependencies
    DELETE FROM huddle_message_reactions WHERE message_id IN (SELECT id FROM huddle_messages WHERE huddle_id = huddle_rec.id);
    DELETE FROM message_heat_reactions WHERE message_id IN (SELECT id FROM huddle_messages WHERE huddle_id = huddle_rec.id);
    DELETE FROM boosts WHERE message_id IN (SELECT id FROM huddle_messages WHERE huddle_id = huddle_rec.id);
    DELETE FROM poll_votes WHERE message_id IN (SELECT id FROM huddle_messages WHERE huddle_id = huddle_rec.id);
    DELETE FROM huddle_messages WHERE huddle_id = huddle_rec.id;
    DELETE FROM huddle_members WHERE huddle_id = huddle_rec.id;
    DELETE FROM huddle_join_requests WHERE huddle_id = huddle_rec.id;
    DELETE FROM huddle_subscriptions WHERE huddle_id = huddle_rec.id;
    DELETE FROM huddle_member_subscriptions WHERE huddle_id = huddle_rec.id;
    DELETE FROM huddle_pricing WHERE huddle_id = huddle_rec.id;
    DELETE FROM huddle_chatbot_settings WHERE huddle_id = huddle_rec.id;
    DELETE FROM huddle_pickem_settings WHERE huddle_id = huddle_rec.id;
    DELETE FROM fades WHERE huddle_id = huddle_rec.id;
    DELETE FROM fade_ledgers WHERE huddle_id = huddle_rec.id;
    DELETE FROM fade_season_stats WHERE huddle_id = huddle_rec.id;
    -- Delete pickem data
    DELETE FROM pickem_picks WHERE entry_id IN (SELECT id FROM pickem_entries WHERE instance_id IN (SELECT id FROM pickem_instances WHERE huddle_id = huddle_rec.id));
    DELETE FROM pickem_entries WHERE instance_id IN (SELECT id FROM pickem_instances WHERE huddle_id = huddle_rec.id);
    DELETE FROM pickem_instance_games WHERE instance_id IN (SELECT id FROM pickem_instances WHERE huddle_id = huddle_rec.id);
    DELETE FROM pickem_instances WHERE huddle_id = huddle_rec.id;
  END LOOP;

  -- Nullify references that use SET NULL behavior
  UPDATE notifications SET team_id = NULL WHERE team_id = team_id_input;
  UPDATE huddle_messages SET origin_team_id = NULL WHERE origin_team_id = team_id_input;
  UPDATE posts SET origin_team_id = NULL WHERE origin_team_id = team_id_input;
  
  -- Delete posts referencing this team
  DELETE FROM post_reactions WHERE post_id IN (SELECT id FROM posts WHERE team_id = team_id_input);
  DELETE FROM content_reports WHERE reported_post_id IN (SELECT id FROM posts WHERE team_id = team_id_input);
  DELETE FROM posts WHERE team_id = team_id_input;

  -- Nullify live_events references
  UPDATE live_events SET team1_id = NULL WHERE team1_id = team_id_input;
  UPDATE live_events SET team2_id = NULL WHERE team2_id = team_id_input;
  
  -- Nullify games references
  UPDATE games SET home_team_id = NULL WHERE home_team_id = team_id_input;
  UPDATE games SET away_team_id = NULL WHERE away_team_id = team_id_input;
  
  -- Nullify teams_live_state
  UPDATE teams_live_state SET active_opponent_team_id = NULL WHERE active_opponent_team_id = team_id_input;

  -- Delete huddles (after all their children are gone)
  DELETE FROM huddles WHERE team_id = team_id_input OR parent_team_id = team_id_input;

  -- Delete the team itself (cascading FKs will handle user_follows, social_sources, etc.)
  DELETE FROM teams WHERE id = team_id_input;
END;
$$;
