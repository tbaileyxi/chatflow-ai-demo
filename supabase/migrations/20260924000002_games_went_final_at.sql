-- WHEN a game ended, not just THAT it ended.
--
-- games carries status and start_time and nothing in between, so "fifteen
-- minutes after full time" had nothing to measure from: the poller overwrites
-- status to 'final' and moves on, and last_synced_at ticks on every pass
-- whether anything changed or not. Asking the row later only ever answers
-- "yes, it is over" — never "it has been over for twenty minutes".
--
-- A TRIGGER RATHER THAN THE POLLER. sync-games-live is the writer today, but
-- it is not the only thing that could set a status, and a stamp that lives in
-- one function is a stamp the next writer forgets. This fires on the
-- transition itself, whoever causes it.
--
-- Clearing it when a game leaves the final states is deliberate. A row that
-- gets flipped final early — a feed hiccup, a mis-parsed status — would
-- otherwise keep a stamp from the wrong moment for the rest of the game, and
-- the story would open mid-second-half off a timestamp nobody can see.
--
-- Existing finals stay null, and nothing backfills them: consumers treat a
-- missing stamp as "no delay available" and fall back to showing on status
-- alone, which is what they do today.

alter table public.games
  add column if not exists went_final_at timestamptz;

create or replace function public.stamp_game_went_final()
returns trigger
language plpgsql
as $$
declare
  over_now  boolean := lower(coalesce(new.status, '')) in ('final', 'completed', 'closed');
  over_before boolean := tg_op = 'UPDATE'
    and lower(coalesce(old.status, '')) in ('final', 'completed', 'closed');
begin
  if over_now then
    -- First time anyone called it over. An existing stamp is left alone so a
    -- later no-op write cannot move the clock forward.
    if new.went_final_at is null and not over_before then
      new.went_final_at := now();
    end if;
  else
    new.went_final_at := null;
  end if;
  return new;
end $$;

drop trigger if exists stamp_game_went_final on public.games;
create trigger stamp_game_went_final
  before insert or update on public.games
  for each row execute function public.stamp_game_went_final();
