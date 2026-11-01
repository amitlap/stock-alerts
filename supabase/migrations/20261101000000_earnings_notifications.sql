-- Earnings reminders: one row per reminder sent, so the daily job never emails the same one twice.
-- A reminder is per playbook and stock: each playbook following a stock gets its own reminder the
-- business day before that stock's earnings report. Report dates aren't stored; the job fetches them
-- from FMP on each run.
-- Applied to project lvnjktznlvuoghciqluu on 2026-11-01.

create table public.earnings_notifications (
  id bigint generated always as identity primary key,
  playbook_id bigint not null references public.playbooks (id) on delete cascade,
  symbol text not null,
  report_date date not null,
  email text not null,
  sent_at timestamptz not null default now(),
  unique (playbook_id, symbol, report_date)
);

-- Only the server (service-role key) writes reminders; a user may read the ones for their playbooks.
alter table public.earnings_notifications enable row level security;

create policy "Users read their earnings reminders" on public.earnings_notifications
  for select to authenticated using (email = (select auth.jwt() ->> 'email'));

-- Daily at 12:00 UTC, Monday-Friday (before the US open): email reminders for stocks reporting the next
-- business day. Friday's run covers weekend and Monday reports. Same Vault secret as the stock check.
select cron.schedule(
  'earnings-reminders',
  '0 12 * * 1-5',
  $$
  select net.http_get(
    url := 'https://stock-alerts-alpha.vercel.app/api/cron/earnings',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'CRON_SECRET')
    ),
    timeout_milliseconds := 60000
  );
  $$
);
