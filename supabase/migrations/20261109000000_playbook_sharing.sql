-- Sharing playbooks with friends:
--   * playbooks.is_public: the owner opts each playbook in; playbooks stay private by default.
--   * playbook_viewers: "owner_email lets viewer_email see all of the owner's public playbooks".
--   * playbook_comments: messages on a playbook, for everyone who can see it.
-- Viewers only get new select policies, so every write to a playbook, step or link stays owner-only.
-- Applied to project lvnjktznlvuoghciqluu on 2026-11-09.

begin;

alter table public.playbooks add column is_public boolean not null default false;

create table public.playbook_viewers (
  owner_email text not null,
  viewer_email text not null check (viewer_email = lower(viewer_email)),
  created_at timestamptz not null default now(),
  primary key (owner_email, viewer_email),
  check (lower(owner_email) <> viewer_email)
);

create index playbook_viewers_viewer_email_idx on public.playbook_viewers (viewer_email);

alter table public.playbook_viewers enable row level security;

create policy "Owners and viewers read viewer links" on public.playbook_viewers
  for select to authenticated using (
    owner_email = ((select auth.jwt()) ->> 'email')
    or viewer_email = lower((select auth.jwt()) ->> 'email')
  );
create policy "Owners add viewers" on public.playbook_viewers
  for insert to authenticated with check (owner_email = ((select auth.jwt()) ->> 'email'));
create policy "Owners remove viewers" on public.playbook_viewers
  for delete to authenticated using (owner_email = ((select auth.jwt()) ->> 'email'));

create policy "Viewers read public playbooks" on public.playbooks
  for select to authenticated using (
    is_public and exists (
      select 1 from public.playbook_viewers v
      where v.owner_email = playbooks.email
        and v.viewer_email = lower((select auth.jwt()) ->> 'email')
    )
  );

-- These two go through the playbooks policy above: a row of playbooks is only visible here if the
-- login may read it.
create policy "Viewers read steps of public playbooks" on public.alerts
  for select to authenticated using (exists (
    select 1 from public.playbooks p where p.id = alerts.playbook_id and p.is_public));
create policy "Viewers read transitions of public playbooks" on public.alert_transitions
  for select to authenticated using (exists (
    select 1 from public.playbooks p where p.id = alert_transitions.playbook_id and p.is_public));

create table public.playbook_comments (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  playbook_id bigint not null references public.playbooks (id) on delete cascade,
  author_email text not null,
  body text not null check (char_length(body) between 1 and 2000)
);

create index playbook_comments_playbook_id_created_at_idx on public.playbook_comments (playbook_id, created_at);

alter table public.playbook_comments enable row level security;

-- Anyone who can read the playbook (its owner or a viewer) can read and post; "can read" is the
-- playbooks select policies again.
create policy "Readers of a playbook read its comments" on public.playbook_comments
  for select to authenticated using (exists (
    select 1 from public.playbooks p where p.id = playbook_comments.playbook_id));
create policy "Readers of a playbook post comments as themselves" on public.playbook_comments
  for insert to authenticated with check (
    author_email = ((select auth.jwt()) ->> 'email')
    and exists (select 1 from public.playbooks p where p.id = playbook_comments.playbook_id)
  );
create policy "Authors and playbook owners delete comments" on public.playbook_comments
  for delete to authenticated using (
    author_email = ((select auth.jwt()) ->> 'email')
    or exists (
      select 1 from public.playbooks p
      where p.id = playbook_comments.playbook_id and p.email = ((select auth.jwt()) ->> 'email')
    )
  );

commit;
