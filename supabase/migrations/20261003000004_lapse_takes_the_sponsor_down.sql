-- Lapsing a claim takes the sponsor off the rooms, wherever the lapse came
-- from.
--
-- square-webhook already does this when Square says a subscription stopped.
-- But a claim can also be lapsed by hand on the admin page — a sponsor who
-- cancels by email, a card that was never going to clear, a deal that ended
-- in conversation — and that path wrote a status and nothing else. The row
-- said lapsed while the logo stayed on the pregame card and the end card
-- kept naming them, which is the worst kind of wrong: every table agrees it
-- worked.
--
-- ENFORCED BY A TRIGGER, NOT BY THE SCREENS, for the same reason the seat cap
-- is. There are two ways in today and the next one will not remember to call
-- a helper. The webhook keeps its own cleanup, which is now belt and braces
-- rather than the only belt.
--
-- founding_partners rows are DELETED, not flagged: that table has no active
-- column, so the row's existence IS the sponsorship.

create or replace function public.sponsor_claim_lapsed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_id uuid;
  v_slug    text;
begin
  -- The same slug the webhook writes and sponsor-pregame-card reads:
  -- slugify(team_name), where team_name arrives as "<city> <name>".
  v_slug := regexp_replace(
              regexp_replace(lower(btrim(coalesce(new.team_name, ''))),
                             '[^a-z0-9]+', '-', 'g'),
              '(^-)|(-$)', '', 'g');

  if v_slug <> '' then
    delete from public.founding_partners fp
     where fp.team_slug = v_slug
       and fp.season = date_part('year', now())::integer;
  end if;

  -- team_key is "<team uuid>:founding" on anything bought through the board.
  -- Older keys are "NFL|Chicago|Bears" and resolve to no team, so they are
  -- left alone rather than guessed at.
  v_team_id := nullif(split_part(coalesce(new.team_key, ''), ':', 1), '');
  if v_team_id is not null then
    update public.team_sponsors
       set is_active = false
     where team_id = v_team_id
       and is_active = true;
  end if;

  return null;
exception
  -- team_key was not a uuid. Nothing to deactivate, and a cast error must
  -- never be the reason a claim cannot be marked lapsed.
  when invalid_text_representation then
    return null;
end $$;

drop trigger if exists sponsor_claim_lapsed on public.sponsor_claims;
create trigger sponsor_claim_lapsed
  after update of status on public.sponsor_claims
  for each row
  when (new.status = 'lapsed' and old.status is distinct from 'lapsed')
  execute function public.sponsor_claim_lapsed();
