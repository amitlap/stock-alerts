-- Drop two columns nothing reads any more. Apply only after the code that stops using them is deployed.
--   * alerts.email only ever copied its playbook's email; the jobs now read the playbook's, and the
--     steps' policies check the playbook (20261105000000).
--   * alert_transitions.condition was never set or used: a transition always fires with its source step.
-- Applied to project lvnjktznlvuoghciqluu on 2026-11-05.

alter table public.alerts drop column email;
alter table public.alert_transitions drop column condition;
