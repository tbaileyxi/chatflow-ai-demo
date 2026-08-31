-- Free chip top-up.
--
-- WHY YOU NEED IT: reset_weekly_chips() was written to put free users below
-- 100 chips back to 1000, and it is scheduled on nothing — it has never run.
-- So an account that hits zero stays at zero, and every "out of chips" error
-- ends by advertising a Premium tier this build does not sell. Dead end.
--
-- This version does ONE thing: adds the top-up. An earlier draft also tried to
-- rewrite the Premium wording out of five Postgres functions with a DO block;
-- that is what failed and rolled the whole script back. The app now strips that
-- sentence on its way to the screen instead, so nothing here has to touch them.
--
-- Safe to run more than once.

-- 1. Column first — the function reads it.
alter table public.user_portfolios
  add column if not exists last_free_claim_at timestamptz;

-- 2. The top-up. Rate limited in Postgres, not in the app, so it cannot be
--    spammed by anyone calling the API directly.
create or replace function public.claim_free_chips()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_chips integer;
  v_last  timestamptz;
  v_grant integer := 500;
  v_ceiling integer := 1000;   -- a floor to stand on, not a way to stack up
begin
  if v_user_id is null then
    raise exception 'Not signed in';
  end if;

  insert into user_portfolios (user_id, total_chips)
  values (v_user_id, 1000)
  on conflict (user_id) do nothing;

  select total_chips, last_free_claim_at
    into v_chips, v_last
  from user_portfolios
  where user_id = v_user_id
  for update;

  if v_last is not null and v_last > now() - interval '24 hours' then
    return jsonb_build_object('ok', false, 'reason', 'too_soon',
                              'next_at', v_last + interval '24 hours',
                              'total_chips', v_chips);
  end if;

  -- Only for players who actually ran out.
  if v_chips >= 200 then
    return jsonb_build_object('ok', false, 'reason', 'not_needed',
                              'total_chips', v_chips);
  end if;

  update user_portfolios
  set total_chips = least(v_chips + v_grant, v_ceiling),
      last_free_claim_at = now(),
      updated_at = now()
  where user_id = v_user_id
  returning total_chips into v_chips;

  return jsonb_build_object('ok', true, 'granted', v_grant, 'total_chips', v_chips);
end;
$function$;

grant execute on function public.claim_free_chips() to authenticated;

-- Should return one row:
select proname from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'claim_free_chips';
