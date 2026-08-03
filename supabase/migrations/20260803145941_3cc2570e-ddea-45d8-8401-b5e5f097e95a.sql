ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS title_sponsor_name text,
  ADD COLUMN IF NOT EXISTS title_sponsor_logo_url text,
  ADD COLUMN IF NOT EXISTS title_sponsor_url text;