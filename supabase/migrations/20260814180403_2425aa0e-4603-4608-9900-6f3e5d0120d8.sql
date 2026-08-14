select cron.schedule(
  'rooming-sheet-sync-hourly',
  '17 * * * *',
  $$
  select net.http_post(
    url := 'https://project--bed1fb64-5051-4807-8a8e-23365ef16157.lovable.app/api/public/hooks/rooming-sheet-sync',
    headers := jsonb_build_object('Content-Type','application/json','apikey','sb_publishable_7OK1Oc-yqNV7mZ3QbpQ0Dg_lxu1n-w2'),
    body := '{}'::jsonb
  );
  $$
);