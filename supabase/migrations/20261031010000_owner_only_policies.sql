-- Replace the open ("true") policies with owner-only ones: a logged-in user can only see and change
-- their own playbooks, the steps (alerts) in them and the links (alert_transitions) between those steps.
-- Ownership is the playbook's / alert's email matching the login's email. Logged-out visitors get nothing.
-- The cron job uses the service-role key, which bypasses these policies.
-- Applied to project lvnjktznlvuoghciqluu on 2026-10-31.

-- Old open policies.
drop policy if exists "Enable delete for users based on user_id" on public.playbooks;      -- was ALL, for public
drop policy if exists "Enable insert for authenticated users only" on public.playbooks;
drop policy if exists "Enable read access for all users" on public.playbooks;

drop policy if exists "Enable delete for users based on user_id" on public.alerts;
drop policy if exists "Enable insert for authenticated users only" on public.alerts;
drop policy if exists "Allow reading alerts" on public.alerts;
drop policy if exists "Authenticated users can read alerts" on public.alerts;
drop policy if exists "Authenticated users can update alerts" on public.alerts;

drop policy if exists "Enable delete for users based on user_id" on public.alert_transitions;
drop policy if exists "Enable insert for authenticated users only" on public.alert_transitions;
drop policy if exists "Enable read access for all users" on public.alert_transitions;

-- playbooks: rows whose email is the login's.
create policy "Users read their playbooks" on public.playbooks
  for select to authenticated using (email = (select auth.jwt() ->> 'email'));
create policy "Users create their playbooks" on public.playbooks
  for insert to authenticated with check (email = (select auth.jwt() ->> 'email'));
create policy "Users update their playbooks" on public.playbooks
  for update to authenticated
  using (email = (select auth.jwt() ->> 'email'))
  with check (email = (select auth.jwt() ->> 'email'));
create policy "Users delete their playbooks" on public.playbooks
  for delete to authenticated using (email = (select auth.jwt() ->> 'email'));

-- alerts (steps): the login's own, and new/changed ones must sit in one of the login's playbooks.
create policy "Users read their steps" on public.alerts
  for select to authenticated using (email = (select auth.jwt() ->> 'email'));
create policy "Users create steps in their playbooks" on public.alerts
  for insert to authenticated with check (
    email = (select auth.jwt() ->> 'email')
    and exists (select 1 from public.playbooks p
                where p.id = alerts.playbook_id and p.email = (select auth.jwt() ->> 'email'))
  );
create policy "Users update their steps" on public.alerts
  for update to authenticated
  using (email = (select auth.jwt() ->> 'email'))
  with check (
    email = (select auth.jwt() ->> 'email')
    and exists (select 1 from public.playbooks p
                where p.id = alerts.playbook_id and p.email = (select auth.jwt() ->> 'email'))
  );
create policy "Users delete their steps" on public.alerts
  for delete to authenticated using (email = (select auth.jwt() ->> 'email'));

-- alert_transitions (links): those in the login's playbooks. The update policy already exists
-- ("Users update transitions in their playbooks", 20261031000000).
create policy "Users read transitions in their playbooks" on public.alert_transitions
  for select to authenticated using (exists (
    select 1 from public.playbooks p
    where p.id = alert_transitions.playbook_id and p.email = (select auth.jwt() ->> 'email')));
create policy "Users create transitions in their playbooks" on public.alert_transitions
  for insert to authenticated with check (exists (
    select 1 from public.playbooks p
    where p.id = alert_transitions.playbook_id and p.email = (select auth.jwt() ->> 'email')));
create policy "Users delete transitions in their playbooks" on public.alert_transitions
  for delete to authenticated using (exists (
    select 1 from public.playbooks p
    where p.id = alert_transitions.playbook_id and p.email = (select auth.jwt() ->> 'email')));
