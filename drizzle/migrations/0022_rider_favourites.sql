CREATE TABLE public.rider_favourites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_id uuid NOT NULL,
  event_entrant_id uuid NOT NULL,
  full_name text NOT NULL DEFAULT '',
  bib_number text,
  category text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, event_entrant_id)
);
GRANT SELECT, INSERT, DELETE ON public.rider_favourites TO authenticated;
GRANT ALL ON public.rider_favourites TO service_role;
ALTER TABLE public.rider_favourites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own favourites read" ON public.rider_favourites FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own favourites add" ON public.rider_favourites FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own favourites remove" ON public.rider_favourites FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX rider_favourites_user_event ON public.rider_favourites (user_id, event_id);