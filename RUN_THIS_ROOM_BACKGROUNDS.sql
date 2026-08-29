-- Give every room a background, without an App Store release.
--
-- The app already renders huddles.photo_url behind the chat, and og-preview
-- already reads it for link previews. So writing a card URL into photo_url
-- lights up BOTH surfaces with no app change and no review cycle — which
-- matters, because 1.0.5 is in review right now and the next release is days
-- away at best.
--
-- Colour for the 19 teams we have one for, and a Side Huddle gold-on-black
-- default for every other team in the table. The teams table has no colour
-- column; those 19 live in src/lib/teams.ts, curated for the outreach pages.
-- Without the default, a Tulane or Mets room gets nothing — which is how a
-- Georgia Tech room ended up on a plain background.
--
-- Owners keep control: anything they upload themselves overwrites this, and
-- Remove in room settings clears it back to the plain background.
--
-- Run in the Supabase SQL editor. Safe to run twice.

-- ── 1. team -> card, by the same slug the website uses ───────────────────────
create or replace function public.team_card_url(p_team_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_slug text;
  v_key  text;
  -- Mirrors TEAMS in src/lib/teams.ts. Keep in step: a team here without a PNG
  -- deployed to /og-teams/ renders a broken image, which is worse than plain.
  v_slugs text[] := array[
    'cleveland-browns','buffalo-bills','texas-am','penn-state','ohio-state',
    'alabama','pittsburgh-steelers','green-bay-packers','clemson','georgia',
    'dallas-cowboys','seattle-seahawks','texas','las-vegas-raiders','lsu',
    'georgia-tech','tcu','usc-trojans','south-carolina'
  ];
begin
  select lower(regexp_replace(coalesce(t.city, '') || t.name, '[^a-zA-Z0-9]', '', 'g'))
    into v_key
    from public.teams t where t.id = p_team_id;

  if v_key is null then
    return 'https://www.sidehuddlesports.com/og-teams/default-room.png';
  end if;

  foreach v_slug in array v_slugs loop
    if replace(v_slug, '-', '') = v_key
       or v_key like '%' || replace(v_slug, '-', '') || '%'
       or replace(v_slug, '-', '') like '%' || v_key || '%' then
      return 'https://www.sidehuddlesports.com/og-teams/' || v_slug || '-room.png';
    end if;
  end loop;

  return 'https://www.sidehuddlesports.com/og-teams/default-room.png';
end;
$$;

grant execute on function public.team_card_url(uuid) to authenticated, anon;


-- ── 2. every room that has no picture of its own ─────────────────────────────
update public.huddles h
set photo_url = public.team_card_url(h.team_id)
where h.photo_url is null
  and h.team_id is not null;


-- ── 3. and every room made from here on ──────────────────────────────────────
-- A trigger rather than editing claim_chapter_huddle and join_team_huddle
-- separately: rooms get created down more than one path, and a default that
-- only fires on some of them is the bug we just spent an afternoon on.
create or replace function public.set_default_room_photo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.photo_url is null and new.team_id is not null then
    begin
      new.photo_url := public.team_card_url(new.team_id);
    exception when others then
      -- A room with no background beats a room that could not be created.
      raise warning '[set_default_room_photo] skipped: %', sqlerrm;
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists huddles_default_photo on public.huddles;
create trigger huddles_default_photo
  before insert on public.huddles
  for each row execute function public.set_default_room_photo();


-- ── 4. check ─────────────────────────────────────────────────────────────────
-- Expect no rooms left without a background, and a spread across the cards.
select
  count(*) filter (where photo_url is null)                         as rooms_with_no_background,
  count(*) filter (where photo_url like '%/og-teams/default-room%') as on_the_default,
  count(*) filter (where photo_url like '%/og-teams/%'
                     and photo_url not like '%default-room%')       as on_a_team_card,
  count(*) filter (where photo_url is not null
                     and photo_url not like '%/og-teams/%')         as own_photo
from public.huddles;
