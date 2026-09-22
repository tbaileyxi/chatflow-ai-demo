-- Paste a list of creators in, without losing what is already known.
--
-- The one-off import that brought the 232 rows over from the tracker sheet
-- was a throwaway: anon-callable, guarded by a string baked into the body.
-- This is the version worth keeping — same admin check as the rest of
-- /outreach, no secret, callable only by a signed-in admin.
--
-- EVERY FIELD IS COALESCED. A pasted list is usually thinner than the row it
-- lands on: the sheet knows the tier, discovery knows the engagement and the
-- email. A blank cell must never erase either, so an empty value leaves what
-- is there alone, and followers takes the larger of the two.
create or replace function public.admin_import_creator_leads(p_rows jsonb)
returns table (inserted integer, updated integer)
language plpgsql security definer set search_path = public as $$
declare
  v_before integer;
  v_after  integer;
  v_seen   integer;
begin
  if public.get_current_user_role() is distinct from 'admin' then
    raise exception 'admin only';
  end if;

  select count(*) into v_before from public.creator_leads;

  with src as (
    select * from jsonb_to_recordset(p_rows) as x(
      handle text, display_name text, org text, followers int, bio text,
      email text, website text, status text, tier text, dm_able boolean
    )
  ), cleaned as (
    select distinct on (lower(trim(both from regexp_replace(handle, '^@', ''))))
           regexp_replace(trim(both from handle), '^@', '') as handle,
           nullif(trim(both from coalesce(display_name, '')), '') as display_name,
           nullif(trim(both from coalesce(org, '')), '')          as org,
           greatest(coalesce(followers, 0), 0)                    as followers,
           nullif(trim(both from coalesce(bio, '')), '')          as bio,
           nullif(trim(both from coalesce(email, '')), '')        as email,
           nullif(trim(both from coalesce(website, '')), '')      as website,
           case when lower(coalesce(status, '')) in
                     ('new','queued','sent','replied','onboarded','dead')
                then lower(status) else null end                  as status,
           nullif(trim(both from coalesce(tier, '')), '')         as tier,
           dm_able
      from src
     where coalesce(trim(both from handle), '') <> ''
  )
  insert into public.creator_leads
    (handle, display_name, org, followers, bio, email, website, status, tier, dm_able)
  select handle, display_name, org, followers, bio, email, website,
         coalesce(status, 'new'), tier, coalesce(dm_able, false)
    from cleaned
  on conflict (handle) do update set
    display_name = coalesce(excluded.display_name, creator_leads.display_name),
    org          = coalesce(excluded.org,          creator_leads.org),
    followers    = greatest(excluded.followers,    creator_leads.followers),
    bio          = coalesce(excluded.bio,          creator_leads.bio),
    email        = coalesce(excluded.email,        creator_leads.email),
    website      = coalesce(excluded.website,      creator_leads.website),
    tier         = coalesce(excluded.tier,         creator_leads.tier),
    dm_able      = excluded.dm_able,
    last_seen    = now();

  get diagnostics v_seen = row_count;
  select count(*) into v_after from public.creator_leads;

  return query select (v_after - v_before), (v_seen - (v_after - v_before));
end $$;

revoke all on function public.admin_import_creator_leads(jsonb) from public, anon;
grant execute on function public.admin_import_creator_leads(jsonb) to authenticated;
