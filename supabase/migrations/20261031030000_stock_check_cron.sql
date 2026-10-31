-- Run the stock check from Supabase Cron instead of GitHub Actions' (often late) schedule:
-- every 5 minutes, 13:00-21:55 UTC, Monday-Friday, which covers US market hours in both summer
-- and winter time. The job calls the deployed endpoint with the CRON_SECRET bearer token, read from
-- Supabase Vault at run time (secret name: CRON_SECRET), so the secret isn't stored here.
-- Applied to project lvnjktznlvuoghciqluu on 2026-10-31.
--
-- Store the secret once (SQL editor), using the same value as CRON_SECRET in Vercel:
--   select vault.create_secret('<CRON_SECRET value>', 'CRON_SECRET');
--
-- Useful afterwards:
--   select * from cron.job_run_details order by start_time desc limit 10;   -- did the job run?
--   select id, status_code, content from net._http_response order by created desc limit 10;
--   select cron.unschedule('stock-check');                                  -- stop it

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'stock-check',
  '*/5 13-21 * * 1-5',
  $$
  select net.http_get(
    url := 'https://stock-alerts-alpha.vercel.app/api/cron/stocks',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'CRON_SECRET')
    ),
    timeout_milliseconds := 60000
  );
  $$
);
