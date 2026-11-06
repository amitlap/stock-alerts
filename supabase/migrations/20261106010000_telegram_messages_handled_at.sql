-- An alert texted to the bot ("NVDA > 300") gets buttons: new playbook, or add it to an existing one.
-- handled_at records when one was tapped, so a second tap (or a retried update) can't add it twice.
-- Applied to project lvnjktznlvuoghciqluu on 2026-11-06.

alter table public.telegram_messages add column handled_at timestamptz;
