-- Per-client modules. Until now the app was one product (per diem
-- payments) and every client got all of it. A client now has a set of
-- modules a Super Admin switches on from the Clients tab
-- (admin-clients-overview.tsx), each with its own dashboard:
--
--   'perdiem' - Per Diem Payments, everything the app did before this
--               migration (events, check-ins, requests, payments, imports)
--   'salary'  - Salary Payments, payroll record-keeping (0031)
--
-- Keep the key list in sync with MODULES in src/lib/modules.ts.
--
-- Existing clients are backfilled with 'perdiem' enabled, and new clients
-- get it automatically (trigger below), so nothing changes for anyone
-- until a Super Admin turns a module on or off. Turning a module off only
-- hides it - no data is deleted - and turning it back on restores it.
--
-- Per diem tables are deliberately NOT re-gated on has_module() in RLS:
-- their policies are load-bearing and long-tested (0003/0027), and hiding
-- the dashboard is enough for a module the client simply isn't using.
-- New modules (salary) gate their own tables on has_module() from day one.

create table if not exists public.client_modules (
  client_id uuid not null references public.clients (id) on delete cascade,
  module_key text not null check (module_key in ('perdiem', 'salary')),
  enabled boolean not null default true,
  updated_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  primary key (client_id, module_key)
);

alter table public.client_modules enable row level security;

drop policy if exists client_modules_select on public.client_modules;
create policy client_modules_select on public.client_modules
  for select using (public.can_access_client(client_id));

drop policy if exists client_modules_insert on public.client_modules;
create policy client_modules_insert on public.client_modules
  for insert with check ((select public.is_super_admin_or_above()));

drop policy if exists client_modules_update on public.client_modules;
create policy client_modules_update on public.client_modules
  for update using ((select public.is_super_admin_or_above()))
  with check ((select public.is_super_admin_or_above()));

drop policy if exists client_modules_delete on public.client_modules;
create policy client_modules_delete on public.client_modules
  for delete using ((select public.is_super_admin_or_above()));

-- Backfill: every existing client keeps Per Diem Payments.
insert into public.client_modules (client_id, module_key, enabled, updated_by)
select id, 'perdiem', true, null from public.clients
on conflict (client_id, module_key) do nothing;

-- New clients start with Per Diem Payments, same as every client before
-- modules existed. security definer so the insert isn't subject to the
-- caller's RLS (the client row itself was already RLS-checked).
create or replace function public.client_modules_default()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.client_modules (client_id, module_key, enabled)
  values (new.id, 'perdiem', true)
  on conflict (client_id, module_key) do nothing;
  return new;
end;
$$;

drop trigger if exists clients_default_modules on public.clients;
create trigger clients_default_modules
  after insert on public.clients
  for each row execute function public.client_modules_default();

-- Is this module switched on for this client? security definer so RLS
-- policies on other tables can call it without the caller needing their
-- own read access to client_modules.
create or replace function public.has_module(target_client uuid, p_module text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.client_modules
    where client_id = target_client and module_key = p_module and enabled
  );
$$;
