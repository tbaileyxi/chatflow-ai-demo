-- Come back for the clip.
--
-- When a big play happens the bot searches X for video of it within about two
-- minutes. Nobody has posted one yet — cutting and uploading a highlight takes
-- five to fifteen minutes — so the search comes back empty, the play is already
-- marked as claimed, and we never look again. That is why UNC vs TCU produced
-- three attempts and zero clips while a botched-snap safety was sitting right
-- there.
--
-- This table is the memory between the play and the clip: the play is recorded
-- now, and the search happens later, more than once.
--
-- Run in the Supabase SQL editor. Safe to run twice.

create table if not exists public.pending_clips (
  id                uuid primary key default gen_random_uuid(),
  game_provider_id  text        not null,
  play_key          text        not null,
  team_id           uuid        not null references public.teams(id) on delete cascade,
  team_name         text        not null,
  opponent          text,
  scorer            text,
  play_text         text,
  -- The rooms that got the original message. The clip must land in the same
  -- ones — a room that never saw the play should not suddenly get its video.
  huddle_ids        uuid[]      not null default '{}',
  search_after      timestamptz not null,
  attempts          integer     not null default 0,
  status            text        not null default 'pending',
  created_at        timestamptz not null default now(),

  constraint pending_clips_status_check
    check (status in ('pending', 'done', 'gave_up')),
  -- One pending clip per play per team. The poller runs on a schedule and can
  -- overlap itself; without this an overlapping run queues the same touchdown
  -- twice and we pay for the same search twice.
  constraint pending_clips_unique_play
    unique (game_provider_id, play_key, team_id)
);

-- The only query that runs against this: what is due right now.
create index if not exists pending_clips_due_idx
  on public.pending_clips (search_after)
  where status = 'pending';

comment on table public.pending_clips is
  'Big plays waiting for X to catch up. The bot posts the play immediately and '
  'looks for video of it a few minutes later, retrying a couple of times, '
  'because the clip does not exist yet at the moment the play happens.';


-- ── Locked down ──────────────────────────────────────────────────────────────
-- Nothing in the app reads or writes this; only the poller does, and it uses
-- the service role, which bypasses RLS. So: RLS on, no policies. That is a
-- deliberate deny-all, not an oversight.
alter table public.pending_clips enable row level security;

revoke all on public.pending_clips from anon, authenticated;


-- ── Check ────────────────────────────────────────────────────────────────────
select
  count(*) filter (where status = 'pending')  as waiting,
  count(*) filter (where status = 'done')     as clipped,
  count(*) filter (where status = 'gave_up')  as gave_up
from public.pending_clips;
