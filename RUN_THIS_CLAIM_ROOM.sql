-- Claim a room: a chapter president types a code and gets a room he owns.
--
-- WHY A CODE AND NOT A LINK. Apple does not carry a URL through an App Store
-- install. Tap a link, install, open — and Linking.getInitialURL() returns null,
-- so the token evaporates at exactly the moment it matters, because the whole
-- point of emailing a president is that he does not have the app. A six-character
-- code survives the install and works whether he taps the link or types it.
--
-- WHY NOT PRE-CREATE THE ROOM. A room made before anyone asks for it is an empty
-- room rotting in the database, owned by the wrong person. Nothing exists until
-- he taps, and then it is his.
--
-- WHY NOT is_official_team_huddle. That flag is how join_team_huddle finds THE
-- team room — `where team_id = ? and is_official_team_huddle is true order by
-- created_at limit 1`. Mark a chapter room with it and, if it happens to be the
-- older row, every uninvited signup for that team lands in one chapter's private
-- room. official_status='active' gives the same unlocks without that.
--
-- Run this in the Supabase SQL editor. `supabase db push` cannot apply it: this
-- project refuses the CLI's login role ("permission denied to alter role
-- cli_login_postgres"). Safe to run twice.

-- ── 1. the code, and what it turned into ─────────────────────────────────────
alter table public.chapter_leads
  add column if not exists claim_code        text,
  add column if not exists claimed_huddle_id uuid references public.huddles(id) on delete set null,
  add column if not exists claimed_at        timestamptz;

create unique index if not exists chapter_leads_claim_code_uniq
  on public.chapter_leads (claim_code)
  where claim_code is not null;


-- ── 2. generating one ────────────────────────────────────────────────────────
-- No I, O, 0 or 1: this gets read off a phone screen and typed by someone who
-- did not ask to be doing data entry.
create or replace function public.gen_claim_code()
returns text
language plpgsql
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
  i int;
begin
  loop
    candidate := '';
    for i in 1..6 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (
      select 1 from public.chapter_leads where claim_code = candidate
    );
  end loop;
  return candidate;
end;
$$;

-- Backfill every chapter that doesn't have one. Re-running this adds codes only
-- to new rows; an existing code never changes, because it may already be sitting
-- in someone's inbox.
update public.chapter_leads
set claim_code = public.gen_claim_code()
where claim_code is null;


-- ── 3. the claim ─────────────────────────────────────────────────────────────
create or replace function public.claim_chapter_huddle(p_code text)
returns table (huddle_id uuid, huddle_name text, created boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_lead public.chapter_leads%rowtype;
  v_team_id uuid;
  v_huddle_id uuid;
  v_created boolean := false;
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
begin
  if v_user is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  if v_code = '' then
    raise exception 'Enter your code.';
  end if;

  select * into v_lead from public.chapter_leads where claim_code = v_code;
  if v_lead.id is null then
    raise exception 'That code doesn''t match anything. Check the email it came in.';
  end if;

  -- Already claimed: hand back the same room and put the caller in it. Idempotent
  -- on purpose — a president who taps twice, or forwards the code to his
  -- co-organiser, should end up in one room rather than two.
  if v_lead.claimed_huddle_id is not null then
    v_huddle_id := v_lead.claimed_huddle_id;
  else
    -- Match the chapter's org to a team on letters and digits only: chapter_leads
    -- stores "Texas A&M" while teams splits city and name.
    select t.id into v_team_id
    from public.teams t
    where lower(regexp_replace(coalesce(t.city, '') || t.name, '[^a-zA-Z0-9]', '', 'g'))
        = lower(regexp_replace(coalesce(v_lead.org, ''), '[^a-zA-Z0-9]', '', 'g'))
       or lower(regexp_replace(t.name, '[^a-zA-Z0-9]', '', 'g'))
        = lower(regexp_replace(coalesce(v_lead.org, ''), '[^a-zA-Z0-9]', '', 'g'))
    limit 1;

    if v_team_id is null then
      raise exception 'We don''t have % set up yet — reply to the email and we''ll sort it.', v_lead.org;
    end if;

    insert into public.huddles
      (name, owner_id, team_id, is_private, is_official_team_huddle,
       is_verified, official_status, member_count)
    values
      (v_lead.chapter_name, v_user, v_team_id, false, false, false, 'active', 0)
    returning id into v_huddle_id;

    v_created := true;

    update public.chapter_leads
    set claimed_huddle_id = v_huddle_id,
        claimed_at        = now(),
        status            = 'onboarded',
        last_touch        = current_date
    where id = v_lead.id;
  end if;

  insert into public.huddle_members (huddle_id, user_id)
  values (v_huddle_id, v_user)
  on conflict do nothing;

  huddle_id := v_huddle_id;
  select h.name into huddle_name from public.huddles h where h.id = v_huddle_id;
  created := v_created;
  return next;
end;
$$;

grant execute on function public.claim_chapter_huddle(text) to authenticated;
-- gen_claim_code is service-role only: a client that can mint codes can mint
-- itself a chapter.
revoke execute on function public.gen_claim_code() from authenticated, anon;


-- ── 4. check it worked ───────────────────────────────────────────────────────
-- Expect: every chapter has a code, all distinct, and the function exists.
select
  (select count(*) from public.chapter_leads)                                as chapters,
  (select count(*) from public.chapter_leads where claim_code is not null)   as with_code,
  (select count(distinct claim_code) from public.chapter_leads)              as distinct_codes,
  (select count(*) from pg_proc where proname = 'claim_chapter_huddle')      as claim_fn;
