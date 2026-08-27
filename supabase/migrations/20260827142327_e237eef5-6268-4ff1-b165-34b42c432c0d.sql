ALTER TABLE public.event_schedule_sync
  ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS review_note text;

UPDATE public.event_schedule_sync
SET verified = true, verified_at = now(), needs_review = false,
    review_note = 'Corrected by hand from the official website schedule'
WHERE event_id = '2dc4fd8c-c1f0-45b3-b5cd-61a3644f7fa7';