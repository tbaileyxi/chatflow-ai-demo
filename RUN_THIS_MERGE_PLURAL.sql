-- Merge the plural back in.
--
-- One business search put "restaurants" alongside "restaurant" the same
-- afternoon the categories were collapsed by hand. outreach-enrich now
-- normalises on the way in, so this is the last time it needs doing.

update public.sponsor_leads
set vertical = 'restaurant'
where lower(vertical) in ('restaurants', 'restaurant');

select vertical, count(*) as leads, count(contact_email) as have_an_email
from public.sponsor_leads
group by vertical
order by count(*) desc;
