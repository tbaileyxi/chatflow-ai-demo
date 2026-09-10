-- Everything user-generated video needs before Apple will pass it, plus the
-- limits that stop storage growing forever.
--
-- App Store guideline 1.2 asks for four things on any app carrying UGC:
--   a way to report content, a way to block a user, a way for content to be
--   removed, and a stated commitment to act. Three of them are tables; the
--   fourth is copy. None of it existed — content_reports is keyed to `posts`,
--   which the mobile app doesn't use, and huddle_bans only removes someone
--   from ONE room, which is moderation for a room owner, not for a victim.
--
-- Run in the Supabase SQL editor. Safe to run twice.

-- ============================================================
-- 1. Reporting a message
-- ============================================================
create table if not exists public.message_reports (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.huddle_messages(id) on delete cascade,
  huddle_id uuid references public.huddles(id) on delete set null,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reported_user_id uuid,
  reason text not null,
  details text,
  status text not null default 'pending' check (status in ('pending','actioned','dismissed')),
  created_at timestamptz not null default now(),
  reviewed_by uuid,
  reviewed_at timestamptz
);

-- Reporting the same thing twice is one report, not two.
create unique index if not exists message_reports_once
  on public.message_reports(message_id, reporter_id);
create index if not exists idx_message_reports_pending
  on public.message_reports(status, created_at desc) where status = 'pending';

alter table public.message_reports enable row level security;

drop policy if exists "Anyone can report" on public.message_reports;
create policy "Anyone can report"
on public.message_reports for insert
with check (reporter_id = auth.uid());

drop policy if exists "See your own reports" on public.message_reports;
create policy "See your own reports"
on public.message_reports for select
using (reporter_id = auth.uid());

-- ============================================================
-- 2. Blocking a person, everywhere
-- ============================================================
-- huddle_bans removes somebody from one room. That is a room owner's tool.
-- A person who has been harassed needs the other one: never see them again,
-- in any room, without needing to own anything.
create table if not exists public.user_blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint no_self_block check (blocker_id <> blocked_id)
);

create unique index if not exists user_blocks_once
  on public.user_blocks(blocker_id, blocked_id);
create index if not exists idx_user_blocks_blocker
  on public.user_blocks(blocker_id);

alter table public.user_blocks enable row level security;

drop policy if exists "Manage your own blocks" on public.user_blocks;
create policy "Manage your own blocks"
on public.user_blocks for all
using (blocker_id = auth.uid())
with check (blocker_id = auth.uid());

-- Hide blocked people's messages at the database, not in the client. A client
-- filter is a suggestion; this is the answer.
drop policy if exists "Blocked users are invisible" on public.huddle_messages;
create policy "Blocked users are invisible"
on public.huddle_messages for select
using (
  not exists (
    select 1 from public.user_blocks b
    where b.blocker_id = auth.uid() and b.blocked_id = huddle_messages.user_id
  )
);

-- ============================================================
-- 3. Removing content
-- ============================================================
-- You can always delete your own message. Room owners and admins can delete
-- anything in their room. Both were missing: nothing could be removed at all.
drop policy if exists "Delete your own messages" on public.huddle_messages;
create policy "Delete your own messages"
on public.huddle_messages for delete
using (user_id = auth.uid());

drop policy if exists "Owners can remove anything in their room" on public.huddle_messages;
create policy "Owners can remove anything in their room"
on public.huddle_messages for delete
using (
  exists (
    select 1 from public.huddles h
    where h.id = huddle_messages.huddle_id and h.owner_id = auth.uid()
  )
  or exists (
    select 1 from public.huddle_admins a
    where a.huddle_id = huddle_messages.huddle_id and a.user_id = auth.uid()
  )
);

-- ============================================================
-- 4. Rate limit: the only genuinely unbounded cost
-- ============================================================
-- Expected usage costs almost nothing. A script uploading in a loop is what
-- turns thirty dollars into three thousand, so the ceiling is enforced here
-- rather than trusted to the client.
create or replace function public.check_reaction_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recent int;
begin
  if new.media_type is distinct from 'video' then
    return new;
  end if;

  select count(*) into recent
  from public.huddle_messages
  where user_id = new.user_id
    and media_type = 'video'
    and created_at > now() - interval '1 hour';

  -- Twenty an hour is far above any real use of this and far below anything
  -- that costs money.
  if recent >= 20 then
    raise exception 'rate_limit: too many video reactions in the last hour';
  end if;

  return new;
end;
$$;

drop trigger if exists reaction_rate_limit on public.huddle_messages;
create trigger reaction_rate_limit
  before insert on public.huddle_messages
  for each row execute function public.check_reaction_rate_limit();

-- ============================================================
-- 5. Retention: storage that stops growing
-- ============================================================
-- Without this, video accumulates forever — around 2.3 TB a year at heavy
-- use, for clips nobody has opened since September. Ninety days makes the
-- bill plateau instead of climbing, and a reaction to a game three months ago
-- is not something anybody goes looking for.
create or replace function public.prune_old_reaction_media()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from storage.objects
  where bucket_id = 'huddle-media'
    and created_at < now() - interval '90 days'
    and (metadata->>'mimetype') like 'video/%';

  update public.huddle_messages
     set media_url = null,
         content = case
           when coalesce(content, '') = '' then 'Reaction expired'
           else content
         end
   where media_type = 'video'
     and media_url is not null
     and created_at < now() - interval '90 days';
end;
$$;

select cron.unschedule(jobid) from cron.job where jobname = 'prune-reaction-media';
select cron.schedule(
  'prune-reaction-media',
  '20 4 * * *',
  $$ select public.prune_old_reaction_media(); $$
);

-- ============================================================
-- 6. Check
-- ============================================================
select
  (select count(*) from information_schema.tables
    where table_schema='public' and table_name='message_reports')  as message_reports,
  (select count(*) from information_schema.tables
    where table_schema='public' and table_name='user_blocks')      as user_blocks,
  (select count(*) from pg_policies
    where schemaname='public' and tablename='huddle_messages')     as message_policies,
  (select count(*) from cron.job where jobname='prune-reaction-media') as prune_job;
