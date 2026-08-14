-- 1. Learned FAQ knowledge base
CREATE TABLE public.event_faq_learned (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'suggested',
  source_thread_id UUID REFERENCES public.admin_qa_threads(id) ON DELETE SET NULL,
  source_message_id UUID,
  created_by UUID,
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  expires_on DATE,
  times_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_faq_learned TO authenticated;
GRANT ALL ON public.event_faq_learned TO service_role;

ALTER TABLE public.event_faq_learned ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage learned faqs"
  ON public.event_faq_learned FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role = 'admin'));

CREATE INDEX event_faq_learned_event_status_idx
  ON public.event_faq_learned (event_id, status);

CREATE TRIGGER event_faq_learned_touch
  BEFORE UPDATE ON public.event_faq_learned
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2. WhatsApp-capable threads
ALTER TABLE public.admin_qa_threads
  ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'app',
  ADD COLUMN IF NOT EXISTS wa_phone TEXT,
  ADD COLUMN IF NOT EXISTS wa_name TEXT;

ALTER TABLE public.admin_qa_threads
  ALTER COLUMN rider_user_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS admin_qa_threads_wa_phone_idx
  ON public.admin_qa_threads (wa_phone);
