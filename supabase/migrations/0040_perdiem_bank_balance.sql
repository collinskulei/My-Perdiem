-- Per diem Bank Balance: a per-client running balance used to counter-check
-- the per diem money paid out against the money deposited in the bank.
--
--   perdiem_bank_topups  one bank deposit ("Top-up") for one client
--
-- Balance = sum of top-ups - per diem paid on or after the client's
-- FIRST top-up date (the opening balance). Payments dated before that are
-- history and never counted. "Paid" uses the same rule as Total Paid Out
-- everywhere else (perdiem_is_transacted, 0026), dated by
-- perdiem_requests.date (YYYY-MM-DD text). Pending imported payments (0033)
-- are reported alongside but NOT deducted.
--
-- Per diem only - hotels, travel, salary and refunds don't touch it.
--
-- Access: anyone who can_access_client() (Super/Master Admin, or that
-- client's own Organization Admin) may view while the client has the
-- per diem module on; adding, editing and deleting top-ups is Super Admin
-- and Master Admin only.
--
-- Safe to re-run.

-- --- Table ---

create table if not exists public.perdiem_bank_topups (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id),
  amount numeric(14,2) not null check (amount > 0),
  deposit_date date not null,
  -- Bank slip / transaction reference.
  reference text,
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_by uuid,
  updated_at timestamptz not null default now()
);

create index if not exists perdiem_bank_topups_client_date_idx
  on public.perdiem_bank_topups (client_id, deposit_date);

-- --- RLS ---

alter table public.perdiem_bank_topups enable row level security;

drop policy if exists perdiem_bank_topups_select on public.perdiem_bank_topups;
create policy perdiem_bank_topups_select on public.perdiem_bank_topups
  for select using (public.can_access_client(client_id) and public.has_module(client_id, 'perdiem'));

drop policy if exists perdiem_bank_topups_insert on public.perdiem_bank_topups;
create policy perdiem_bank_topups_insert on public.perdiem_bank_topups
  for insert with check ((select public.is_super_admin_or_above()));

drop policy if exists perdiem_bank_topups_update on public.perdiem_bank_topups;
create policy perdiem_bank_topups_update on public.perdiem_bank_topups
  for update using ((select public.is_super_admin_or_above()))
  with check ((select public.is_super_admin_or_above()));

drop policy if exists perdiem_bank_topups_delete on public.perdiem_bank_topups;
create policy perdiem_bank_topups_delete on public.perdiem_bank_topups
  for delete using ((select public.is_super_admin_or_above()));

-- Who/when on edits, whatever the client sends.
create or replace function public.perdiem_bank_topups_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

drop trigger if exists perdiem_bank_topups_touch on public.perdiem_bank_topups;
create trigger perdiem_bank_topups_touch
  before update on public.perdiem_bank_topups
  for each row execute function public.perdiem_bank_topups_touch();

-- --- Balances ---

-- One object per client that has at least one top-up (and that the caller
-- can see - security invoker, so RLS on both tables applies):
--   client_id, start_date (first top-up), topups_total, topup_count,
--   last_topup_date, paid_total, paid_count (per diem paid since
--   start_date), balance, pending_amount, pending_count,
--   daily  [{date, amount, count}] per diem paid per day since start_date
--          (only when target_client_id is given - the ledger view needs it,
--          the dashboard card doesn't).
create or replace function public.get_perdiem_bank_balances(target_client_id uuid default null)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with t as (
    select client_id,
      min(deposit_date) as start_date,
      max(deposit_date) as last_topup_date,
      sum(amount)::numeric as topups_total,
      count(*) as topup_count
    from public.perdiem_bank_topups
    where target_client_id is null or client_id = target_client_id
    group by client_id
  ),
  paid as materialized (
    select r.client_id, r.date, r.total_perdiem
    from public.perdiem_requests r
    join t on t.client_id = r.client_id
    where public.perdiem_is_transacted(r.status, r.is_overpayment)
      and r.date ~ '^\d{4}-\d{2}-\d{2}$'
      and r.date >= to_char(t.start_date, 'YYYY-MM-DD')
  ),
  paid_sum as (
    select client_id, coalesce(sum(total_perdiem), 0)::numeric as paid_total, count(*) as paid_count
    from paid group by client_id
  ),
  pending as (
    select r.client_id, coalesce(sum(r.total_perdiem), 0)::numeric as pending_amount, count(*) as pending_count
    from public.perdiem_requests r
    join t on t.client_id = r.client_id
    where r.imported_at is not null and r.status = 'Pending'
    group by r.client_id
  ),
  daily as (
    select client_id, jsonb_agg(jsonb_build_object('date', date, 'amount', amount, 'count', n) order by date) as daily
    from (
      select client_id, date, sum(total_perdiem)::numeric as amount, count(*) as n
      from paid
      where target_client_id is not null
      group by client_id, date
    ) d
    group by client_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'client_id', t.client_id,
    'start_date', t.start_date,
    'last_topup_date', t.last_topup_date,
    'topups_total', t.topups_total,
    'topup_count', t.topup_count,
    'paid_total', coalesce(p.paid_total, 0),
    'paid_count', coalesce(p.paid_count, 0),
    'balance', t.topups_total - coalesce(p.paid_total, 0),
    'pending_amount', coalesce(pe.pending_amount, 0),
    'pending_count', coalesce(pe.pending_count, 0),
    'daily', coalesce(d.daily, '[]'::jsonb)
  )), '[]'::jsonb)
  from t
  left join paid_sum p on p.client_id = t.client_id
  left join pending pe on pe.client_id = t.client_id
  left join daily d on d.client_id = t.client_id
$$;

revoke all on function public.get_perdiem_bank_balances(uuid) from public;
grant execute on function public.get_perdiem_bank_balances(uuid) to authenticated;
