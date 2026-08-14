ALTER TABLE public.event_rooming
  ADD COLUMN IF NOT EXISTS village_zone_id text,
  ADD COLUMN IF NOT EXISTS village_spot_id text;

ALTER TABLE public.event_venues
  ADD COLUMN IF NOT EXISTS rooming_sheet_url text,
  ADD COLUMN IF NOT EXISTS rooming_sheet_range text,
  ADD COLUMN IF NOT EXISTS rooming_sheet_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS rooming_sheet_error text,
  ADD COLUMN IF NOT EXISTS rooming_sheet_rows integer;