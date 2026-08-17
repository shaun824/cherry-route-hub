CREATE TABLE public.business_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  summary text,
  category text NOT NULL DEFAULT 'general',
  event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  tier text NOT NULL DEFAULT 'public',
  status text NOT NULL DEFAULT 'suggested',
  source_kind text NOT NULL DEFAULT 'paste',
  source_ref text,
  redaction_notes text[] NOT NULL DEFAULT '{}',
  times_used integer NOT NULL DEFAULT 0,
  created_by uuid,
  approved_by uuid,
  approved_at timestamptz,
  review_on date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT business_knowledge_category_chk CHECK (category IN ('ops','product','suppliers','policies','general')),
  CONSTRAINT business_knowledge_tier_chk CHECK (tier IN ('public','internal')),
  CONSTRAINT business_knowledge_status_chk CHECK (status IN ('suggested','approved','retired')),
  CONSTRAINT business_knowledge_source_chk CHECK (source_kind IN ('email','paste','chat'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_knowledge TO authenticated;
GRANT ALL ON public.business_knowledge TO service_role;
ALTER TABLE public.business_knowledge ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage business knowledge" ON public.business_knowledge
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX business_knowledge_status_tier_idx ON public.business_knowledge (status, tier);
CREATE INDEX business_knowledge_event_idx ON public.business_knowledge (event_id);
CREATE TRIGGER business_knowledge_touch BEFORE UPDATE ON public.business_knowledge
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.knowledge_intake (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_address text,
  subject text,
  raw_body text NOT NULL,
  body_hash text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'received',
  error text,
  knowledge_id uuid REFERENCES public.business_knowledge(id) ON DELETE SET NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT knowledge_intake_status_chk CHECK (status IN ('received','processed','skipped','failed'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_intake TO authenticated;
GRANT ALL ON public.knowledge_intake TO service_role;
ALTER TABLE public.knowledge_intake ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage knowledge intake" ON public.knowledge_intake
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER knowledge_intake_touch BEFORE UPDATE ON public.knowledge_intake
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();