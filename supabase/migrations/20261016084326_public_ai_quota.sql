-- Dedicated anonymous AI counters only. No business table references.
-- RLS denies direct table access; the fixed RPC can only reserve one call.
create table public.workspace_public_ai_quotas (
  bucket text not null,
  window_start timestamptz not null,
  used integer not null default 0 check (used between 0 and 100),
  primary key (bucket, window_start)
);
alter table public.workspace_public_ai_quotas enable row level security;
revoke all on public.workspace_public_ai_quotas from public, anon, authenticated;

create function public.workspace_reserve_public_ai_quota(client_hash text)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  day_start timestamptz := pg_catalog.date_trunc('day', pg_catalog.now() at time zone 'Asia/Shanghai') at time zone 'Asia/Shanghai';
  minute_start timestamptz := pg_catalog.date_trunc('minute', pg_catalog.now());
  global_used integer;
  daily_used integer;
  minute_used integer;
begin
  if client_hash is null or client_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid quota identifier' using errcode = '22023';
  end if;
  -- Transaction lock makes checks and reservations atomic across all instances.
  perform pg_catalog.pg_advisory_xact_lock(7270414501::bigint);
  insert into public.workspace_public_ai_quotas values ('global', day_start, 0) on conflict do nothing;
  select used into global_used from public.workspace_public_ai_quotas where bucket='global' and window_start=day_start;
  -- Denied calls cannot grow per-client rows after the global budget is spent.
  if global_used >= 100 then return false; end if;
  insert into public.workspace_public_ai_quotas values ('day:'||client_hash, day_start, 0) on conflict do nothing;
  select used into daily_used from public.workspace_public_ai_quotas where bucket='day:'||client_hash and window_start=day_start;
  if daily_used >= 15 then return false; end if;
  insert into public.workspace_public_ai_quotas values ('minute:'||client_hash, minute_start, 0) on conflict do nothing;
  select used into minute_used from public.workspace_public_ai_quotas where bucket='minute:'||client_hash and window_start=minute_start;
  if minute_used >= 3 then return false; end if;
  update public.workspace_public_ai_quotas set used=used+1
    where (bucket='global' and window_start=day_start)
       or (bucket='day:'||client_hash and window_start=day_start)
       or (bucket='minute:'||client_hash and window_start=minute_start);
  return true;
end;
$$;
revoke all on function public.workspace_reserve_public_ai_quota(text) from public, anon, authenticated;
grant execute on function public.workspace_reserve_public_ai_quota(text) to anon, authenticated;
comment on function public.workspace_reserve_public_ai_quota(text) is
  'Reserves one anonymous AI request: global 100/day, client 15/day and 3/minute. Returns boolean only; no business data access.';
