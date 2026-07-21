ALTER TABLE public.event_entrants
  ADD COLUMN IF NOT EXISTS extras jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS jacket_size text,
  ADD COLUMN IF NOT EXISTS tshirt_size text,
  ADD COLUMN IF NOT EXISTS notes text;