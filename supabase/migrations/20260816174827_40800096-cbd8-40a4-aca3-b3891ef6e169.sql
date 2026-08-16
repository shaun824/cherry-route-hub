ALTER TABLE public.loyalty_rewards
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'entry',
  ADD COLUMN IF NOT EXISTS stock integer,
  ADD COLUMN IF NOT EXISTS fulfilment_notes text,
  ADD COLUMN IF NOT EXISTS event_scope jsonb NOT NULL DEFAULT '[]'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'loyalty_rewards_kind_chk') THEN
    ALTER TABLE public.loyalty_rewards
      ADD CONSTRAINT loyalty_rewards_kind_chk CHECK (kind IN ('entry','merch','experience','partner'));
  END IF;
END $$;

ALTER TABLE public.loyalty_event_values
  ADD COLUMN IF NOT EXISTS sells_out boolean NOT NULL DEFAULT false;

UPDATE public.loyalty_event_values SET sells_out = true WHERE hero = true;