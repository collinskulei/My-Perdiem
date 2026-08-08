-- Milestone 3 support: admin-invite flow needs to create participants rows
-- before the invitee has filled in their own phone/ID (unlike self-registered
-- client_users), and Super Admins need a minimal per-client "work types" list.

-- --- Relax phone_number/id_number to nullable ---
--
-- These were NOT NULL + UNIQUE because the self-registration wizard collects
-- them from every client_user. Admin-tier accounts (super_admin/client_admin)
-- are created via invite, with no phone/ID available at invite time. NULL is
-- safe under a standard unique index (multiple NULLs don't collide), so this
-- only removes a constraint - no data is changed for existing rows.

alter table public.participants alter column phone_number drop not null;
alter table public.participants alter column id_number drop not null;

-- --- Work types (minimal - Milestone 5 will extend this) ---

create table if not exists public.work_types (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id),
  name text not null,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

create index if not exists work_types_client_id_idx on public.work_types (client_id);

alter table public.work_types enable row level security;

-- Read: any admin tier with access to the client (super/master admin, or
-- that client's client_admin). client_user read access is deferred to
-- Milestone 5, alongside the real document-submission feature that needs it.
create policy "Read work types in scope" on public.work_types
  for select
  using (public.can_access_client(client_id));

-- Write: Super Admin and above only, per the Milestone 3 scope (client_admin
-- does not manage their own client's work types yet).
create policy "Super admins and above insert work types" on public.work_types
  for insert
  with check (public.is_super_admin_or_above());

create policy "Super admins and above update work types" on public.work_types
  for update
  using (public.is_super_admin_or_above());

create policy "Super admins and above delete work types" on public.work_types
  for delete
  using (public.is_super_admin_or_above());
