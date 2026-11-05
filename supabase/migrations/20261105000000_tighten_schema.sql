-- Tighten the schema (safe with the code already deployed):
--   * alerts.price was bigint, so a decimal trigger price like 240.5 couldn't be saved; it's numeric now.
--   * Columns every row needs are NOT NULL, the operator is only > or <, a step can't start after itself,
--     and a link between two steps exists once.
--   * Indexes for the foreign keys and the email lookups that row-level security and the jobs do.
--   * Steps' policies check the step's playbook (as transitions' already did), so they no longer depend on
--     alerts.email, which only ever copied the playbook's email; 20261105010000 drops that column.
--   * Policies call auth.jwt() once per query instead of once per row.
-- Applied to project lvnjktznlvuoghciqluu on 2026-11-05.

begin;

-- Columns
alter table public.alerts alter column price type numeric using price::numeric;
alter table public.alerts alter column price drop default;
alter table public.alerts alter column stock set not null;
alter table public.alerts alter column price set not null;
alter table public.alerts alter column operator set not null;
alter table public.alerts alter column operator set default '>';
alter table public.alerts alter column "isActive" set not null;
alter table public.alerts add constraint alerts_operator_check check (operator in ('>', '<'));

alter table public.playbooks alter column name set not null;
alter table public.playbooks alter column email set not null;

alter table public.alert_transitions alter column playbook_id set not null;
alter table public.alert_transitions alter column source_alert_id set not null;
alter table public.alert_transitions alter column target_alert_id set not null;
alter table public.alert_transitions add constraint alert_transitions_not_self check (source_alert_id <> target_alert_id);
-- Also serves as the index on source_alert_id.
alter table public.alert_transitions
  add constraint alert_transitions_source_target_key unique (source_alert_id, target_alert_id);

-- Indexes
create index alerts_playbook_id_idx on public.alerts (playbook_id);
create index alert_transitions_target_alert_id_idx on public.alert_transitions (target_alert_id);
create index alert_transitions_playbook_id_idx on public.alert_transitions (playbook_id);
create index playbooks_email_idx on public.playbooks (email);
create index telegram_links_chat_id_idx on public.telegram_links (chat_id);

-- Policies: ownership is the playbook's email matching the login's email.
drop policy "Users read their playbooks" on public.playbooks;
drop policy "Users create their playbooks" on public.playbooks;
drop policy "Users update their playbooks" on public.playbooks;
drop policy "Users delete their playbooks" on public.playbooks;
create policy "Users read their playbooks" on public.playbooks
  for select to authenticated using (email = ((select auth.jwt()) ->> 'email'));
create policy "Users create their playbooks" on public.playbooks
  for insert to authenticated with check (email = ((select auth.jwt()) ->> 'email'));
create policy "Users update their playbooks" on public.playbooks
  for update to authenticated
  using (email = ((select auth.jwt()) ->> 'email'))
  with check (email = ((select auth.jwt()) ->> 'email'));
create policy "Users delete their playbooks" on public.playbooks
  for delete to authenticated using (email = ((select auth.jwt()) ->> 'email'));

drop policy "Users read their steps" on public.alerts;
drop policy "Users create steps in their playbooks" on public.alerts;
drop policy "Users update their steps" on public.alerts;
drop policy "Users delete their steps" on public.alerts;
create policy "Users read their steps" on public.alerts
  for select to authenticated using (exists (
    select 1 from public.playbooks p
    where p.id = alerts.playbook_id and p.email = ((select auth.jwt()) ->> 'email')));
create policy "Users create steps in their playbooks" on public.alerts
  for insert to authenticated with check (exists (
    select 1 from public.playbooks p
    where p.id = alerts.playbook_id and p.email = ((select auth.jwt()) ->> 'email')));
create policy "Users update their steps" on public.alerts
  for update to authenticated
  using (exists (
    select 1 from public.playbooks p
    where p.id = alerts.playbook_id and p.email = ((select auth.jwt()) ->> 'email')))
  with check (exists (
    select 1 from public.playbooks p
    where p.id = alerts.playbook_id and p.email = ((select auth.jwt()) ->> 'email')));
create policy "Users delete their steps" on public.alerts
  for delete to authenticated using (exists (
    select 1 from public.playbooks p
    where p.id = alerts.playbook_id and p.email = ((select auth.jwt()) ->> 'email')));

drop policy "Users read transitions in their playbooks" on public.alert_transitions;
drop policy "Users create transitions in their playbooks" on public.alert_transitions;
drop policy "Users update transitions in their playbooks" on public.alert_transitions;
drop policy "Users delete transitions in their playbooks" on public.alert_transitions;
create policy "Users read transitions in their playbooks" on public.alert_transitions
  for select to authenticated using (exists (
    select 1 from public.playbooks p
    where p.id = alert_transitions.playbook_id and p.email = ((select auth.jwt()) ->> 'email')));
create policy "Users create transitions in their playbooks" on public.alert_transitions
  for insert to authenticated with check (exists (
    select 1 from public.playbooks p
    where p.id = alert_transitions.playbook_id and p.email = ((select auth.jwt()) ->> 'email')));
create policy "Users update transitions in their playbooks" on public.alert_transitions
  for update to authenticated
  using (exists (
    select 1 from public.playbooks p
    where p.id = alert_transitions.playbook_id and p.email = ((select auth.jwt()) ->> 'email')))
  with check (exists (
    select 1 from public.playbooks p
    where p.id = alert_transitions.playbook_id and p.email = ((select auth.jwt()) ->> 'email')));
create policy "Users delete transitions in their playbooks" on public.alert_transitions
  for delete to authenticated using (exists (
    select 1 from public.playbooks p
    where p.id = alert_transitions.playbook_id and p.email = ((select auth.jwt()) ->> 'email')));

drop policy "Users read their earnings reminders" on public.earnings_notifications;
create policy "Users read their earnings reminders" on public.earnings_notifications
  for select to authenticated using (email = ((select auth.jwt()) ->> 'email'));

drop policy "Users read their telegram link" on public.telegram_links;
create policy "Users read their telegram link" on public.telegram_links
  for select to authenticated using (email = ((select auth.jwt()) ->> 'email'));

commit;
