select cron.unschedule('news-sync-weekly') where exists (select 1 from cron.job where jobname = 'news-sync-weekly');

select cron.schedule(
  'news-sync-weekly',
  '0 5 * * 1',
  $$
  select net.http_post(
    url := 'https://project--bed1fb64-5051-4807-8a8e-23365ef16157.lovable.app/api/public/hooks/news-sync',
    headers := jsonb_build_object('Content-Type','application/json','apikey','sb_publishable_7OK1Oc-yqNV7mZ3QbpQ0Dg_lxu1n-w2'),
    body := '{}'::jsonb
  );
  $$
);