-- Let the businesses who got the old price hear the new one.
--
-- Everyone emailed before today received the previous pitch: $2,500 for the
-- season, $500 deposit, balance due "the day we launch" — an app that launched
-- in August. None of them have been told it is $100 paid once, which is a
-- different offer, not a nicer version of the same one.
--
-- Resetting the sequence lets step 1 reach them again with the real price.
-- School partners are left alone: their letter is about bringing a donor list,
-- not about $100, so nothing they were told has changed.
--
-- Anyone who bounced or unsubscribed stays suppressed. Someone who asked to be
-- left alone does not get a second chance because our price moved.

update public.sponsor_leads
set emailed        = false,
    sequence_step  = 0,
    status         = 'New',
    follow_up_date = null
where emailed = true
  and bounced = false
  and unsubscribed = false
  and lower(coalesce(vertical, '')) <> 'school partner';

-- Who is now waiting on the correct letter.
select vertical,
       count(*)                                  as leads,
       count(contact_email)                      as can_be_emailed,
       count(*) filter (where sequence_step = 0)  as waiting_on_step_1
from public.sponsor_leads
where lower(coalesce(vertical, '')) <> 'school partner'
group by vertical
order by count(*) desc;
