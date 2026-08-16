CREATE TABLE public.rider_event_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  en_event_id integer NOT NULL,
  event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  event_name text NOT NULL,
  event_date date,
  venue text,
  category text,
  bib_number text,
  registration_ref text,
  paid boolean,
  matched_on text,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, en_event_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rider_event_history TO authenticated;
GRANT ALL ON public.rider_event_history TO service_role;

ALTER TABLE public.rider_event_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Riders manage their own event history"
  ON public.rider_event_history FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER rider_event_history_touch
  BEFORE UPDATE ON public.rider_event_history
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX rider_event_history_user_idx ON public.rider_event_history (user_id, event_date DESC);