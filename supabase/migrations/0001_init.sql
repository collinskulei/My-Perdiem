-- Initial schema for MyPerdiem, migrated from Firestore.
-- Mirrors the collections that used to live in Firestore (participants,
-- venues, events, perdiemRequests) and the access rules that used to live in
-- firestore.rules, translated into Postgres tables + Row Level Security.

create extension if not exists pgcrypto;

-- Participants: one row per registered user, keyed by their Supabase Auth UID.
create table if not exists public.participants (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  phone_number text not null,
  id_number text not null,
  participant_number text,
  role text not null,
  duty_station text,
  avatar_url text not null,
  email text not null,
  job_group text,
  organization_name text,
  created_at timestamptz not null default now()
);

create unique index if not exists participants_email_key on public.participants (email);
create unique index if not exists participants_id_number_key on public.participants (id_number);
create unique index if not exists participants_phone_number_key on public.participants (phone_number);

-- Venues: locations where events are held.
create table if not exists public.venues (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  city text not null,
  county text not null,
  latitude double precision not null,
  longitude double precision not null
);

-- Events: created by admins, with participant allocation and check-in tracking.
create table if not exists public.events (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  created_at timestamptz not null default now(),
  event_dates text[] not null default '{}',
  venue_id text references public.venues (id),
  venue_name text not null,
  venue_city text not null,
  facilitator text not null,
  checkin_start_time text,
  checkin_end_time text,
  job_group_allowances jsonb,
  allocated_participants text[] not null default '{}',
  unregistered_participants jsonb not null default '[]',
  checked_in_participants jsonb not null default '{}',
  program_url text,
  letter_url text
);

create index if not exists events_allocated_participants_idx on public.events using gin (allocated_participants);
create index if not exists events_unregistered_participants_idx on public.events using gin (unregistered_participants);

-- Per diem requests: submitted by participants, reviewed by admins.
create table if not exists public.perdiem_requests (
  id text primary key default gen_random_uuid()::text,
  participant_id uuid not null references public.participants (id) on delete cascade,
  participant_name text not null,
  event_id text not null references public.events (id) on delete cascade,
  event_name text not null,
  location text not null,
  date text not null,
  status text not null default 'Pending',
  transaction_code text,
  rejection_reason text,
  amendment_reason text,
  original_total double precision,
  mileage_km double precision,
  mileage_total double precision,
  air_ticket_cost double precision,
  boarding_pass_url text,
  boarding_pass_filename text,
  ground_transfer_cost double precision,
  air_ticket_url text,
  air_ticket_filename text,
  ground_transfer_url text,
  ground_transfer_filename text,
  accommodation_nights double precision,
  accommodation_total double precision,
  out_of_office_allowance double precision,
  total_perdiem double precision not null
);

create index if not exists perdiem_requests_participant_id_idx on public.perdiem_requests (participant_id);
create index if not exists perdiem_requests_event_id_idx on public.perdiem_requests (event_id);
create index if not exists perdiem_requests_status_idx on public.perdiem_requests (status);

-- Mirrors the old firestore.rules isAdmin() helper: a user is an admin if
-- their own participants row has role = 'Admin'.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.participants
    where id = auth.uid() and role = 'Admin'
  );
$$;

alter table public.participants enable row level security;
alter table public.venues enable row level security;
alter table public.events enable row level security;
alter table public.perdiem_requests enable row level security;

-- Participants: anyone can create their own row (but not as Admin); only the
-- user themselves or an admin can read/update it; only the user can delete it.
create policy "Participants can create their own row" on public.participants
  for insert
  with check (auth.uid() = id and role <> 'Admin');

create policy "Participants can read own row, admins read all" on public.participants
  for select
  using (auth.uid() = id or public.is_admin());

create policy "Participants can update own row, admins update all" on public.participants
  for update
  using (auth.uid() = id or public.is_admin());

create policy "Participants can delete own row" on public.participants
  for delete
  using (auth.uid() = id);

-- Venues: any authenticated user can read; only admins can write.
create policy "Authenticated users can read venues" on public.venues
  for select
  using (auth.role() = 'authenticated');

create policy "Admins insert venues" on public.venues
  for insert
  with check (public.is_admin());

create policy "Admins update venues" on public.venues
  for update
  using (public.is_admin());

create policy "Admins delete venues" on public.venues
  for delete
  using (public.is_admin());

-- Events: admins read everything, participants read events they're allocated
-- to; only admins create/delete; any authenticated user can update (check-in
-- correctness is enforced by the app, same trust model as before).
create policy "Admins read all events, participants read their own" on public.events
  for select
  using (public.is_admin() or auth.uid()::text = any (allocated_participants));

create policy "Admins create events" on public.events
  for insert
  with check (public.is_admin());

create policy "Admins delete events" on public.events
  for delete
  using (public.is_admin());

create policy "Authenticated users can update events" on public.events
  for update
  using (auth.role() = 'authenticated');

-- Per diem requests: a user can only create/read their own; only admins can
-- update (approve/reject/pay) or delete.
create policy "Participants create their own requests" on public.perdiem_requests
  for insert
  with check (participant_id = auth.uid());

create policy "Participants read own requests, admins read all" on public.perdiem_requests
  for select
  using (participant_id = auth.uid() or public.is_admin());

create policy "Admins update requests" on public.perdiem_requests
  for update
  using (public.is_admin());

create policy "Admins delete requests" on public.perdiem_requests
  for delete
  using (public.is_admin());
