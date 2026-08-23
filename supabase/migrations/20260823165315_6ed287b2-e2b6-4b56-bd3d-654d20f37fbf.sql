ALTER TABLE public.event_venues
  ADD COLUMN IF NOT EXISTS night_start integer,
  ADD COLUMN IF NOT EXISTS nights integer,
  ADD COLUMN IF NOT EXISTS check_in text,
  ADD COLUMN IF NOT EXISTS check_out text;

ALTER TABLE public.event_rooming
  ADD COLUMN IF NOT EXISTS night_index integer;