ALTER TABLE public.event_entrants
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS finished_at timestamptz;
CREATE INDEX IF NOT EXISTS event_entrants_event_finished_idx ON public.event_entrants (event_id, finished_at);
CREATE INDEX IF NOT EXISTS event_entrants_event_category_idx ON public.event_entrants (event_id, category);