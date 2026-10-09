ALTER TABLE public.event_entrants ADD COLUMN IF NOT EXISTS gender text;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS podium_config jsonb;

CREATE TABLE public.event_podiums (
  event_id uuid PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
  final jsonb NOT NULL DEFAULT '[]'::jsonb,
  published_at timestamptz,
  reveal_at timestamptz,
  published_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.event_podiums TO anon, authenticated;
GRANT ALL ON public.event_podiums TO service_role;
ALTER TABLE public.event_podiums ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Published podiums are public after reveal" ON public.event_podiums FOR SELECT TO anon, authenticated
  USING (published_at IS NOT NULL AND (reveal_at IS NULL OR reveal_at <= now()));