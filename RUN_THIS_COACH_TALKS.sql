-- Never watch a game alone.
--
-- Two changes, both so the Coach behaves like someone in the room rather than a
-- command you type at.
--
--   1. It speaks first in an empty room.
--   2. You answer it without typing @coach or hunting for a reply button.
--
-- Run in the Supabase SQL editor. Safe to run twice.


-- ── 1. let the Coach open a room ─────────────────────────────────────────────
-- coach_recap_log.kind is checked against a fixed list, and 'opener' is not on
-- it. The insert is a CLAIM taken before posting, so the rejection did not look
-- like an error — four rooms simply came back "nothing to say".
alter table public.coach_recap_log
  drop constraint if exists coach_recap_log_kind_check;

alter table public.coach_recap_log
  add constraint coach_recap_log_kind_check
  check (kind in ('postgame', 'daily', 'halftime', 'opener'));


-- ── 2. talk to it the way you talk to a person ───────────────────────────────
-- Typing @coach every time is the tell that you are addressing software. You
-- are not doing that in any other conversation you have today.
--
-- Three ways a message now reaches the Coach:
--
--   a) it says @coach          — unchanged, and still the way to cut in cold
--   b) you are alone in the room — there is nobody else it could be for
--   c) the Coach spoke last, recently — you are answering it
--
-- (c) is deliberately narrow: only a coach_answer counts, never a live_play. The
-- bot calls plays constantly during a game, and if any bot message opened the
-- door then every reaction to a touchdown would be billed as a question.
create or replace function public.notify_coach_mention()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_members  integer;
  v_last     record;
  v_should   boolean := false;
begin
  -- Never react to the Coach's own messages; that is how a loop starts.
  if coalesce(new.is_bot_message, false) then
    return new;
  end if;

  -- (a) explicit
  if new.content ilike '%@coach%' then
    v_should := true;
  end if;

  -- (b) alone in the room
  if not v_should then
    select count(*) into v_members
    from public.huddle_members where huddle_id = new.huddle_id;
    if coalesce(v_members, 0) <= 1 then
      v_should := true;
    end if;
  end if;

  -- (c) answering the Coach
  if not v_should then
    select m.message_type, m.is_bot_message, m.created_at
      into v_last
    from public.huddle_messages m
    where m.huddle_id = new.huddle_id
      and m.id <> new.id
    order by m.created_at desc
    limit 1;

    if found
       and coalesce(v_last.is_bot_message, false)
       and v_last.message_type = 'coach_answer'
       and v_last.created_at > now() - interval '10 minutes'
    then
      v_should := true;
    end if;
  end if;

  if not v_should then
    return new;
  end if;

  perform net.http_post(
    url := 'https://dejuwyeypiggvlyfliap.supabase.co/functions/v1/coach-ask',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlanV3eWV5cGlnZ3ZseWZsaWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5NjU4MDgsImV4cCI6MjA2OTU0MTgwOH0.XHylH6wJuJjSZxU904oCZ33N0swsoRm6Tr2VjwI1Lz0'
    ),
    body := jsonb_build_object(
      'message_id',  new.id,
      'huddle_id',   new.huddle_id,
      'content',     new.content,
      'user_id',     new.user_id,
      'reply_to_id', new.reply_to_id
    )
  );

  return new;
end;
$$;

drop trigger if exists on_coach_mention on public.huddle_messages;
create trigger on_coach_mention
  after insert on public.huddle_messages
  for each row
  execute function public.notify_coach_mention();


-- ── check ────────────────────────────────────────────────────────────────────
select
  (select count(*) from pg_trigger
    where tgrelid = 'public.huddle_messages'::regclass
      and tgname = 'on_coach_mention')                       as trigger_installed,
  (select pg_get_constraintdef(oid) from pg_constraint
    where conname = 'coach_recap_log_kind_check')            as kind_check;
