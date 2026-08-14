CREATE TABLE IF NOT EXISTS public.event_schedule_sync (
  event_id uuid PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  auto_apply boolean NOT NULL DEFAULT true,
  synced_at timestamptz,
  applied_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_schedule_sync TO authenticated;
GRANT ALL ON public.event_schedule_sync TO service_role;

ALTER TABLE public.event_schedule_sync ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage schedule sync" ON public.event_schedule_sync;
CREATE POLICY "Admins manage schedule sync"
  ON public.event_schedule_sync FOR ALL
  TO authenticated
  USING (private.is_admin())
  WITH CHECK (private.is_admin());