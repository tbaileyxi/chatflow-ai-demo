-- Restore the established monthly founding-sponsor pricing model.
alter table public.sponsor_claims
  drop constraint if exists sponsor_claims_plan_check;

alter table public.sponsor_claims
  add constraint sponsor_claims_plan_check
  check (plan in ('monthly', 'reserve', 'full'));

alter table public.sponsor_claims
  alter column balance_due_date drop default;
