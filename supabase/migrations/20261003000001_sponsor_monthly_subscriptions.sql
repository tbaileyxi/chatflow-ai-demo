-- Sponsorship becomes a subscription, so a claim needs somewhere to remember
-- which one.
--
-- The season model only ever had to record that money arrived once. A monthly
-- partner has a thing that keeps going and can stop, which means two facts the
-- old shape had nowhere to put: the Square subscription this claim belongs to,
-- and what it costs every month.
--
-- amount_paid_cents stays, and now means what it says — the total collected so
-- far, climbing by monthly_cents each time Square bills them. balance_due_cents
-- stays at zero forever: nothing is owed later on a subscription, it is simply
-- charged again or it stops.

-- square_customer_id is the join, and it is not optional.
--
-- Square never tells you in one place that "this subscription came from that
-- checkout". The first payment carries the order id we stored AND the buyer's
-- customer id; the subscription.created event that follows carries the
-- customer id and the subscription id, and nothing else in common. The
-- customer is the only thread between them, so it gets written down the
-- moment the first payment lands or the subscription can never be matched to
-- a team again.
alter table public.sponsor_claims
  add column if not exists square_subscription_id text,
  add column if not exists square_customer_id text,
  add column if not exists monthly_cents integer not null default 0;

create index if not exists sponsor_claims_customer_idx
  on public.sponsor_claims(square_customer_id)
  where square_customer_id is not null;

comment on column public.sponsor_claims.monthly_cents is
  'What Square bills for this claim every month. 0 on legacy season rows.';

create unique index if not exists sponsor_claims_subscription_idx
  on public.sponsor_claims(square_subscription_id)
  where square_subscription_id is not null;

-- LAPSED, which the season model never needed.
--
-- A sponsor who stops paying has to come out of the rooms, and the slot has to
-- go back on the board. 'lapsed' rather than back to 'open' because the row is
-- history worth keeping — who it was, what they paid, when they left — and
-- because the checkout's availability test already asks only whether a team is
-- reserved or claimed, so a lapsed team is purchasable again with no change
-- anywhere else.
alter table public.sponsor_claims
  drop constraint if exists sponsor_claims_status_check;

alter table public.sponsor_claims
  add constraint sponsor_claims_status_check
  check (status in ('open', 'reserved', 'claimed', 'lapsed'));
