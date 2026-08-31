-- A room that fills itself from its owner's X account.
--
-- One column. Reading someone's public posts needs no OAuth, no login and no
-- permission — the handle is the entire "connect your X account" step, which is
-- why there is no settings screen here and nothing for a creator to configure.
--
-- Run in the Supabase SQL editor. Safe to run twice.

alter table public.huddles
  add column if not exists x_handle text;

comment on column public.huddles.x_handle is
  'X account whose original posts mirror into this room, without the @. Set by '
  'us when a creator room is built; the creator never configures anything.';

-- The mirror asks for exactly one thing: rooms that have a handle.
create index if not exists huddles_x_handle_idx
  on public.huddles (x_handle)
  where x_handle is not null;

-- creator_post joins the message types the client already renders. It carries
-- media_url and embed_code like a clip, so no app change is needed to show it.
select
  (select count(*) from information_schema.columns
    where table_name = 'huddles' and column_name = 'x_handle')  as column_added,
  (select count(*) from public.huddles where x_handle is not null) as rooms_wired;
