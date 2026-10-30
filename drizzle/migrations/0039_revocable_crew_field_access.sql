CREATE TABLE public.crew_field_access (token_hash text PRIMARY KEY, event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE, issued_by uuid NOT NULL, expires_at timestamptz NOT NULL, revoked_at timestamptz);
GRANT ALL ON public.crew_field_access TO service_role;
REVOKE ALL ON public.crew_field_access FROM anon, authenticated;
ALTER TABLE public.crew_field_access ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.crew_field_access IS 'Server-only short-lived crew field links, checked against current issuer role on every use';