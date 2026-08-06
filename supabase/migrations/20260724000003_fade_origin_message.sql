-- Let the bot drop an *unclaimed* prop card into a room that a player then
-- claims in place — the original gameday flow: props pop up in chat, Joe takes
-- a side, Chris fades him.
--
-- A bot card posts with a real market + game but no poster. The first tap calls
-- post_fade with p_origin_message_id set to that card's message, which links the
-- new fade back to the card so it flips to "Joe on Over — take Under" in place
-- (no second message). User-initiated fades from the Fade button pass NULL and
-- post their own card, exactly as before.

ALTER TABLE public.fades
  ADD COLUMN IF NOT EXISTS origin_message_id uuid
    REFERENCES public.huddle_messages(id) ON DELETE SET NULL;

-- One claim per card: two people can't both "post" the same bot prop. The
-- second tapper takes the other side via accept_fade instead.
CREATE UNIQUE INDEX IF NOT EXISTS fades_origin_message_uniq
  ON public.fades (origin_message_id)
  WHERE origin_message_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.post_fade(
  p_huddle_id uuid,
  p_game_id text,
  p_game_commence_time timestamptz,
  p_home_team text,
  p_away_team text,
  p_sport text,
  p_fade_type text,          -- 'over' | 'under' (poster's side)
  p_line_value numeric,
  p_line_description text,
  p_stake integer,           -- 50 | 100 | 200
  p_total_target text,       -- 'game' | 'home' | 'away'
  p_market_id uuid DEFAULT NULL,
  p_origin_message_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_user uuid;
  v_chips integer;
  v_min integer;
  v_fade_id uuid;
BEGIN
  v_user := auth.uid();
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_fade_type NOT IN ('over','under') THEN RAISE EXCEPTION 'Fade type must be over or under'; END IF;
  IF p_total_target NOT IN ('game','home','away') THEN RAISE EXCEPTION 'Invalid prop target'; END IF;
  IF p_stake NOT IN (50,100,200) THEN RAISE EXCEPTION 'Stake must be 50, 100, or 200'; END IF;
  IF NOT is_huddle_member(p_huddle_id, v_user) THEN RAISE EXCEPTION 'Not a member of this huddle'; END IF;
  IF p_game_commence_time <= now() THEN RAISE EXCEPTION 'This game has already started'; END IF;

  IF NOT EXISTS (SELECT 1 FROM games WHERE id::text = p_game_id) THEN
    RAISE EXCEPTION 'This game can''t be faded yet — try again once it''s on the board.';
  END IF;

  IF p_market_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM kalshi_markets WHERE id = p_market_id AND COALESCE(is_resolved,false) = false
  ) THEN
    RAISE EXCEPTION 'That line just closed — pick another prop.';
  END IF;

  -- If this card was already claimed (raced by another tapper), say so cleanly
  -- rather than surfacing a raw unique-violation.
  IF p_origin_message_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM fades WHERE origin_message_id = p_origin_message_id
  ) THEN
    RAISE EXCEPTION 'Someone already claimed this prop — take the other side.';
  END IF;

  INSERT INTO user_portfolios (user_id, total_chips) VALUES (v_user, 1000)
    ON CONFLICT (user_id) DO NOTHING;
  SELECT total_chips, COALESCE(minimum_chips,0)
    INTO v_chips, v_min FROM user_portfolios WHERE user_id = v_user FOR UPDATE;

  IF v_chips - p_stake < v_min THEN
    IF v_chips < p_stake THEN
      RAISE EXCEPTION 'OUT_OF_CHIPS:Not enough chips (you have %, need %). Upgrade to Premium to keep playing!', v_chips, p_stake;
    ELSE
      RAISE EXCEPTION 'Not enough chips above your safety floor';
    END IF;
  END IF;

  UPDATE user_portfolios SET total_chips = total_chips - p_stake, updated_at = now()
    WHERE user_id = v_user;

  INSERT INTO fades (
    huddle_id, poster_id, game_id, game_commence_time, home_team, away_team,
    sport, fade_type, line_value, line_description, stake, status, total_target,
    market_id, origin_message_id
  ) VALUES (
    p_huddle_id, v_user, p_game_id, p_game_commence_time, p_home_team, p_away_team,
    p_sport, p_fade_type, p_line_value, p_line_description, p_stake, 'open', p_total_target,
    p_market_id, p_origin_message_id
  ) RETURNING id INTO v_fade_id;

  RETURN jsonb_build_object('fade_id', v_fade_id, 'status', 'open', 'stake', p_stake);
END;
$$;

GRANT EXECUTE ON FUNCTION public.post_fade(
  uuid,text,timestamptz,text,text,text,text,numeric,text,integer,text,uuid,uuid
) TO authenticated;
