-- Kill the auto-welcome message that fires on every huddle creation.
-- It pollutes rooms with stale copy ("Welcome to your Side Huddle—...AI-powered…")
-- and the new bot v2 fills rooms with real content as needed.

-- 1. Drop the trigger so future huddles start clean.
drop trigger if exists insert_huddle_welcome_message_trigger on public.huddles;

-- 2. Neutralize the function (no-op) so any code still calling it directly is harmless.
create or replace function public.insert_huddle_welcome_message()
returns trigger
language plpgsql
security definer
as $$
begin
  return new;
end;
$$;

-- 3. Scrub existing welcome rows from prior huddle creations.
--    First null out any replies pointing at them (FK constraint), then delete.
with welcome_ids as (
  select id from public.huddle_messages
  where is_bot_message = true
    and (
         content ilike 'Welcome to your Side Huddle%'
      or content ilike '%Welcome to your Side Huddle—your private, AI-powered%'
      or content ilike '%🏟️ Welcome to your Side Huddle%'
    )
)
update public.huddle_messages
   set reply_to_id = null
 where reply_to_id in (select id from welcome_ids);

delete from public.huddle_messages
where is_bot_message = true
  and (
       content ilike 'Welcome to your Side Huddle%'
    or content ilike '%Welcome to your Side Huddle—your private, AI-powered%'
    or content ilike '%🏟️ Welcome to your Side Huddle%'
  );
