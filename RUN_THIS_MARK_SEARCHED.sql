-- Record what was actually searched, so nobody looks twice.
--
-- Georgia: the UGA site lists 43 chapters by name only — no city, no contact.
--          Searched, and there is nothing to email. Not worth revisiting.
-- Texas:   the directory holds 182, the parser saved 14. Marked searched but
--          the parser needs fixing; this is not a finished team.
-- Mississippi State: no public chapter directory found. Added as a team so it
--          appears in the list, with nothing ticked.

insert into public.outreach_teams (team) values
  ('Georgia'), ('Texas'), ('Mississippi State')
on conflict (team) do nothing;

insert into public.team_progress (team, kind, found) values
  ('Georgia', 'chapters', 43),
  ('Texas',   'chapters', 14)
on conflict (team, kind) do update
  set found = excluded.found, searched_at = now();

select team, kind, found, searched_at
from public.team_progress
order by team, kind;
