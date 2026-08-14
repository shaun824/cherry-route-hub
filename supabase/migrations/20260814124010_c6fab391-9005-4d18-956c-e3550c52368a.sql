ALTER TABLE public.event_entrants
  ADD COLUMN IF NOT EXISTS paid boolean,
  ADD COLUMN IF NOT EXISTS amount_due_cents integer,
  ADD COLUMN IF NOT EXISTS amount_paid_cents integer,
  ADD COLUMN IF NOT EXISTS payment_synced_at timestamptz;