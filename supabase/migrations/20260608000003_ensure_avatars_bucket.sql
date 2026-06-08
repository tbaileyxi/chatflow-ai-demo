-- The 20260604000001 migration registered as applied but the bucket is missing
-- in prod (possibly deleted via dashboard). Re-create it idempotently along
-- with the storage policies.

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

-- Policies already created in 20260604000001; re-add only if missing.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'Avatar images are publicly readable'
  ) then
    create policy "Avatar images are publicly readable"
      on storage.objects for select using (bucket_id = 'avatars');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'Users can upload their own avatars'
  ) then
    create policy "Users can upload their own avatars"
      on storage.objects for insert
      with check (
        bucket_id = 'avatars'
        and auth.uid() is not null
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'Users can update their own avatars'
  ) then
    create policy "Users can update their own avatars"
      on storage.objects for update
      using (
        bucket_id = 'avatars'
        and auth.uid() is not null
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;
end $$;
