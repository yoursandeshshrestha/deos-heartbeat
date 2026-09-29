-- Daily and weekly report sends run inside the api Edge Function.
-- Vault secrets (set out of band, not in git):
--   project_url, publishable_key, report_cron_secret

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule(
  'heartbeat-daily-reports',
  '0 5 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
      || '/functions/v1/api/reports/send?report_type=daily',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'publishable_key'),
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'report_cron_secret')
    ),
    body := '{"report_type":"daily"}'::jsonb
  );
  $$
);

select cron.schedule(
  'heartbeat-weekly-reports',
  '30 5 * * 1',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
      || '/functions/v1/api/reports/send?report_type=weekly',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'publishable_key'),
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'report_cron_secret')
    ),
    body := '{"report_type":"weekly"}'::jsonb
  );
  $$
);
