-- One Square order can contain several team sponsorships.
drop index if exists public.sponsor_claims_order_idx;

create index if not exists sponsor_claims_order_idx
  on public.sponsor_claims(square_order_id)
  where square_order_id is not null;
