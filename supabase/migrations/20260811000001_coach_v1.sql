-- Coach v1 — the answerable Coach.
--
-- Adds: audit/rate-limit tables, the revived @coach mention trigger (plus a
-- reply-to-Coach path), and cron for the proactive recap and the admin nudge.
--
-- The bot engine's iron rule is unchanged: every fact the Coach speaks is
-- reproducible from a table. What is new is that the facts are now assembled
-- per QUESTION (coach-ask) or per ROOM (coach-recap) instead of per play.

-- ============================================================
-- 1. coach_ask_log — every question answered.
-- Doubles as the rate-limit ledger, same pattern as bot_emit_log.
-- ============================================================
create table if not exists public.coach_ask_log (
  id uuid primary key default gen_random_uuid(),
  huddle_id uuid not null references public.huddles(id) on delete cascade,
  user_id uuid not null,
  question text not null,
  lane text,                                   -- room | ledger | game | mixed | unsupported
  answer_message_id uuid references public.huddle_messages(id) on delete set null,
  created_at timestamptz not null default now()
);

-- The rate-limit reads are (huddle_id, created_at) and (huddle_id, user_id,
-- created_at); both run on every single @coach, so they get real indexes.
create index if not exists idx_coach_ask_huddle_time
  on public.coach_ask_log(huddle_id, created_at desc);
create index if not exists idx_coach_ask_user_time
  on public.coach_ask_log(huddle_id, user_id, created_at desc);

-- ============================================================
-- 2. coach_recap_log — dedupe for the proactive recap.
-- Without this a 30-minute cron re-recaps the same game four times.
-- ============================================================
create table if not exists public.coach_recap_log (
  id uuid primary key default gen_random_uuid(),
  huddle_id uuid not null references public.huddles(id) on delete cascade,
  kind text not null check (kind in ('postgame', 'daily')),
  message_id uuid references public.huddle_messages(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_coach_recap_huddle_kind
  on public.coach_recap_log(huddle_id, kind, created_at desc);

-- ============================================================
-- 3. huddle_admin_nudge_log — dedupe for the "still just you" nudge.
-- ============================================================
create table if not exists public.huddle_admin_nudge_log (
  id uuid primary key default gen_random_uuid(),
  huddle_id uuid not null references public.huddles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (huddle_id)
);

-- ============================================================
-- 4. RLS — these are service-role bookkeeping tables.
-- ============================================================
alter table public.coach_ask_log enable row level security;
alter table public.coach_recap_log enable row level security;
alter table public.huddle_admin_nudge_log enable row level security;
-- (service role bypasses RLS; no client-facing policies needed)

-- ============================================================
-- 5. Revive the @coach mention trigger.
--
-- Retired in 20260607000003 because the v2 launch had no answering half and
-- the edge function it called had been deleted. Both are back.
--
-- Fires on TWO paths:
--   a) the message contains "@coach"
--   b) the message is a reply to one of the Coach's own messages — the
--      Grok-in-X affordance, attached to the post rather than the nav bar
--
-- The is_bot_message guard is load-bearing: without it the Coach's own answer
-- re-triggers the Coach, forever.
-- ============================================================
create or replace function public.notify_coach_mention()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $func$
declare
  is_reply_to_bot boolean := false;
begin
  -- Never react to our own posts. This is what prevents an infinite loop.
  if coalesce(new.is_bot_message, false) then
    return new;
  end if;

  if new.reply_to_id is not null then
    select coalesce(m.is_bot_message, false)
      into is_reply_to_bot
      from public.huddle_messages m
     where m.id = new.reply_to_id;
  end if;

  if new.content ilike '%@coach%' or coalesce(is_reply_to_bot, false) then
    perform net.http_post(
      url := 'https://dejuwyeypiggvlyfliap.supabase.co/functions/v1/coach-ask',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlanV3eWV5cGlnZ3ZseWZsaWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5NjU4MDgsImV4cCI6MjA2OTU0MTgwOH0.XHylH6wJuJjSZxU904oCZ33N0swsoRm6Tr2VjwI1Lz0"}'::jsonb,
      body := jsonb_build_object(
        'message_id',  new.id,
        'huddle_id',   new.huddle_id,
        'user_id',     new.user_id,
        'content',     new.content,
        'reply_to_id', new.reply_to_id
      )
    );
  end if;

  return new;
end;
$func$;

-- Recreate the trigger. Earlier migrations created it under this name and
-- 20260607000003 only neutered the function body, so drop-then-create keeps
-- this idempotent whether or not the trigger survived.
drop trigger if exists on_coach_mention on public.huddle_messages;
create trigger on_coach_mention
  after insert on public.huddle_messages
  for each row
  execute function public.notify_coach_mention();

-- ============================================================
-- 6. Cron — proactive recap every 30 minutes.
-- The function decides internally whether there is anything to recap, so an
-- idle tick costs one HTTP call and two cheap queries.
-- ============================================================
do $$
begin
  perform cron.unschedule('coach-recap');
exception when others then
  null;
end $$;

select cron.schedule(
  'coach-recap',
  '*/30 * * * *',
  $$
  select net.http_post(
    url := 'https://dejuwyeypiggvlyfliap.supabase.co/functions/v1/coach-recap',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlanV3eWV5cGlnZ3ZseWZsaWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5NjU4MDgsImV4cCI6MjA2OTU0MTgwOH0.XHylH6wJuJjSZxU904oCZ33N0swsoRm6Tr2VjwI1Lz0"}'::jsonb,
    body := '{}'::jsonb
  ) as request_id;
  $$
);

-- ============================================================
-- 7. Cron — admin nudge, once an hour.
-- Targets rooms that are still one person 48h after creation. Not spam: it is
-- addressed to the one person who asked for the room, and it fires once ever.
-- ============================================================
do $$
begin
  perform cron.unschedule('huddle-admin-nudge');
exception when others then
  null;
end $$;

select cron.schedule(
  'huddle-admin-nudge',
  '17 * * * *',
  $$
  select net.http_post(
    url := 'https://dejuwyeypiggvlyfliap.supabase.co/functions/v1/huddle-admin-nudge',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlanV3eWV5cGlnZ3ZseWZsaWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5NjU4MDgsImV4cCI6MjA2OTU0MTgwOH0.XHylH6wJuJjSZxU904oCZ33N0swsoRm6Tr2VjwI1Lz0"}'::jsonb,
    body := '{}'::jsonb
  ) as request_id;
  $$
);
