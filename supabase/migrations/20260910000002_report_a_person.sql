-- Let a report name a person instead of only a message.
--
-- message_reports.message_id was NOT NULL, which made the only way to report
-- somebody "find something they said and long-press it". That is fine when the
-- offence is a message and useless when it is the person — a profile with a
-- slur for a display name, an avatar nobody should see, someone who deleted
-- the message after you saw it.
--
-- Guideline 1.2 asks for a report mechanism; a mechanism you can only reach
-- through content that still exists is a partial one.

ALTER TABLE public.message_reports
  ALTER COLUMN message_id DROP NOT NULL;

-- A report still has to be ABOUT something.
ALTER TABLE public.message_reports
  DROP CONSTRAINT IF EXISTS message_reports_has_subject;
ALTER TABLE public.message_reports
  ADD CONSTRAINT message_reports_has_subject
  CHECK (message_id IS NOT NULL OR reported_user_id IS NOT NULL);

-- The existing "report the same thing twice is one report" index keys on
-- message_id, so it stops de-duplicating once message_id is null. Cover the
-- person-level case with its own partial index rather than widening that one.
CREATE UNIQUE INDEX IF NOT EXISTS message_reports_person_once
  ON public.message_reports(reporter_id, reported_user_id)
  WHERE message_id IS NULL;
