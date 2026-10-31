-- Logged-in users can update the links (transitions) of their own playbooks, e.g. a step's "why".
-- Applied to project lvnjktznlvuoghciqluu on 2026-10-31.
create policy "Users update transitions in their playbooks" on public.alert_transitions
  for update to authenticated
  using (exists (
    select 1 from public.playbooks p
    where p.id = alert_transitions.playbook_id
      and p.email = (select auth.jwt() ->> 'email')
  ))
  with check (exists (
    select 1 from public.playbooks p
    where p.id = alert_transitions.playbook_id
      and p.email = (select auth.jwt() ->> 'email')
  ));
