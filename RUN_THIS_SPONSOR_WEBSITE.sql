-- One column, so a paid sponsor can actually go live.
--
-- team_sponsors.link_url is NOT NULL — it is where a fan goes when they tap the
-- sponsor in a room. sponsor_claims already holds business_name, email and
-- phone, but nowhere to put the website, so the webhook had nothing to write
-- and a payment could never turn into a visible sponsor.

alter table public.sponsor_claims
  add column if not exists website text;

-- Sanity check: should list the new column.
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'sponsor_claims'
  and column_name in ('business_name', 'website', 'sponsor_email');
