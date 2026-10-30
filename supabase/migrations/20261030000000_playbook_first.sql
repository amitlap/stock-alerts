-- Playbook-first: every alert is a step in a playbook, and steps record when they fired.
-- Run in the Supabase SQL editor (or `supabase db push`). It's wrapped in a transaction,
-- so it either applies fully or not at all.
--
-- Before running: check the foreign-key names below match yours
-- (Table editor → alerts / alert_transitions → foreign keys). The defaults Supabase
-- generates are used here.

begin;

-- 1. Wrap every standalone alert in its own one-step playbook.
alter table playbooks add column migrated_from_alert_id bigint;

insert into playbooks (name, description, email, migrated_from_alert_id)
select
  a.stock || ' ' || coalesce(a.operator, '>') || ' ' || a.price,
  coalesce(nullif(a.description, ''), 'Single-step playbook'),
  a.email,
  a.id
from alerts a
where a.playbook_id is null;

update alerts a
set playbook_id = p.id
from playbooks p
where p.migrated_from_alert_id = a.id;

alter table playbooks drop column migrated_from_alert_id;

-- 2. Every alert must belong to a playbook; deleting a playbook deletes its steps.
alter table alerts alter column playbook_id set not null;

alter table alerts drop constraint if exists alerts_playbook_id_fkey;
alter table alerts
  add constraint alerts_playbook_id_fkey
  foreign key (playbook_id) references playbooks (id) on delete cascade;

-- Deleting a step (or its playbook) also deletes the transitions that point at it.
alter table alert_transitions drop constraint if exists alert_transitions_playbook_id_fkey;
alter table alert_transitions
  add constraint alert_transitions_playbook_id_fkey
  foreign key (playbook_id) references playbooks (id) on delete cascade;

alter table alert_transitions drop constraint if exists alert_transitions_source_alert_id_fkey;
alter table alert_transitions
  add constraint alert_transitions_source_alert_id_fkey
  foreign key (source_alert_id) references alerts (id) on delete cascade;

alter table alert_transitions drop constraint if exists alert_transitions_target_alert_id_fkey;
alter table alert_transitions
  add constraint alert_transitions_target_alert_id_fkey
  foreign key (target_alert_id) references alerts (id) on delete cascade;

-- 3. When a step fired, so a playbook can show its progress (waiting → watching → done).
alter table alerts add column if not exists triggered_at timestamptz;

commit;
