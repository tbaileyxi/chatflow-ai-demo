-- Give fades a `total_target` so we can offer 3–4 props per game (game total
-- plus each team's total) instead of only the game total. All remain over/under
-- graded from the final score, so settlement stays simple.

ALTER TABLE public.fades
  ADD COLUMN IF NOT EXISTS total_target text NOT NULL DEFAULT 'game'
  CHECK (total_target IN ('game','home','away'));

-- post_fade gains p_total_target. Drop old signature, recreate.
DROP FUNCTION IF EXISTS public.post_fade(uuid,text,timestamptz,text,text,text,text,numeric,text,integer);

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
  p_total_target text        -- 'game' | 'home' | 'away'
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
    sport, fade_type, line_value, line_description, stake, status, total_target
  ) VALUES (
    p_huddle_id, v_user, p_game_id, p_game_commence_time, p_home_team, p_away_team,
    p_sport, p_fade_type, p_line_value, p_line_description, p_stake, 'open', p_total_target
  ) RETURNING id INTO v_fade_id;

  RETURN jsonb_build_object('fade_id', v_fade_id, 'status', 'open', 'stake', p_stake);
END;
$$;

GRANT EXECUTE ON FUNCTION public.post_fade(uuid,text,timestamptz,text,text,text,text,numeric,text,integer,text) TO authenticated;

-- settle_fade: pick the graded total from total_target.
CREATE OR REPLACE FUNCTION public.settle_fade(
  p_fade_id uuid,
  p_home_score integer,
  p_away_score integer
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  f fades%ROWTYPE;
  v_total integer;
  v_poster_wins boolean;
  v_winner uuid;
  v_loser uuid;
  v_pot integer;
  v_a uuid;
  v_b uuid;
  v_a_wins boolean;
  v_delta integer;
BEGIN
  SELECT * INTO f FROM fades WHERE id = p_fade_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Fade not found'; END IF;
  IF f.status <> 'locked' THEN RETURN jsonb_build_object('skipped', f.status); END IF;

  v_total := CASE f.total_target
    WHEN 'home' THEN p_home_score
    WHEN 'away' THEN p_away_score
    ELSE p_home_score + p_away_score
  END;

  IF v_total = f.line_value THEN
    UPDATE user_portfolios SET total_chips = total_chips + f.stake WHERE user_id = f.poster_id;
    UPDATE user_portfolios SET total_chips = total_chips + f.stake WHERE user_id = f.accepter_id;
    UPDATE fades SET status='settled', winner_id=NULL,
      final_score_home=p_home_score, final_score_away=p_away_score, settled_at=now()
      WHERE id = p_fade_id;
    RETURN jsonb_build_object('result','push');
  END IF;

  v_poster_wins := (f.fade_type = 'over'  AND v_total > f.line_value)
                OR (f.fade_type = 'under' AND v_total < f.line_value);

  IF v_poster_wins THEN v_winner := f.poster_id; v_loser := f.accepter_id;
  ELSE v_winner := f.accepter_id; v_loser := f.poster_id; END IF;

  v_pot := f.stake * 2;
  UPDATE user_portfolios SET total_chips = total_chips + v_pot, total_wins = total_wins + 1, updated_at = now()
    WHERE user_id = v_winner;
  UPDATE user_portfolios SET total_losses = total_losses + 1, updated_at = now()
    WHERE user_id = v_loser;

  UPDATE fades SET status='settled', winner_id=v_winner,
    final_score_home=p_home_score, final_score_away=p_away_score, settled_at=now()
    WHERE id = p_fade_id;

  v_a := LEAST(f.poster_id, f.accepter_id);
  v_b := GREATEST(f.poster_id, f.accepter_id);
  v_a_wins := (v_winner = v_a);
  v_delta  := CASE WHEN v_a_wins THEN f.stake ELSE -f.stake END;

  INSERT INTO fade_ledgers (
    huddle_id, user_a_id, user_b_id, net_points, total_fades,
    user_a_wins, user_b_wins, current_streak_a, last_fade_at
  ) VALUES (
    f.huddle_id, v_a, v_b, v_delta, 1,
    CASE WHEN v_a_wins THEN 1 ELSE 0 END,
    CASE WHEN v_a_wins THEN 0 ELSE 1 END,
    CASE WHEN v_a_wins THEN 1 ELSE -1 END, now()
  )
  ON CONFLICT (huddle_id, user_a_id, user_b_id) DO UPDATE SET
    net_points  = fade_ledgers.net_points + v_delta,
    total_fades = fade_ledgers.total_fades + 1,
    user_a_wins = fade_ledgers.user_a_wins + (CASE WHEN v_a_wins THEN 1 ELSE 0 END),
    user_b_wins = fade_ledgers.user_b_wins + (CASE WHEN v_a_wins THEN 0 ELSE 1 END),
    current_streak_a = CASE
      WHEN v_a_wins AND fade_ledgers.current_streak_a >= 0 THEN fade_ledgers.current_streak_a + 1
      WHEN v_a_wins THEN 1
      WHEN fade_ledgers.current_streak_a <= 0 THEN fade_ledgers.current_streak_a - 1
      ELSE -1
    END,
    last_fade_at = now();

  PERFORM upsert_fade_season(f.huddle_id, v_winner,  f.stake, true);
  PERFORM upsert_fade_season(f.huddle_id, v_loser,  -f.stake, false);

  RETURN jsonb_build_object('result','settled','winner',v_winner,'pot',v_pot);
END;
$$;
