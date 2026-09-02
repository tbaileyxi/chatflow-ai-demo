-- 32 categories collapse to 12.
--
-- "car dealers", "auto dealers", "Auto Dealers" and "car dealership" are one
-- category typed four ways across 89 leads. Insurance is three ways, banks
-- three, sports bar two. Any "choose your audience" control built on this shows
-- 32 options that overlap, and any per-category email template picks the wrong
-- one depending on how a row was typed months ago.
--
-- Nothing is deleted. Only the label changes.

update public.sponsor_leads set vertical = case
  when lower(vertical) in ('car dealers','auto dealers','car dealership','car dealerships','auto dealer') then 'auto dealer'
  when lower(vertical) in ('insurance','insurance agency','insurance agent','insurance agents') then 'insurance'
  when lower(vertical) in ('banks','bank','regional banks','credit union','credit unions') then 'bank or credit union'
  when lower(vertical) in ('sports bar','sports bars','bar','bars') then 'sports bar'
  when lower(vertical) in ('pizza','wings','restaurant','restaurants','regional restaurant chains','bojangles') then 'restaurant'
  when lower(vertical) in ('sports ticketing','ticketing') then 'ticketing'
  when lower(vertical) in ('urgent care','physical therapy','orthodontist','dentist','chiropractor') then 'health and dental'
  when lower(vertical) in ('advisors','finance','financial advisor','wealth management') then 'financial advice'
  when lower(vertical) in ('gym','gyms','fitness') then 'gym'
  when lower(vertical) in ('car wash','roofing company','roofing','oil','hotel','real estate agent','real estate') then 'other local business'
  when lower(vertical) = 'school partner' then 'school partner'
  else lower(vertical)
end
where vertical is not null;

-- What you are left with, biggest first.
select vertical,
       count(*)                               as leads,
       count(contact_email)                   as have_an_email,
       count(*) filter (where sequence_step = 0) as never_emailed,
       count(*) filter (where sequence_step = 1) as had_step_1,
       count(*) filter (where sequence_step >= 2) as had_step_2_plus
from public.sponsor_leads
group by vertical
order by count(*) desc;
