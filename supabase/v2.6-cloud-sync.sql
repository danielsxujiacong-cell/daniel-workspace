-- Daniel Workspace V2.6 cloud data.
-- Run this once in Supabase Dashboard -> SQL Editor as the project owner.
-- Local paths, Companion scans, Git status, HEADs, and scan caches are intentionally absent.

begin;

create table if not exists public.workspace_tasks (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default '',
  project_id text not null default '',
  status text not null default 'todo',
  priority text not null default '中',
  due text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.workspace_knowledge (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null default '笔记',
  title text not null default '',
  content text not null default '',
  summary text not null default '',
  tags jsonb not null default '[]'::jsonb check (jsonb_typeof(tags) = 'array'),
  project_id text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.workspace_decisions (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  question text not null default '',
  options jsonb not null default '[]'::jsonb check (jsonb_typeof(options) = 'array'),
  goal text not null default '',
  time_estimate text not null default '',
  cost text not null default '',
  risk text not null default '',
  recommendation text not null default '',
  final_decision text not null default '',
  reason text not null default '',
  project_id text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.workspace_projects (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null default '',
  description text not null default '',
  status text not null default '计划中',
  stage text not null default '',
  next_step text not null default '',
  github_url text not null default '',
  website_url text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create or replace function public.workspace_touch_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists workspace_tasks_touch_updated_at on public.workspace_tasks;
create trigger workspace_tasks_touch_updated_at before update on public.workspace_tasks
for each row execute function public.workspace_touch_updated_at();

drop trigger if exists workspace_knowledge_touch_updated_at on public.workspace_knowledge;
create trigger workspace_knowledge_touch_updated_at before update on public.workspace_knowledge
for each row execute function public.workspace_touch_updated_at();

drop trigger if exists workspace_decisions_touch_updated_at on public.workspace_decisions;
create trigger workspace_decisions_touch_updated_at before update on public.workspace_decisions
for each row execute function public.workspace_touch_updated_at();

drop trigger if exists workspace_projects_touch_updated_at on public.workspace_projects;
create trigger workspace_projects_touch_updated_at before update on public.workspace_projects
for each row execute function public.workspace_touch_updated_at();

alter table public.workspace_tasks enable row level security;
alter table public.workspace_knowledge enable row level security;
alter table public.workspace_decisions enable row level security;
alter table public.workspace_projects enable row level security;

drop policy if exists workspace_tasks_user_owns_row on public.workspace_tasks;
create policy workspace_tasks_user_owns_row on public.workspace_tasks
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists workspace_knowledge_user_owns_row on public.workspace_knowledge;
create policy workspace_knowledge_user_owns_row on public.workspace_knowledge
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists workspace_decisions_user_owns_row on public.workspace_decisions;
create policy workspace_decisions_user_owns_row on public.workspace_decisions
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists workspace_projects_user_owns_row on public.workspace_projects;
create policy workspace_projects_user_owns_row on public.workspace_projects
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

revoke all on table public.workspace_tasks from anon, public;
revoke all on table public.workspace_knowledge from anon, public;
revoke all on table public.workspace_decisions from anon, public;
revoke all on table public.workspace_projects from anon, public;

grant select, insert, update, delete on table public.workspace_tasks to authenticated;
grant select, insert, update, delete on table public.workspace_knowledge to authenticated;
grant select, insert, update, delete on table public.workspace_decisions to authenticated;
grant select, insert, update, delete on table public.workspace_projects to authenticated;

notify pgrst, 'reload schema';

commit;
