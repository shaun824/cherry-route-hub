CREATE TABLE public.content_audit_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'ok',
  events_checked integer NOT NULL DEFAULT 0,
  issue_count integer NOT NULL DEFAULT 0,
  issues jsonb NOT NULL DEFAULT '[]'::jsonb,
  summary text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.content_audit_runs TO authenticated;
GRANT ALL ON public.content_audit_runs TO service_role;

ALTER TABLE public.content_audit_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read content audit runs"
ON public.content_audit_runs FOR SELECT TO authenticated
USING (private.is_admin());

CREATE INDEX content_audit_runs_run_at_idx ON public.content_audit_runs (run_at DESC);

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.unschedule('content-audit-every-2-days')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'content-audit-every-2-days');

SELECT cron.schedule(
  'content-audit-every-2-days',
  '0 3 */2 * *',
  $$
  SELECT net.http_post(
    url := 'https://project--bed1fb64-5051-4807-8a8e-23365ef16157.lovable.app/api/public/hooks/content-audit',
    headers := '{"Content-Type": "application/json", "apikey": "sb_publishable_7OK1Oc-yqNV7mZ3QbpQ0Dg_lxu1n-w2"}'::jsonb,
    body := '{"source":"cron"}'::jsonb
  );
  $$
);