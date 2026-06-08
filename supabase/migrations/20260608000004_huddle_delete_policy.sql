-- Owner can delete their own huddles. Missing DELETE policy was silently
-- blocking the "Close room" / "Leave & delete" flows in the app.

drop policy if exists "Owners can delete their huddles" on public.huddles;
create policy "Owners can delete their huddles"
on public.huddles
for delete
using (owner_id = auth.uid());
