-- Update the stake constraint to allow proper dollar values
ALTER TABLE public.fades DROP CONSTRAINT IF EXISTS fades_stake_check;

-- Allow stakes from $1 to $500
ALTER TABLE public.fades ADD CONSTRAINT fades_stake_check 
  CHECK (stake >= 1 AND stake <= 500);