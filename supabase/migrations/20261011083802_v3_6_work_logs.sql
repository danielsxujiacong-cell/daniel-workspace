-- V3.6: per-user project work records. Existing Workspace rows are untouched.
begin;

create table if not exists public.workspace_work_logs (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id text not null,
  work_date date not null,
  completed_items text not null check (char_length(btrim(completed_items)) between 1 and 8000),
  outcomes text not null default '' check (char_length(outcomes) <= 8000),
  next_step text not null default '' check (char_length(next_step) <= 4000),
  evidence_links jsonb not null default '[]'::jsonb
    check (jsonb_typeof(evidence_links) = 'array' and jsonb_array_length(evidence_links) <= 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists workspace_work_logs_user_project_date_idx
  on public.workspace_work_logs (user_id, project_id, work_date desc, updated_at desc);

alter table public.workspace_work_logs enable row level security;

drop policy if exists workspace_work_logs_user_select on public.workspace_work_logs;
create policy workspace_work_logs_user_select on public.workspace_work_logs
for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists workspace_work_logs_user_insert on public.workspace_work_logs;
create policy workspace_work_logs_user_insert on public.workspace_work_logs
for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists workspace_work_logs_user_update on public.workspace_work_logs;
create policy workspace_work_logs_user_update on public.workspace_work_logs
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

revoke all on table public.workspace_work_logs from anon, authenticated, public;
grant select, insert, update on table public.workspace_work_logs to authenticated;

notify pgrst, 'reload schema';
commit;
