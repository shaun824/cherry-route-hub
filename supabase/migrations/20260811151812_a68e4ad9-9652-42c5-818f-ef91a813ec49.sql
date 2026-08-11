select cron.schedule(
  'event-bot-knowledge-daily',
  '30 1 * * *',
  $$
  select net.http_post(
    url:='https://project--bed1fb64-5051-4807-8a8e-23365ef16157.lovable.app/api/public/hooks/event-bot-refresh',
    headers:='{"Content-Type": "application/json", "apikey": "sb_publishable_7OK1Oc-yqNV7mZ3QbpQ0Dg_lxu1n-w2"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);