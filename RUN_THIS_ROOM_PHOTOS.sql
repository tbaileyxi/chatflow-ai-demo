-- Room photos: a picture behind the chat, the way Snapchat and WhatsApp do it.
--
-- Why it matters beyond decoration: every Browns room in the country currently
-- renders the same team logo, so nothing in the app belongs to the person who
-- runs it. The photo is what makes a room theirs — and it becomes the face of
-- the share card the room produces for each game.
--
-- Run this in the Supabase SQL editor. `supabase db push` cannot apply it: the
-- CLI's login-role handshake is refused by this project ("permission denied to
-- alter role cli_login_postgres"), so migrations have to go through the
-- dashboard until that is fixed.
--
-- Safe to run twice. Every statement is guarded.

-- ── 1. where the URL lives ───────────────────────────────────────────────────
alter table public.huddles
  add column if not exists photo_url text;

comment on column public.huddles.photo_url is
  'Full-bleed background behind the chat. Set by the room owner or an admin; '
  'null falls back to the plain theme background.';


-- ── 2. the bucket ────────────────────────────────────────────────────────────
-- Public read, same as `avatars`: these are shown to anyone who can see the
-- room, and room membership is not a secret worth signing URLs over.
insert into storage.buckets (id, name, public)
values ('room-photos', 'room-photos', true)
on conflict (id) do nothing;


-- ── 3. who may write ─────────────────────────────────────────────────────────
-- Files live at <huddle_id>/<filename>, so the first path segment IS the room,
-- and the check is "do you run this room" rather than "is this your folder"
-- (which is all the avatars bucket can ask). Owner or named admin, nobody else
-- — otherwise any member could redecorate someone else's room.
create or replace function public.can_set_room_photo(p_path text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.huddles h
    where h.id::text = (storage.foldername(p_path))[1]
      and (
        h.owner_id = auth.uid()
        or exists (
          select 1 from public.huddle_admins a
          where a.huddle_id = h.id and a.user_id = auth.uid()
        )
      )
  );
$$;

grant execute on function public.can_set_room_photo(text) to authenticated;


-- ── 4. policies ──────────────────────────────────────────────────────────────
drop policy if exists "Room photos are publicly readable" on storage.objects;
create policy "Room photos are publicly readable"
on storage.objects
for select
using (bucket_id = 'room-photos');

drop policy if exists "Room runners can upload a room photo" on storage.objects;
create policy "Room runners can upload a room photo"
on storage.objects
for insert
with check (
  bucket_id = 'room-photos'
  and auth.uid() is not null
  and public.can_set_room_photo(name)
);

drop policy if exists "Room runners can replace a room photo" on storage.objects;
create policy "Room runners can replace a room photo"
on storage.objects
for update
using (
  bucket_id = 'room-photos'
  and auth.uid() is not null
  and public.can_set_room_photo(name)
);

drop policy if exists "Room runners can delete a room photo" on storage.objects;
create policy "Room runners can delete a room photo"
on storage.objects
for delete
using (
  bucket_id = 'room-photos'
  and auth.uid() is not null
  and public.can_set_room_photo(name)
);


-- ── 5. check it worked ───────────────────────────────────────────────────────
-- Expect: one row, photo_url present, bucket present, 4 policies.
select
  (select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'huddles'
       and column_name = 'photo_url')                       as photo_url_column,
  (select count(*) from storage.buckets where id = 'room-photos') as bucket,
  (select count(*) from pg_policies
     where schemaname = 'storage' and tablename = 'objects'
       and policyname like 'Room photos%' or policyname like 'Room runners%') as policies;
