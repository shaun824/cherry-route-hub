ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS spectator_parking text,
  ADD COLUMN IF NOT EXISTS spectator_food text,
  ADD COLUMN IF NOT EXISTS spectator_notes text,
  ADD COLUMN IF NOT EXISTS has_toilets boolean NOT NULL DEFAULT true;