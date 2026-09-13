-- Two people flag it, it goes.
--
-- A Report button that files a row nobody reads is a button that lies, and we
-- are about to put one in front of strangers in public huddles. This is the
-- smallest thing that is actually true:
--
--   1. two DISTINCT reporters hide a message automatically
--   2. the huddle's owner is told, and can delete it for good
--   3. everything lands in message_reports, queryable whenever it is worth a
--      dashboard
--
-- No queue to read, no judgement call, no email plumbing. Two strangers
-- flagging the same thing is enough signal for a room.

alter table public.huddle_messages
  add column if not exists hidden_at timestamptz,
  add column if not exists hidden_reason text;

create index if not exists huddle_messages_hidden_idx
  on public.huddle_messages (huddle_id) where hidden_at is null;

create or replace function public.autohide_reported_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
  v_owner uuid;
  v_huddle uuid;
begin
  select count(distinct reporter_id) into v_count
    from public.message_reports where message_id = new.message_id;

  if v_count < 2 then return new; end if;

  update public.huddle_messages
     set hidden_at = coalesce(hidden_at, now()),
         hidden_reason = 'reported'
   where id = new.message_id and hidden_at is null
  returning huddle_id into v_huddle;

  if v_huddle is null then return new; end if;   -- already hidden

  select owner_id into v_owner from public.huddles where id = v_huddle;

  -- The owner is already in the room and already cares about it. That is the
  -- moderation staff; anything else is a queue nobody opens.
  if v_owner is not null then
    insert into public.notifications (user_id, type, title, body, huddle_id)
    values (v_owner, 'moderation', 'A message was hidden',
            'Two people reported it. Open the huddle to delete it for good.', v_huddle);
  end if;

  return new;
end;
$$;

drop trigger if exists on_message_reported on public.message_reports;
create trigger on_message_reported
  after insert on public.message_reports
  for each row execute function public.autohide_reported_message();

-- Hidden means hidden, for everyone but the person who wrote it.
--
-- AS RESTRICTIVE, which is the whole point. Permissive policies are OR'd, so
-- an ordinary `create policy ... for select` here would GRANT read on every
-- unhidden message in every huddle in the app — the exact opposite of hiding
-- something. Restrictive policies AND with the rest, which is how you take
-- access away.
--
-- Same family as the recursion last week: a policy on this table that reads
-- like a filter and behaves like a grant.
drop policy if exists "hidden messages are not readable" on public.huddle_messages;
create policy "hidden messages are not readable"
  on public.huddle_messages as restrictive for select
  using (hidden_at is null or user_id = (select auth.uid()));
