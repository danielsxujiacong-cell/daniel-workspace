-- Isolated, public-safe immutable releases. No private business table privileges change.
begin;
create table public.workspace_public_snapshot_versions (
 version text primary key check (version ~ '^v48-[a-f0-9]{32}$'),
 snapshot jsonb not null check (jsonb_typeof(snapshot)='object' and octet_length(snapshot::text)<=900000),
 published_at timestamptz not null default now()
);
create table public.workspace_public_snapshot_current (
 singleton boolean primary key default true check (singleton),
 version text references public.workspace_public_snapshot_versions(version),
 previous_version text references public.workspace_public_snapshot_versions(version)
);
alter table public.workspace_public_snapshot_versions enable row level security;
alter table public.workspace_public_snapshot_current enable row level security;
revoke all on public.workspace_public_snapshot_versions,public.workspace_public_snapshot_current from public,anon,authenticated;
grant select on public.workspace_public_snapshot_versions,public.workspace_public_snapshot_current to anon,authenticated;
grant insert on public.workspace_public_snapshot_versions to authenticated;
grant update on public.workspace_public_snapshot_current to authenticated;
create policy public_read on public.workspace_public_snapshot_versions for select to anon,authenticated using (true);
create policy owner_insert on public.workspace_public_snapshot_versions for insert to authenticated with check ((select auth.uid())='9dd41e63-bdbd-405c-8243-ebe7de99fcf9'::uuid);
create policy public_read on public.workspace_public_snapshot_current for select to anon,authenticated using (true);
create policy owner_switch on public.workspace_public_snapshot_current for update to authenticated using ((select auth.uid())='9dd41e63-bdbd-405c-8243-ebe7de99fcf9'::uuid) with check ((select auth.uid())='9dd41e63-bdbd-405c-8243-ebe7de99fcf9'::uuid);
insert into public.workspace_public_snapshot_current(singleton) values(true);
create function public.workspace_publish_public_snapshot(document jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare release_version text; saved jsonb; current_version text;
begin
 if auth.uid() is distinct from '9dd41e63-bdbd-405c-8243-ebe7de99fcf9'::uuid then raise exception 'owner_required' using errcode='42501'; end if;
 if document->>'schemaVersion' is distinct from '2'
 or jsonb_typeof(document->'projects') is distinct from 'array'
 or jsonb_array_length(document->'projects') <> 26
 or jsonb_typeof(document->'knowledge') is distinct from 'array'
 or jsonb_typeof(document->'decisions') is distinct from 'array'
 or octet_length(document::text)>900000
 or exists(select 1 from jsonb_object_keys(document) k where k not in ('schemaVersion','generatedAt','publishedAt','projects','tasks','workLogs','knowledge','decisions','summaries','activity','deliveries','publication'))
 then raise exception 'invalid_snapshot' using errcode='22023'; end if;
 -- Row lock serializes pointer changes. Insert, read-back check and switch commit together.
 select version into current_version from public.workspace_public_snapshot_current where singleton for update;
 release_version := 'v48-' || md5(document::text);
 select snapshot into saved from public.workspace_public_snapshot_versions where version=release_version;
 if saved is null then
  saved := document || jsonb_build_object('snapshotVersion',release_version,'publishedAt',to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
  insert into public.workspace_public_snapshot_versions(version,snapshot) values(release_version,saved);
  if not exists(select 1 from public.workspace_public_snapshot_versions where version=release_version and snapshot=saved) then raise exception 'readback_failed'; end if;
 end if;
 if current_version is distinct from release_version then
  -- Never reactivate an old retry after a newer release has committed.
  if current_version is not null and (select published_at from public.workspace_public_snapshot_versions where version=current_version) > (select published_at from public.workspace_public_snapshot_versions where version=release_version) then raise exception 'superseded_release'; end if;
  update public.workspace_public_snapshot_current set previous_version=current_version,version=release_version where singleton;
 end if;
 return saved;
end $$;
revoke all on function public.workspace_publish_public_snapshot(jsonb) from public,anon;
grant execute on function public.workspace_publish_public_snapshot(jsonb) to authenticated;
commit;
