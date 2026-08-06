-- Multi-tenant, 4-tier access model.
--
-- Replaces the single global `role = 'Admin'` flag with a proper hierarchy:
--   master_admin (the firm's developer, sees everything)
--   > super_admin (firm staff; manages clients and client_admins)
--   > client_admin (scoped to one client; manages that client's users)
--   > client_user (a client's end participant; unaffected by this hierarchy)
--
-- The old `participants.role` column was overloaded: it held a free-text job
-- "designation" AND doubled as the admin/participant access flag. This
-- migration splits that into `designation` (unchanged, cosmetic) and a real
-- `access_tier` enum, and adds `client_id` for tenant scoping.

create extension if not exists pgcrypto;

-- --- Clients (tenants) ---

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

alter table public.clients enable row level security;

-- --- Drop every existing policy so we can safely rename/alter columns and
-- --- drop is_admin() without a dependent-object error. ---

drop policy if exists "Participants can create their own row" on public.participants;
drop policy if exists "Participants can read own row, admins read all" on public.participants;
drop policy if exists "Participants can update own row, admins update all" on public.participants;
drop policy if exists "Participants can delete own row" on public.participants;

drop policy if exists "Authenticated users can read venues" on public.venues;
drop policy if exists "Admins insert venues" on public.venues;
drop policy if exists "Admins update venues" on public.venues;
drop policy if exists "Admins delete venues" on public.venues;

drop policy if exists "Admins read all events, participants read their own" on public.events;
drop policy if exists "Admins create events" on public.events;
drop policy if exists "Admins delete events" on public.events;
drop policy if exists "Authenticated users can update events" on public.events;

drop policy if exists "Participants create their own requests" on public.perdiem_requests;
drop policy if exists "Participants read own requests, admins read all" on public.perdiem_requests;
drop policy if exists "Admins update requests" on public.perdiem_requests;
drop policy if exists "Admins delete requests" on public.perdiem_requests;

drop function if exists public.is_admin();

-- --- Split participants.role into designation (cosmetic) + access_tier (real) ---

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'participants' and column_name = 'role'
  ) then
    alter table public.participants rename column role to designation;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'access_tier') then
    create type public.access_tier as enum ('master_admin', 'super_admin', 'client_admin', 'client_user');
  end if;
end $$;

alter table public.participants add column if not exists access_tier public.access_tier not null default 'client_user';
alter table public.participants add column if not exists client_id uuid references public.clients (id);

-- --- One-time data migration: seed a placeholder client for the existing
-- --- (previously single-tenant) deployment, backfill everyone into it, then
-- --- promote the previous 'Admin' rows to client_admin and seed the root
-- --- master_admin. Must run before the CHECK constraint below is added,
-- --- since the constraint validates all existing rows. ---

insert into public.clients (id, name)
values ('00000000-0000-0000-0000-000000000001', 'Default Client (migrated)')
on conflict (id) do nothing;

update public.participants
  set client_id = '00000000-0000-0000-0000-000000000001'
  where client_id is null;

update public.participants
  set access_tier = 'client_admin'
  where designation = 'Admin';

update public.participants
  set access_tier = 'master_admin', client_id = null
  where email = 'collins.kulei@iacentre.co.ke';

alter table public.participants drop constraint if exists participants_client_scope_chk;
alter table public.participants add constraint participants_client_scope_chk check (
  (access_tier in ('master_admin', 'super_admin') and client_id is null)
  or (access_tier in ('client_admin', 'client_user') and client_id is not null)
);

-- --- Tenant scope on events / perdiem_requests ---

alter table public.events add column if not exists client_id uuid references public.clients (id);
update public.events set client_id = '00000000-0000-0000-0000-000000000001' where client_id is null;
alter table public.events alter column client_id set not null;

alter table public.perdiem_requests add column if not exists client_id uuid references public.clients (id);
update public.perdiem_requests set client_id = '00000000-0000-0000-0000-000000000001' where client_id is null;
alter table public.perdiem_requests alter column client_id set not null;

create index if not exists events_client_id_idx on public.events (client_id);
create index if not exists perdiem_requests_client_id_idx on public.perdiem_requests (client_id);
create index if not exists participants_client_id_idx on public.participants (client_id);

-- --- Helper functions (successors to is_admin()) ---

create or replace function public.current_tier()
returns public.access_tier
language sql stable security definer set search_path = public as $$
  select access_tier from public.participants where id = auth.uid();
$$;

create or replace function public.current_client_id()
returns uuid
language sql stable security definer set search_path = public as $$
  select client_id from public.participants where id = auth.uid();
$$;

create or replace function public.is_super_admin_or_above()
returns boolean
language sql stable security definer set search_path = public as $$
  select public.current_tier() in ('master_admin', 'super_admin');
$$;

create or replace function public.can_access_client(target_client uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_super_admin_or_above()
      or (public.current_tier() = 'client_admin' and public.current_client_id() = target_client);
$$;

-- Bypasses RLS to check a client exists/is active - used by the participants
-- INSERT policy below, where the registering user has no participants row yet
-- (so can_access_client() would otherwise always be false).
create or replace function public.client_exists(target_client uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.clients where id = target_client and archived_at is null);
$$;

-- Public (anon-callable) lookup used by the registration page to validate and
-- display a client's name from an invite link, before the user has an account.
create or replace function public.get_public_client_name(target_client uuid)
returns text
language sql stable security definer set search_path = public as $$
  select name from public.clients where id = target_client and archived_at is null;
$$;
revoke all on function public.get_public_client_name(uuid) from public;
grant execute on function public.get_public_client_name(uuid) to anon, authenticated;

-- --- Self-promotion hardening: block direct writes to access_tier/client_id ---

create or replace function public.guard_participant_privilege_columns()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'UPDATE' and (new.access_tier is distinct from old.access_tier
                            or new.client_id is distinct from old.client_id) then
    if coalesce(current_setting('app.bypass_tier_guard', true), '') <> 'on'
       and auth.role() <> 'service_role' then
      raise exception 'access_tier/client_id can only change via public.set_access_tier()';
    end if;
  elsif TG_OP = 'INSERT' and new.access_tier <> 'client_user' then
    if auth.role() <> 'service_role' then
      raise exception 'Self-registration must be access_tier = client_user';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists participants_guard_privilege_columns on public.participants;
create trigger participants_guard_privilege_columns
  before insert or update on public.participants
  for each row execute function public.guard_participant_privilege_columns();

-- The only legal path to change access_tier/client_id. Enforces the hierarchy:
-- master_admin is unrestricted; super_admin may only assign client_admin/
-- client_user and can never touch master_admin/super_admin rows; client_admin
-- has no tier-change privilege at all. Nobody may target themselves.
create or replace function public.set_access_tier(
  target_participant uuid,
  new_tier public.access_tier,
  new_client_id uuid default null
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  caller_tier public.access_tier := public.current_tier();
  target_current public.access_tier;
begin
  if target_participant = auth.uid() then
    raise exception 'Cannot change your own access tier';
  end if;

  select access_tier into target_current from public.participants where id = target_participant;
  if target_current is null then
    raise exception 'Participant not found';
  end if;

  if caller_tier = 'master_admin' then
    null;
  elsif caller_tier = 'super_admin' then
    if new_tier not in ('client_admin', 'client_user') then
      raise exception 'Super Admins may only assign Client Admin or Client User';
    end if;
    if target_current in ('master_admin', 'super_admin') then
      raise exception 'Super Admins cannot modify Master/Super Admin accounts';
    end if;
  else
    raise exception 'Insufficient privileges';
  end if;

  perform set_config('app.bypass_tier_guard', 'on', true);
  update public.participants
    set access_tier = new_tier,
        client_id = case when new_tier in ('master_admin', 'super_admin') then null else coalesce(new_client_id, client_id) end
    where id = target_participant;
end;
$$;
revoke all on function public.set_access_tier(uuid, public.access_tier, uuid) from public;
grant execute on function public.set_access_tier(uuid, public.access_tier, uuid) to authenticated;

-- --- RLS policies (rewritten around the tier/tenant model) ---

create policy "Participants can create their own row" on public.participants
  for insert
  with check (
    auth.uid() = id
    and access_tier = 'client_user'
    and client_id is not null
    and public.client_exists(client_id)
  );

create policy "Read participants in scope" on public.participants
  for select
  using (
    auth.uid() = id
    or public.is_super_admin_or_above()
    or public.can_access_client(client_id)
  );

create policy "Update participants in scope" on public.participants
  for update
  using (
    auth.uid() = id
    or public.is_super_admin_or_above()
    or public.can_access_client(client_id)
  );

create policy "Participants can delete own row" on public.participants
  for delete
  using (auth.uid() = id);

-- Clients: any tier can read their own client's row (or, for master/super
-- admin, any client); only super_admin/master_admin manage the client list.
create policy "Read own client, admins read all" on public.clients
  for select
  using (public.can_access_client(id));

create policy "Super admins and above create clients" on public.clients
  for insert
  with check (public.is_super_admin_or_above());

create policy "Super admins and above update clients" on public.clients
  for update
  using (public.is_super_admin_or_above());

-- Venues: unchanged shared/global directory - any authenticated user reads,
-- any admin tier (not client_user) writes.
create policy "Authenticated users can read venues" on public.venues
  for select
  using (auth.role() = 'authenticated');

create policy "Admin tiers insert venues" on public.venues
  for insert
  with check (public.current_tier() <> 'client_user');

create policy "Admin tiers update venues" on public.venues
  for update
  using (public.current_tier() <> 'client_user');

create policy "Admin tiers delete venues" on public.venues
  for delete
  using (public.current_tier() <> 'client_user');

-- Events: tenant-scoped. The old "any authenticated user can update any event"
-- policy was a cross-tenant hole once client_id exists - tightened to admins
-- of that event's client, or a participant checking themselves in.
create policy "Tenant-scoped event read" on public.events
  for select
  using (public.can_access_client(client_id) or auth.uid()::text = any (allocated_participants));

create policy "Tenant-scoped event insert" on public.events
  for insert
  with check (public.can_access_client(client_id));

create policy "Tenant-scoped event update" on public.events
  for update
  using (public.can_access_client(client_id) or auth.uid()::text = any (allocated_participants));

create policy "Tenant-scoped event delete" on public.events
  for delete
  using (public.can_access_client(client_id));

-- Per diem requests: tenant-scoped, same shape as events. A participant may
-- only file a request under their own client_id (prevents cross-tenant writes).
create policy "Participants create their own requests" on public.perdiem_requests
  for insert
  with check (participant_id = auth.uid() and client_id = public.current_client_id());

create policy "Tenant-scoped request read" on public.perdiem_requests
  for select
  using (participant_id = auth.uid() or public.can_access_client(client_id));

create policy "Tenant-scoped request update" on public.perdiem_requests
  for update
  using (public.can_access_client(client_id));

create policy "Tenant-scoped request delete" on public.perdiem_requests
  for delete
  using (public.can_access_client(client_id));
