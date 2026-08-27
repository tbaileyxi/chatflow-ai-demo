-- Let the recap log record a halftime recap.
--
-- coach_recap_log is defined with  check (kind in ('postgame','daily')),
-- so a halftime row is rejected. The recap claims its slot in that table
-- BEFORE posting, so without this the halftime recap simply never posts —
-- it fails safe rather than duplicating. Nothing is broken today; it is
-- just inert until this runs.
--
-- Same shape of trap as bot_emit_log's check (mode in ('in_game','news')),
-- which silently swallowed every x_media row and disabled that daily cap.

alter table public.coach_recap_log
  drop constraint if exists coach_recap_log_kind_check;

alter table public.coach_recap_log
  add constraint coach_recap_log_kind_check
  check (kind in ('postgame', 'daily', 'halftime'));

-- Confirm:
select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.coach_recap_log'::regclass
  and conname = 'coach_recap_log_kind_check';
