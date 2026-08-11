CREATE TABLE public.event_bot_knowledge (
  event_id uuid PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
  content text NOT NULL DEFAULT '',
  sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  refreshed_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.event_bot_knowledge TO authenticated;
GRANT ALL ON public.event_bot_knowledge TO service_role;

ALTER TABLE public.event_bot_knowledge ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read event bot knowledge"
ON public.event_bot_knowledge FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage event bot knowledge"
ON public.event_bot_knowledge FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TRIGGER event_bot_knowledge_touch
BEFORE UPDATE ON public.event_bot_knowledge
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();