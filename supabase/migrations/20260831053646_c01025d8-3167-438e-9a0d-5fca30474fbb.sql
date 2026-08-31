CREATE TABLE public.event_email_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused')),
  anchor TEXT NOT NULL DEFAULT 'activation' CHECK (anchor IN ('activation','entry')),
  activated_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX event_email_campaigns_event_idx ON public.event_email_campaigns (event_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_email_campaigns TO authenticated;
GRANT ALL ON public.event_email_campaigns TO service_role;
ALTER TABLE public.event_email_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage event_email_campaigns" ON public.event_email_campaigns
  FOR ALL TO authenticated USING (private.is_admin()) WITH CHECK (private.is_admin());
CREATE TRIGGER event_email_campaigns_touch BEFORE UPDATE ON public.event_email_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.event_email_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.event_email_campaigns(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 1,
  subject TEXT NOT NULL,
  heading TEXT,
  body TEXT NOT NULL DEFAULT '',
  cta_label TEXT,
  cta_url TEXT,
  delay_hours INTEGER NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX event_email_steps_campaign_idx ON public.event_email_steps (campaign_id, position);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_email_steps TO authenticated;
GRANT ALL ON public.event_email_steps TO service_role;
ALTER TABLE public.event_email_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage event_email_steps" ON public.event_email_steps
  FOR ALL TO authenticated USING (private.is_admin()) WITH CHECK (private.is_admin());
CREATE TRIGGER event_email_steps_touch BEFORE UPDATE ON public.event_email_steps
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.event_email_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  step_id UUID NOT NULL REFERENCES public.event_email_steps(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES public.event_email_campaigns(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','suppressed','failed')),
  error_message TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (step_id, email)
);
CREATE INDEX event_email_sends_campaign_idx ON public.event_email_sends (campaign_id);
GRANT SELECT ON public.event_email_sends TO authenticated;
GRANT ALL ON public.event_email_sends TO service_role;
ALTER TABLE public.event_email_sends ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read event_email_sends" ON public.event_email_sends
  FOR SELECT TO authenticated USING (private.is_admin());

SELECT cron.schedule(
  'event-email-workflows-hourly',
  '10 * * * *',
  $$
  select net.http_post(
    url:='https://project--bed1fb64-5051-4807-8a8e-23365ef16157.lovable.app/api/public/hooks/email-workflow',
    headers:='{"Content-Type": "application/json", "apikey": "sb_publishable_7OK1Oc-yqNV7mZ3QbpQ0Dg_lxu1n-w2"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);