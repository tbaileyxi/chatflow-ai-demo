-- Answer @coach immediately instead of up to 60 seconds later.
--
-- WHY IT HAS NEVER WORKED. The existing notify_coach_mention() fails four
-- separate ways, any one of which is fatal and none of which raises an error:
--
--   1. url  := current_setting('app.supabase_url', true) || '/functions/...'
--      That setting is not set, so it returns NULL, and NULL || anything is
--      NULL. The POST goes nowhere.
--   2. Authorization uses current_setting('app.service_role_key', true),
--      also unset, so the header reads "Bearer " with nothing after it.
--   3. It calls /functions/v1/team-chatbot — a different, older function.
--      coach-ask is what answers questions now.
--   4. It only fires when huddle_chatbot_settings.is_enabled IS TRUE. No row
--      for a huddle means no answer, silently.
--
-- Rewritten with a literal URL and the PUBLISHABLE key — the same key the app
-- ships with, which is what the cron already uses successfully. Nothing secret
-- ends up stored in a trigger definition.
--
-- The every-minute cron scan stays as a safety net. This just means the common
-- case is instant.

create or replace function public.notify_coach_mention()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Never react to the Coach's own messages; that is how a loop starts.
  if coalesce(new.is_bot_message, false) then
    return new;
  end if;

  if new.content ilike '%@coach%' then
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
  end if;

  return new;
end;
$$;

-- Recreate the trigger so it definitely points at the new function body.
drop trigger if exists on_coach_mention on public.huddle_messages;
create trigger on_coach_mention
  after insert on public.huddle_messages
  for each row
  execute function public.notify_coach_mention();

-- Confirm it exists:
select tgname, tgenabled from pg_trigger
where tgrelid = 'public.huddle_messages'::regclass and tgname = 'on_coach_mention';
