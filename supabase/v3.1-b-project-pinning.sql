-- Add per-project homepage pinning. Existing project rows remain unchanged;
-- all current and future rows default to unpinned.
alter table public.workspace_projects
  add column if not exists is_pinned boolean not null default false;
