-- Daniel Workspace V2.8: persist AI task context and an idempotency key.
-- Run once in Supabase Dashboard -> SQL Editor after reviewing the change.
-- Existing user-scoped RLS policies and all V2.6 rows remain unchanged.

begin;

alter table public.workspace_tasks
  add column if not exists description text not null default '',
  add column if not exists source_key text not null default '';

create unique index if not exists workspace_tasks_user_source_key
  on public.workspace_tasks (user_id, source_key)
  where source_key <> '';

commit;
