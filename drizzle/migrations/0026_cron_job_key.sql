CREATE SCHEMA IF NOT EXISTS private;
CREATE TABLE IF NOT EXISTS private.cron_key (id int PRIMARY KEY DEFAULT 1 CHECK (id = 1), secret text NOT NULL DEFAULT encode(extensions.gen_random_bytes(32), 'hex'));
INSERT INTO private.cron_key (id) VALUES (1) ON CONFLICT DO NOTHING;
REVOKE ALL ON private.cron_key FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION public.verify_cron_key(_key text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = private, public AS $$
  SELECT coalesce(_key, '') <> '' AND EXISTS (SELECT 1 FROM private.cron_key WHERE secret = _key)
$$;
REVOKE ALL ON FUNCTION public.verify_cron_key(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_cron_key(text) TO service_role;