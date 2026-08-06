-- Arena v2 — generic events. The arena decouples from the MLB games table:
-- an arena_event is ANY two-sided battle (World Cup match, total-goals prop,
-- later politics/culture), synced by the arena-sync-events function.
-- MLB keeps flowing through the existing games path; both coexist.

CREATE TABLE IF NOT EXISTS public.arena_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  category text NOT NULL DEFAULT 'worldcup',
  title text NOT NULL,
  side_a_label text NOT NULL,
  side_b_label text NOT NULL,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'final')),
  winner text CHECK (winner IN ('a', 'b', 'tie')),
  prob_a numeric CHECK (prob_a > 0 AND prob_a < 1),
  score_a integer NOT NULL DEFAULT 0,
  score_b integer NOT NULL DEFAULT 0,
  period_label text,
  starts_at timestamptz NOT NULL,
  source jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS arena_events_window_idx ON public.arena_events (starts_at, status);

ALTER TABLE public.arena_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "arena events are public" ON public.arena_events;
CREATE POLICY "arena events are public"
  ON public.arena_events FOR SELECT USING (true);
-- no write policies: only the sync function (service role) writes.

-- Stakes can now target a game OR an event (exactly one).
ALTER TABLE public.arena_stakes ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES public.arena_events(id) ON DELETE CASCADE;
ALTER TABLE public.arena_stakes ALTER COLUMN game_id DROP NOT NULL;
DO $$ BEGIN
  ALTER TABLE public.arena_stakes ADD CONSTRAINT arena_stakes_one_target
    CHECK ((game_id IS NULL) <> (event_id IS NULL));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS arena_stakes_event_idx ON public.arena_stakes (event_id) WHERE event_id IS NOT NULL;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.arena_events;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- arena_place_stake_v2 — one entry point for both games and events.
-- side stays 'away'/'home': away = side A (left), home = side B (right).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.arena_place_stake_v2(
  p_client uuid, p_side text, p_amount integer,
  p_game uuid DEFAULT NULL, p_event uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_bankroll integer;
  v_status text;
BEGIN
  IF p_side NOT IN ('home', 'away') OR p_amount < 1 OR p_amount > 500 THEN
    RAISE EXCEPTION 'invalid stake';
  END IF;
  IF (p_game IS NULL) = (p_event IS NULL) THEN
    RAISE EXCEPTION 'stake exactly one target';
  END IF;

  IF p_game IS NOT NULL THEN
    SELECT status INTO v_status FROM games WHERE id = p_game;
    IF v_status IS NULL OR v_status IN ('final', 'completed') THEN
      RAISE EXCEPTION 'game not open';
    END IF;
  ELSE
    SELECT status INTO v_status FROM arena_events WHERE id = p_event;
    IF v_status IS NULL OR v_status = 'final' THEN
      RAISE EXCEPTION 'event not open';
    END IF;
  END IF;

  SELECT bankroll INTO v_bankroll FROM arena_players
  WHERE client_id = p_client FOR UPDATE;
  IF v_bankroll IS NULL THEN
    RAISE EXCEPTION 'no player — claim daily chips first';
  END IF;
  IF v_bankroll < p_amount THEN
    RAISE EXCEPTION 'insufficient bankroll';
  END IF;

  UPDATE arena_players SET bankroll = bankroll - p_amount, updated_at = now()
  WHERE client_id = p_client;
  INSERT INTO arena_stakes (game_id, event_id, client_id, side, amount)
  VALUES (p_game, p_event, p_client, p_side, p_amount);

  RETURN jsonb_build_object('bankroll', v_bankroll - p_amount);
END;
$$;

-- ---------------------------------------------------------------------------
-- arena_settle_event — pay the pot from arena_events.winner.
-- winner 'a' pays 'away' stakes, 'b' pays 'home', 'tie' refunds everyone.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.arena_settle_event(p_event uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_ev arena_events;
  v_side text;
  v_pot bigint;
  v_winner_total bigint;
  v_paid integer := 0;
BEGIN
  SELECT * INTO v_ev FROM arena_events WHERE id = p_event;
  IF v_ev.id IS NULL OR v_ev.status <> 'final' OR v_ev.winner IS NULL THEN
    RETURN jsonb_build_object('settled', false, 'reason', 'not final/graded');
  END IF;

  SELECT coalesce(sum(amount), 0) INTO v_pot
  FROM arena_stakes WHERE event_id = p_event AND NOT settled;
  IF v_pot = 0 THEN
    RETURN jsonb_build_object('settled', true, 'paid_players', 0);
  END IF;

  IF v_ev.winner = 'tie' THEN
    WITH refunds AS (
      SELECT client_id, sum(amount) AS amt
      FROM arena_stakes WHERE event_id = p_event AND NOT settled
      GROUP BY client_id
    )
    UPDATE arena_players p SET bankroll = p.bankroll + r.amt, updated_at = now()
    FROM refunds r WHERE p.client_id = r.client_id;
    GET DIAGNOSTICS v_paid = ROW_COUNT;
  ELSE
    v_side := CASE WHEN v_ev.winner = 'a' THEN 'away' ELSE 'home' END;
    SELECT coalesce(sum(amount), 0) INTO v_winner_total
    FROM arena_stakes WHERE event_id = p_event AND NOT settled AND side = v_side;
    IF v_winner_total > 0 THEN
      WITH winners AS (
        SELECT client_id, sum(amount) AS amt
        FROM arena_stakes
        WHERE event_id = p_event AND NOT settled AND side = v_side
        GROUP BY client_id
      )
      UPDATE arena_players p
      SET bankroll = p.bankroll + floor(w.amt::numeric * v_pot / v_winner_total)::integer,
          updated_at = now()
      FROM winners w WHERE p.client_id = w.client_id;
      GET DIAGNOSTICS v_paid = ROW_COUNT;
    END IF;
  END IF;

  UPDATE arena_stakes SET settled = true WHERE event_id = p_event AND NOT settled;
  RETURN jsonb_build_object('settled', true, 'paid_players', v_paid, 'pot', v_pot);
END;
$$;

GRANT EXECUTE ON FUNCTION public.arena_place_stake_v2(uuid, text, integer, uuid, uuid) TO anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.arena_settle_event(uuid) FROM anon, authenticated, public;

-- Sync World Cup (and future) events every 2 minutes, offset from the MLB job.
DO $$ BEGIN
  PERFORM cron.unschedule('arena-sync-events-every-2min');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'arena-sync-events-every-2min',
  '1-59/2 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://dejuwyeypiggvlyfliap.supabase.co/functions/v1/arena-sync-events',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
