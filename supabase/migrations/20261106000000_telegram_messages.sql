-- Texts users send to the Telegram bot, shown in the app. One row per message per linked login (a chat
-- is normally linked to one login). Only the server (service-role key) writes them.
-- Applied to project lvnjktznlvuoghciqluu on 2026-11-06.

create table public.telegram_messages (
  id bigint generated always as identity primary key,
  email text not null,
  chat_id bigint not null,
  text text not null,
  received_at timestamptz not null default now()
);

create index telegram_messages_email_received_at_idx on public.telegram_messages (email, received_at desc);

alter table public.telegram_messages enable row level security;

create policy "Users read their telegram messages" on public.telegram_messages
  for select to authenticated using (email = ((select auth.jwt()) ->> 'email'));
