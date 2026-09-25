-- Deos Heartbeat Lite core schema (Technical Scope v1.0 §6)

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.van_status as enum ('active', 'paused', 'unassigned', 'removed');
create type public.user_role as enum ('admin', 'viewer');
create type public.report_type as enum ('daily', 'weekly');
create type public.report_run_status as enum ('success', 'failure');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.trusts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  daily_enabled boolean not null default true,
  weekly_enabled boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.vans (
  id uuid primary key default gen_random_uuid(),
  trust_id uuid references public.trusts (id) on delete set null,
  instance text not null unique,
  display_name text not null,
  modality_target text,
  daily_enabled boolean not null default true,
  weekly_enabled boolean not null default true,
  speed_floor numeric,
  status public.van_status not null default 'unassigned',
  created_at timestamptz not null default now(),
  constraint vans_active_needs_trust check (
    status <> 'active' or trust_id is not null
  )
);

create index vans_trust_id_idx on public.vans (trust_id);
create index vans_status_idx on public.vans (status);

create table public.recipients (
  id uuid primary key default gen_random_uuid(),
  trust_id uuid not null references public.trusts (id) on delete cascade,
  name text not null,
  email text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint recipients_email_lower check (email = lower(email))
);

create unique index recipients_trust_email_uidx
  on public.recipients (trust_id, email);

create table public.settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  role public.user_role not null default 'viewer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.report_runs (
  id uuid primary key default gen_random_uuid(),
  trust_id uuid not null references public.trusts (id) on delete cascade,
  report_type public.report_type not null,
  run_at timestamptz not null default now(),
  status public.report_run_status not null,
  error text,
  created_at timestamptz not null default now()
);

create index report_runs_trust_type_run_at_idx
  on public.report_runs (trust_id, report_type, run_at desc);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  at timestamptz not null default now(),
  user_id uuid references auth.users (id) on delete set null,
  action text not null,
  entity text not null,
  entity_id uuid,
  before jsonb,
  after jsonb
);

create index audit_log_at_idx on public.audit_log (at desc);
create index audit_log_entity_idx on public.audit_log (entity, entity_id);

-- ---------------------------------------------------------------------------
-- Default settings (fleet thresholds — confirm with Viv in UI sessions)
-- ---------------------------------------------------------------------------

insert into public.settings (key, value) values
  (
    'fleet_thresholds',
    jsonb_build_object(
      'speed_floor_mbps', 0.5,
      'failed_queue_amber', 1,
      'retry_queue_amber', 1,
      'progress_amber_pct', 50,
      'scrape_stale_minutes', 10,
      'poll_interval_seconds', 60
    )
  );

-- ---------------------------------------------------------------------------
-- Role helpers (profiles.role — not user_metadata)
-- ---------------------------------------------------------------------------

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

revoke all on function public.current_user_role() from public;
grant execute on function public.current_user_role() to authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create or replace function public.is_authenticated_reader()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'viewer')
  );
$$;

revoke all on function public.is_authenticated_reader() from public;
grant execute on function public.is_authenticated_reader() to authenticated;

-- ---------------------------------------------------------------------------
-- Auth → profiles sync
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_role public.user_role := 'viewer';
  meta_role text;
begin
  meta_role := new.raw_app_meta_data ->> 'role';
  if meta_role in ('admin', 'viewer') then
    next_role := meta_role::public.user_role;
  end if;

  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    next_role
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    role = excluded.role,
    updated_at = now();

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Audit trigger (insert-only log; cannot be bypassed by app bugs)
-- ---------------------------------------------------------------------------

create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  entity_name text := tg_table_name;
  row_id uuid;
  action_name text;
begin
  if tg_op = 'INSERT' then
    action_name := 'insert';
    row_id := new.id;
    insert into public.audit_log (user_id, action, entity, entity_id, before, after)
    values (auth.uid(), action_name, entity_name, row_id, null, to_jsonb(new));
    return new;
  elsif tg_op = 'UPDATE' then
    action_name := 'update';
    row_id := new.id;
    insert into public.audit_log (user_id, action, entity, entity_id, before, after)
    values (auth.uid(), action_name, entity_name, row_id, to_jsonb(old), to_jsonb(new));
    return new;
  elsif tg_op = 'DELETE' then
    action_name := 'delete';
    row_id := old.id;
    insert into public.audit_log (user_id, action, entity, entity_id, before, after)
    values (auth.uid(), action_name, entity_name, row_id, to_jsonb(old), null);
    return old;
  end if;
  return null;
end;
$$;

create trigger trusts_audit
  after insert or update or delete on public.trusts
  for each row execute function public.audit_row_change();

create trigger vans_audit
  after insert or update or delete on public.vans
  for each row execute function public.audit_row_change();

create trigger recipients_audit
  after insert or update or delete on public.recipients
  for each row execute function public.audit_row_change();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.trusts enable row level security;
alter table public.vans enable row level security;
alter table public.recipients enable row level security;
alter table public.settings enable row level security;
alter table public.profiles enable row level security;
alter table public.report_runs enable row level security;
alter table public.audit_log enable row level security;

-- trusts
create policy trusts_select on public.trusts
  for select to authenticated
  using (public.is_authenticated_reader());

create policy trusts_insert on public.trusts
  for insert to authenticated
  with check (public.is_admin());

create policy trusts_update on public.trusts
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy trusts_delete on public.trusts
  for delete to authenticated
  using (public.is_admin());

-- vans
create policy vans_select on public.vans
  for select to authenticated
  using (public.is_authenticated_reader());

create policy vans_insert on public.vans
  for insert to authenticated
  with check (public.is_admin());

create policy vans_update on public.vans
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy vans_delete on public.vans
  for delete to authenticated
  using (public.is_admin());

-- recipients
create policy recipients_select on public.recipients
  for select to authenticated
  using (public.is_authenticated_reader());

create policy recipients_insert on public.recipients
  for insert to authenticated
  with check (public.is_admin());

create policy recipients_update on public.recipients
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy recipients_delete on public.recipients
  for delete to authenticated
  using (public.is_admin());

-- settings
create policy settings_select on public.settings
  for select to authenticated
  using (public.is_authenticated_reader());

create policy settings_write on public.settings
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- profiles
create policy profiles_select_own_or_admin on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

create policy profiles_update_own_or_admin on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (
    public.is_admin()
    or (id = auth.uid() and role = (select role from public.profiles p where p.id = auth.uid()))
  );

-- report_runs (workflow writes via service role / API; UI read)
create policy report_runs_select on public.report_runs
  for select to authenticated
  using (public.is_authenticated_reader());

create policy report_runs_admin_write on public.report_runs
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- audit_log: insert-only via trigger; readers can view; no update/delete
create policy audit_log_select on public.audit_log
  for select to authenticated
  using (public.is_authenticated_reader());

revoke insert, update, delete on public.audit_log from authenticated, anon;
grant select on public.audit_log to authenticated;

grant select, insert, update, delete on public.trusts to authenticated;
grant select, insert, update, delete on public.vans to authenticated;
grant select, insert, update, delete on public.recipients to authenticated;
grant select, insert, update, delete on public.settings to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.report_runs to authenticated;
