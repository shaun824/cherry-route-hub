ALTER TABLE public.entrants ALTER COLUMN email DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS entrants_id_number_hash_key ON public.entrants (id_number_hash) WHERE id_number_hash IS NOT NULL;