
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS lifecycle text NOT NULL DEFAULT 'published',
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS cover_url text,
  ADD COLUMN IF NOT EXISTS classes jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS batches jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS days jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.events ALTER COLUMN slug DROP NOT NULL;
ALTER TABLE public.events ALTER COLUMN slug SET DEFAULT NULL;
