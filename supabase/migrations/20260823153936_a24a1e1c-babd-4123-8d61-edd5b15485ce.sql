CREATE TABLE public.event_price_book (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('category','extra')),
  label text NOT NULL,
  price_cents integer NOT NULL CHECK (price_cents >= 0),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX event_price_book_unique ON public.event_price_book (event_id, kind, lower(btrim(label)));
CREATE INDEX event_price_book_event ON public.event_price_book (event_id);

GRANT SELECT ON public.event_price_book TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.event_price_book TO authenticated;
GRANT ALL ON public.event_price_book TO service_role;

ALTER TABLE public.event_price_book ENABLE ROW LEVEL SECURITY;

CREATE POLICY "price book readable by signed-in users"
  ON public.event_price_book FOR SELECT TO authenticated USING (true);

CREATE POLICY "admins manage price book"
  ON public.event_price_book FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER event_price_book_touch BEFORE UPDATE ON public.event_price_book
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();