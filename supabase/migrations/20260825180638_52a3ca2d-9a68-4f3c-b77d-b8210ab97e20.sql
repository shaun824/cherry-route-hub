ALTER TABLE public.promos
  ADD COLUMN IF NOT EXISTS blurb text,
  ADD COLUMN IF NOT EXISTS redeem text,
  ADD COLUMN IF NOT EXISTS event_match text,
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sort_order integer;

ALTER TABLE public.promos ALTER COLUMN code DROP NOT NULL;