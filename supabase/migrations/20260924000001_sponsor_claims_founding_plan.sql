-- EVERY SPONSOR CHECKOUT HAS BEEN FAILING AT THE LAST STEP.
--
-- create-sponsor-square-checkout builds the Square payment link, then writes
-- the reservation row with plan = 'founding'. The check constraint has never
-- allowed that value: it started as ('reserve','full'), was widened once to
-- ('monthly','reserve','full'), and the pricing moved to a single founding
-- plan afterwards without anyone coming back here.
--
-- So the buyer saw "Checkout was created, but the team reservation record
-- failed." — after the payment link existed. A sponsor who pressed on could
-- pay Square for a team that has no claim row against it, which is the worst
-- possible ordering: money in, nothing reserved.
--
-- Confirmed against production before writing this, not inferred from the
-- migration files: the insert returns 23514 on
-- sponsor_claims_plan_check, and the identical row with plan = 'full' is
-- accepted, so the plan value is the only thing wrong.
--
-- 'founding' is what these rows genuinely are, so the constraint widens to
-- admit it rather than the function writing something untrue. The three older
-- values stay: rows carrying them are still in this table and a constraint is
-- validated against every existing row when it is added.

alter table public.sponsor_claims
  drop constraint if exists sponsor_claims_plan_check;

alter table public.sponsor_claims
  add constraint sponsor_claims_plan_check
  check (plan is null or plan in ('founding', 'monthly', 'reserve', 'full'));
