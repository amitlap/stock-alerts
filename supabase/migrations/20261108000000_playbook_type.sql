-- Which kind of playbook this is (the template it was made from), so its page can show the right chart
-- indicators. Null for playbooks made before this column whose steps don't show a template.
-- Applied to project lvnjktznlvuoghciqluu on 2026-11-08.

alter table public.playbooks
  add column type text
  check (type in ('alert', 'custom', 'stepUp', 'dip', 'crash', 'bracket', 'breakout', 'support'));

-- Existing playbooks: templates write recognizable step descriptions.
update public.playbooks p
set type = template.type
from (
  values
    ('stepUp', '^Buy #[0-9]+: \+'),
    ('dip', '^Buy #[0-9]+: −'),
    ('crash', '^Down [0-9]+% from'),
    ('bracket', '^(Stop loss|Take profit):'),
    ('breakout', '^(Breakout|Retest):'),
    ('support', '^(Near support|Support broke)')
) as template(type, step_pattern)
where exists (
  select 1 from public.alerts a where a.playbook_id = p.id and a.description ~ template.step_pattern
);
