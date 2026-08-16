CREATE TABLE public.id_lookup_attempts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_hash text,
  id_hash text,
  outcome text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT ALL ON public.id_lookup_attempts TO service_role;
ALTER TABLE public.id_lookup_attempts ENABLE ROW LEVEL SECURITY;
CREATE INDEX id_lookup_attempts_ip_idx ON public.id_lookup_attempts (ip_hash, created_at DESC);
CREATE INDEX id_lookup_attempts_id_idx ON public.id_lookup_attempts (id_hash, created_at DESC);