CREATE TABLE public.email_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient text NOT NULL,
  template text NOT NULL,
  subject text NOT NULL,
  html text NOT NULL,
  event_id uuid,
  sent_at timestamptz NOT NULL DEFAULT now(),
  suppressed boolean NOT NULL DEFAULT false,
  opened_at timestamptz,
  last_opened_at timestamptz,
  open_count integer NOT NULL DEFAULT 0,
  click_count integer NOT NULL DEFAULT 0
);
CREATE INDEX email_sends_sent_at_idx ON public.email_sends (sent_at DESC);
CREATE INDEX email_sends_recipient_idx ON public.email_sends (lower(recipient));

CREATE TABLE public.email_send_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  send_id uuid NOT NULL REFERENCES public.email_sends(id) ON DELETE CASCADE,
  url text NOT NULL,
  clicked_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX email_send_clicks_send_idx ON public.email_send_clicks (send_id, clicked_at DESC);

GRANT SELECT ON public.email_sends TO authenticated;
GRANT ALL ON public.email_sends TO service_role;
GRANT SELECT ON public.email_send_clicks TO authenticated;
GRANT ALL ON public.email_send_clicks TO service_role;

ALTER TABLE public.email_sends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_send_clicks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read email sends" ON public.email_sends
  FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins read email clicks" ON public.email_send_clicks
  FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role));