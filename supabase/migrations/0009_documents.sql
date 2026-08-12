-- Milestone 5, re-scoped: Microsoft OneDrive submission inbox (not a Supabase
-- Storage document portal - see docs/MILESTONE_HANDOFF.md's Milestone 5
-- section for the full rationale). A Client Admin uploads a raw payment-list
-- document directly in OneDrive's own UI, using a folder already recorded
-- against their client below; the app only tracks *that a submission
-- exists* and its processing status - the actual file bytes never pass
-- through this app or this database.

alter table public.clients add column if not exists onedrive_drive_id text;
alter table public.clients add column if not exists onedrive_folder_id text;
alter table public.clients add column if not exists onedrive_folder_link text;

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id),
  onedrive_item_id text not null,
  onedrive_file_name text not null,
  onedrive_web_url text,
  status text not null default 'submitted' check (status in ('submitted', 'processing', 'done')),
  onedrive_modified_at timestamptz,
  first_seen_at timestamptz not null default now(),
  processed_at timestamptz,
  processed_by uuid references public.participants (id),
  notes text,
  unique (client_id, onedrive_item_id)
);

create index if not exists documents_client_id_idx on public.documents (client_id);

alter table public.documents enable row level security;

-- Read: any admin tier with access to the client (super/master admin, or
-- that client's client_admin) - same shape as work_types' existing policy.
-- Never client_user: this is a Client-Admin-to-Super-Admin workflow, the
-- participant tier is not involved.
create policy "Read documents in scope" on public.documents
  for select
  using (public.can_access_client(client_id));

-- Insert: server-only, via the sync route's service-role client (a row must
-- correspond to a real file Microsoft Graph reported - never something a
-- client fabricates directly), so no authenticated-role insert policy exists.

-- Update: Super Admin and above only - a Client Admin can see their
-- submission's status but never marks their own submission processed/done.
create policy "Super admins and above update documents" on public.documents
  for update
  using (public.is_super_admin_or_above());
