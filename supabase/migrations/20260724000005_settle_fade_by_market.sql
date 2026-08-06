-- Grade a market-linked fade from the market's own result, not the game score.
--
-- settle_fade() decides the winner from total runs (home+away vs the line). That
-- is right for a game/team total, but a fade taken on a player prop ("over 1.5
-- hits") or a moneyline can't be graded that way — the box-score total says
-- nothing about a single player's hits. Those fades carry a market_id, and the
-- linked kalshi_markets row is already resolved YES/NO by odds-settle from real
-- stats. This settles from that result and reuses the exact payout + ledger +
-- season logic, so the head-to-head "Joe owes Chris" math stays identical.
--
-- YES means the market's "over/this happens" side hit. A fade's poster side is
-- fade_type: poster 'over' wins on YES, poster 'under' wins on NO.

CREATE OR REPLACE FUNCTION public.settle_fade_by_market(p_fade_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE
  f fades%ROWTYPE;
  m kalshi_markets%ROWTYPE;
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
  IF f.market_id IS NULL THEN RETURN jsonb_build_object('skipped', 'no_market'); END IF;

  SELECT * INTO m FROM kalshi_markets WHERE id = f.market_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('skipped', 'market_missing'); END IF;
  IF NOT COALESCE(m.is_resolved, false) OR m.resolution NOT IN ('YES', 'NO') THEN
    RETURN jsonb_build_object('skipped', 'unresolved');
  END IF;

  v_poster_wins := (f.fade_type = 'over'  AND m.resolution = 'YES')
                OR (f.fade_type = 'under' AND m.resolution = 'NO');

  IF v_poster_wins THEN
    v_winner := f.poster_id;   v_loser := f.accepter_id;
  ELSE
    v_winner := f.accepter_id; v_loser := f.poster_id;
  END IF;

  v_pot := f.stake * 2;
  UPDATE user_portfolios
    SET total_chips = total_chips + v_pot, total_wins = total_wins + 1, updated_at = now()
    WHERE user_id = v_winner;
  UPDATE user_portfolios
    SET total_losses = total_losses + 1, updated_at = now()
    WHERE user_id = v_loser;

  UPDATE fades SET status='settled', winner_id=v_winner, settled_at=now()
    WHERE id = p_fade_id;

  -- Head-to-head ledger keyed on the ordered (a<b) pair — identical to settle_fade.
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
    CASE WHEN v_a_wins THEN 1 ELSE -1 END,
    now()
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
$fn$;

REVOKE EXECUTE ON FUNCTION public.settle_fade_by_market(uuid) FROM authenticated, anon;
