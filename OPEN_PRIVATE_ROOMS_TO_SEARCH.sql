-- Let people find a private room so they can ask to join it.
--
-- Today the policy on huddles is USING (NOT is_private), so a non-member
-- cannot SELECT a private room at all. Removing the app-side filter changes
-- nothing on its own — the rows never arrive. This is the half that matters.
--
-- WHAT THIS DOES NOT EXPOSE: not one message. The SELECT policy on
-- huddle_messages checks h.is_private = false OR h.is_official_team_huddle,
-- reading the huddles COLUMNS directly rather than asking whether the caller
-- can see the row. A private room's messages stay shut to non-members after
-- this exactly as before. Verified against the policy body, not assumed.
--
-- What becomes visible on a private room: name, bio, team, member count,
-- owner id. Enough to recognise a room and ask for the door to be opened.

create policy "Signed-in users can find private rooms to request access"
on public.huddles
for select
to authenticated
using (is_private);

-- Confirm both policies are present: the public one and this one.
select policyname, cmd, qual
from pg_policies
where schemaname = 'public' and tablename = 'huddles' and cmd = 'SELECT'
order by policyname;
