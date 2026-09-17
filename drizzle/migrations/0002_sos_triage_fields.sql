ALTER TABLE public.tracking_sos
  ADD COLUMN IF NOT EXISTS reason text,
  ADD COLUMN IF NOT EXISTS note text,
  ADD COLUMN IF NOT EXISTS acknowledged_by uuid,
  ADD COLUMN IF NOT EXISTS acknowledged_at timestamptz,
  ADD COLUMN IF NOT EXISTS escalated_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolved_by uuid,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz;

ALTER TABLE public.tracking_sos
  ADD CONSTRAINT tracking_sos_reason_check
  CHECK (reason IS NULL OR reason IN ('medical','mechanical','lost','other','checking-in')) NOT VALID;

CREATE INDEX IF NOT EXISTS tracking_sos_event_status_idx
  ON public.tracking_sos (event_id, status, created_at DESC);

DROP POLICY IF EXISTS "Riders cancel their own SOS" ON public.tracking_sos;
CREATE POLICY "Riders cancel their own SOS"
ON public.tracking_sos
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE ON public.tracking_sos TO authenticated;
GRANT ALL ON public.tracking_sos TO service_role;