
ALTER TABLE public.notification_deliveries
  ADD COLUMN IF NOT EXISTS wa_message_id text,
  ADD COLUMN IF NOT EXISTS wa_phone text,
  ADD COLUMN IF NOT EXISTS wa_status text,
  ADD COLUMN IF NOT EXISTS wa_status_at timestamptz;

CREATE INDEX IF NOT EXISTS notification_deliveries_wa_message_id_idx
  ON public.notification_deliveries (wa_message_id);

CREATE TABLE IF NOT EXISTS public.whatsapp_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  language text NOT NULL DEFAULT 'en',
  description text,
  body_preview text,
  variable_count integer NOT NULL DEFAULT 0,
  variable_labels text[] NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name, language)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_templates TO authenticated;
GRANT ALL ON public.whatsapp_templates TO service_role;
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage whatsapp templates"
  ON public.whatsapp_templates FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE IF NOT EXISTS public.whatsapp_opt_outs (
  phone text PRIMARY KEY,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_opt_outs TO authenticated;
GRANT ALL ON public.whatsapp_opt_outs TO service_role;
ALTER TABLE public.whatsapp_opt_outs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage whatsapp opt outs"
  ON public.whatsapp_opt_outs FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));
