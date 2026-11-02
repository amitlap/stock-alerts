-- Telegram: a login can link a Telegram chat, and alerts and earnings reminders then go there too.
-- One row per login email (the same ownership key as playbooks). "Connect Telegram" stores a one-time
-- link_token; the user opens t.me/<bot>?start=<token>, and the bot's webhook matches the token and
-- saves the chat_id.
-- Applied to project lvnjktznlvuoghciqluu on 2026-11-02.

create table public.telegram_links (
  email text primary key,
  chat_id bigint,
  link_token text unique,
  link_token_created_at timestamptz,
  linked_at timestamptz
);

-- Only the server (service-role key) writes links; a user may read their own.
alter table public.telegram_links enable row level security;

create policy "Users read their telegram link" on public.telegram_links
  for select to authenticated using (email = (select auth.jwt() ->> 'email'));
