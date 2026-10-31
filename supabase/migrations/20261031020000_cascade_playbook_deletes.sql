-- Deleting a playbook deletes its steps (alerts) and links (alert_transitions); deleting a step
-- deletes the links into and out of it. Without this, deleting a playbook that still had steps
-- failed with: violates foreign key constraint "alerts_playbook_id_fkey".
-- Applied to project lvnjktznlvuoghciqluu on 2026-10-31.

alter table public.alerts
  drop constraint alerts_playbook_id_fkey,
  add constraint alerts_playbook_id_fkey
    foreign key (playbook_id) references public.playbooks (id) on delete cascade;

alter table public.alert_transitions
  drop constraint alert_transitions_playbook_id_fkey,
  add constraint alert_transitions_playbook_id_fkey
    foreign key (playbook_id) references public.playbooks (id) on delete cascade,
  drop constraint alert_transitions_source_alert_id_fkey,
  add constraint alert_transitions_source_alert_id_fkey
    foreign key (source_alert_id) references public.alerts (id) on delete cascade,
  drop constraint alert_transitions_target_alert_id_fkey,
  add constraint alert_transitions_target_alert_id_fkey
    foreign key (target_alert_id) references public.alerts (id) on delete cascade;
