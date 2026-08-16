ALTER TABLE public.event_merch_options
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS price_from numeric,
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS web_synced_at timestamptz;

select cron.schedule(
  'merch-web-sync-weekly',
  '35 3 * * 1',
  $$
  select net.http_post(
    url := 'https://project--bed1fb64-5051-4807-8a8e-23365ef16157.lovable.app/api/public/hooks/merch-sync',
    headers := jsonb_build_object('Content-Type','application/json','apikey','sb_publishable_7OK1Oc-yqNV7mZ3QbpQ0Dg_lxu1n-w2'),
    body := '{}'::jsonb
  );
  $$
);