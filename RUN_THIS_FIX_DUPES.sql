-- 1. Remove the duplicate bars, and stop it happening again.
--
-- RUN_THIS_BAR_LEADS.sql ended with "on conflict do nothing", which does
-- nothing at all unless a unique constraint exists to conflict against. There
-- was none, so running the file twice inserted every bar twice: 665 became
-- 1,330. My mistake, and the fix is the constraint that should have been there.

-- Keep the oldest row for each venue+town, delete the rest. Rows that have been
-- emailed or enriched are preferred, so no work is thrown away.
with ranked as (
  select id,
         row_number() over (
           partition by lower(company), lower(coalesce(market, '')), vertical
           order by (contact_email is not null) desc,
                    emailed desc,
                    created_at asc
         ) as rn
  from public.sponsor_leads
)
delete from public.sponsor_leads
where id in (select id from ranked where rn > 1);

-- Now it cannot happen again: a second import of the same list updates nothing
-- instead of doubling it.
create unique index if not exists sponsor_leads_company_market_idx
  on public.sponsor_leads (lower(company), lower(coalesce(market, '')), vertical);


-- 2. Did the Brevo import land?
select
  count(*)                                          as chapter_leads,
  count(*) filter (where opened_at is not null)     as opened_it,
  count(*) filter (where clicked_app_store)         as clicked_app_store,
  count(*) filter (where bounce_kind = 'hard')      as dead_addresses,
  count(*) filter (where bounce_kind = 'soft')      as soft_bounces,
  count(*) filter (where unsubscribed)              as unsubscribed
from public.chapter_leads;

-- 3. And the categories, now deduped.
select vertical, count(*) as leads, count(contact_email) as have_an_email
from public.sponsor_leads
group by vertical
order by count(*) desc;
