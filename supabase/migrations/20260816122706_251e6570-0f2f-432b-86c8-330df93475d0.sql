ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS results_url text,
  ADD COLUMN IF NOT EXISTS results_rider_url_template text,
  ADD COLUMN IF NOT EXISTS results_published boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.event_result_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  label text NOT NULL,
  kind text NOT NULL DEFAULT 'stage',
  sort_order integer NOT NULL DEFAULT 0,
  column_map jsonb NOT NULL DEFAULT '{}'::jsonb,
  imported_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, label)
);

GRANT SELECT ON public.event_result_sets TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_result_sets TO authenticated;
GRANT ALL ON public.event_result_sets TO service_role;
ALTER TABLE public.event_result_sets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read result sets" ON public.event_result_sets FOR SELECT USING (true);
CREATE POLICY "admins write result sets" ON public.event_result_sets FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE IF NOT EXISTS public.event_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  result_set_id uuid NOT NULL REFERENCES public.event_result_sets(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  event_entrant_id uuid REFERENCES public.event_entrants(id) ON DELETE SET NULL,
  bib_number text,
  full_name text NOT NULL,
  category text,
  batch text,
  position integer,
  time_text text,
  time_ms bigint,
  gap_text text,
  status text,
  extras jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS event_results_event_idx ON public.event_results (event_id);
CREATE INDEX IF NOT EXISTS event_results_set_idx ON public.event_results (result_set_id);
CREATE INDEX IF NOT EXISTS event_results_bib_idx ON public.event_results (event_id, bib_number);

GRANT SELECT ON public.event_results TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_results TO authenticated;
GRANT ALL ON public.event_results TO service_role;
ALTER TABLE public.event_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read results" ON public.event_results FOR SELECT USING (true);
CREATE POLICY "admins write results" ON public.event_results FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER event_result_sets_touch BEFORE UPDATE ON public.event_result_sets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER event_results_touch BEFORE UPDATE ON public.event_results
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();