-- Somewhere to keep what Brevo already knows.
--
-- The send log records who opened, who clicked, and who bounced, and none of it
-- came back — so 60 people who clicked through to the App Store looked exactly
-- like 600 who ignored the email, and 17 dead addresses stayed in the sending
-- list. Both tables get the same four columns so one importer can fill either.

alter table public.chapter_leads
  add column if not exists opened_at         timestamptz,
  add column if not exists clicked_at        timestamptz,
  add column if not exists clicked_app_store boolean not null default false,
  add column if not exists bounce_kind       text;   -- 'hard' | 'soft'

alter table public.sponsor_leads
  add column if not exists opened_at         timestamptz,
  add column if not exists clicked_at        timestamptz,
  add column if not exists clicked_app_store boolean not null default false,
  add column if not exists bounce_kind       text;

-- A hard bounce is a dead address and must never be sent to again. A soft
-- bounce is a full mailbox or a bad day, so it is recorded but not suppressed —
-- suppressing on one soft bounce throws away good addresses.
comment on column public.chapter_leads.bounce_kind is
  'hard = dead, also sets bounced. soft = recorded only, still sendable.';

select 'chapter_leads' as tbl, count(*) as rows from public.chapter_leads
union all
select 'sponsor_leads', count(*) from public.sponsor_leads;
