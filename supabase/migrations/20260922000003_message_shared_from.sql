-- A moment sent on to another room remembers where it came from.
--
-- Sending your own photo or clip to your other rooms writes a separate row in
-- each one, so each room keeps its own replies — three groups talking about
-- the same picture without reading each other, which is why the groups are
-- separate in the first place.
--
-- Separate rows know nothing about each other, so this is the one thread back:
-- every copy points at the message it came from. Nothing reads it yet. Delete
-- stays per room on purpose — you posted three things to three groups, and
-- removing it from the family room should not reach into the buddies' room —
-- but "take it off everything" is the request that will eventually come, and a
-- nullable column added now is the difference between a small change then and
-- a migration against a table full of messages.
--
-- It also carries the attribution a room could show later: this came from
-- somewhere else, rather than pretending it was posted here.

alter table public.huddle_messages
  add column if not exists shared_from_id uuid
  references public.huddle_messages(id) on delete set null;

-- Finding the copies of one original. Partial, because the overwhelming
-- majority of messages were never sent on and do not belong in the index.
create index if not exists huddle_messages_shared_from
  on public.huddle_messages (shared_from_id)
  where shared_from_id is not null;
