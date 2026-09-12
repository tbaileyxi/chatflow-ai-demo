-- The Coach stops answering everything.
--
-- RUN_THIS_COACH_TALKS.sql gave the Coach three ways to hear you, and one of
-- them was wrong:
--
--   (b) "you are alone in the room — there is nobody else it could be for"
--
-- In a room of one, that is EVERY message. Set up a room, type anything, and
-- the Coach replies. Type again, it replies again. It reads as a chatbot you
-- are stuck in a thread with, not as something in the room with you — and a
-- brand-new room is exactly a room of one, so this is what a first-time user
-- meets on their first screen.
--
-- It also bills a model call per line typed.
--
-- What survives is the pair that means you actually addressed it:
--
--   (a) the message says @coach          — cutting in cold
--   (c) the Coach spoke last, recently   — you are answering it
--
-- (c) is what makes it conversational: ask once with @coach and the next few
-- minutes are a back-and-forth with no @ needed. Stop replying and it stops.
--
-- Run in the Supabase SQL editor. Safe to run twice.

create or replace function public.notify_coach_mention()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
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

  -- (b) answering the Coach — only a coach_answer counts, never a live_play.
  -- The bot calls plays constantly during a game, and if any bot message
  -- opened the door then every reaction to a touchdown would be billed as a
  -- question.
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


-- ── check ────────────────────────────────────────────────────────────────────
-- Should print false: the words "alone in the room" are gone from the body.
select
  position('v_members' in pg_get_functiondef(
    'public.notify_coach_mention()'::regprocedure)) > 0 as still_answers_when_alone;
