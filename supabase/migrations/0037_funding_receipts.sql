-- Refunds module (module_key 'funding', see 0030): record-keeping for
-- refund payments made, one row per invoice. First used for Apeiro:
-- "Konvergenz Refund from T4H", invoices INV00075 / INV00081. A record
-- on its own - not reconciled against the other modules. It counts in
-- the Home page's overall total like Hotel Bookings.
--
--   funding_receipts  one refund payment against one invoice
--                     (received_date = the payment date)
--
-- Access: same as Hotel Bookings - anyone who can_access_client() (Super
-- Admin and above, or that client's own Organization Admin) while the
-- client has the module on may view, add and edit; deleting is Super
-- Admin and above.
--
-- Duplicates: an invoice number is unique per client (case/space
-- insensitive), so the same invoice can't be recorded twice.
--
-- Safe to re-run.

-- --- Module key ---

alter table public.client_modules drop constraint if exists client_modules_module_key_check;
alter table public.client_modules add constraint client_modules_module_key_check
  check (module_key in ('perdiem', 'salary', 'hotels', 'funding'));

-- --- Table ---

create table if not exists public.funding_receipts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id),
  invoice_no text,
  description text not null check (trim(description) <> ''),
  -- Who made the payment (e.g. T4H).
  payer text,
  amount numeric(14,2) not null check (amount > 0),
  received_date date not null,
  -- Bank / transaction reference; null when the source says N/A.
  reference text,
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_by uuid,
  updated_at timestamptz not null default now()
);

create index if not exists funding_receipts_client_date_idx on public.funding_receipts (client_id, received_date);
create unique index if not exists funding_receipts_invoice_uniq
  on public.funding_receipts (client_id, lower(regexp_replace(trim(invoice_no), '\s+', ' ', 'g')))
  where invoice_no is not null;

-- --- RLS ---

alter table public.funding_receipts enable row level security;

drop policy if exists funding_receipts_select on public.funding_receipts;
create policy funding_receipts_select on public.funding_receipts
  for select using (public.can_access_client(client_id) and public.has_module(client_id, 'funding'));

drop policy if exists funding_receipts_insert on public.funding_receipts;
create policy funding_receipts_insert on public.funding_receipts
  for insert with check (public.can_access_client(client_id) and public.has_module(client_id, 'funding'));

drop policy if exists funding_receipts_update on public.funding_receipts;
create policy funding_receipts_update on public.funding_receipts
  for update using (public.can_access_client(client_id) and public.has_module(client_id, 'funding'))
  with check (public.can_access_client(client_id) and public.has_module(client_id, 'funding'));

drop policy if exists funding_receipts_delete on public.funding_receipts;
create policy funding_receipts_delete on public.funding_receipts
  for delete using ((select public.is_super_admin_or_above()));

-- Who/when on edits, whatever the client sends.
create or replace function public.funding_receipts_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

drop trigger if exists funding_receipts_touch on public.funding_receipts;
create trigger funding_receipts_touch
  before update on public.funding_receipts
  for each row execute function public.funding_receipts_touch();

-- --- Platform-wide totals across modules ---

-- Same as 0036 plus a 'funding' branch: refunds paid, by payment month.
create or replace function public.get_platform_totals(
  target_client_id uuid default null,
  p_date_from text default null,
  p_date_to text default null
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with enabled as (
    select client_id, module_key from public.client_modules where enabled
  ),
  perdiem as (
    select
      'perdiem'::text as module, r.client_id,
      case when r.date ~ '^\d{4}-\d{2}-\d{2}$' then substring(r.date, 1, 7) end as month,
      sum(r.total_perdiem)::numeric as amount,
      count(*) as items
    from public.perdiem_requests r
    join enabled m on m.client_id = r.client_id and m.module_key = 'perdiem'
    where public.perdiem_is_transacted(r.status, r.is_overpayment)
      and (target_client_id is null or r.client_id = target_client_id)
      and (
        (p_date_from is null and p_date_to is null)
        or (
          r.date ~ '^\d{4}-\d{2}-\d{2}$'
          and (p_date_from is null or r.date >= p_date_from)
          and (p_date_to is null or r.date <= p_date_to)
        )
      )
    group by r.client_id, 3
  ),
  salary as (
    select
      'salary'::text as module, r.client_id,
      to_char(r.period, 'YYYY-MM') as month,
      sum(l.gross_pay + l.employer_housing_levy + l.employer_nita + l.employer_nssf)::numeric as amount,
      count(l.id) as items
    from public.salary_runs r
    join enabled m on m.client_id = r.client_id and m.module_key = 'salary'
    join public.salary_lines l on l.run_id = r.id
    where (target_client_id is null or r.client_id = target_client_id)
      and (p_date_from is null or r.period >= date_trunc('month', p_date_from::date)::date)
      and (p_date_to is null or r.period <= p_date_to::date)
    group by r.client_id, r.period
  ),
  hotels as (
    select
      'hotels'::text as module, p.client_id,
      to_char(p.payment_date, 'YYYY-MM') as month,
      sum(p.amount)::numeric as amount,
      count(*) as items
    from public.hotel_payments p
    join enabled m on m.client_id = p.client_id and m.module_key = 'hotels'
    where (target_client_id is null or p.client_id = target_client_id)
      and (p_date_from is null or p.payment_date >= p_date_from::date)
      and (p_date_to is null or p.payment_date <= p_date_to::date)
    group by p.client_id, 3
  ),
  funding as (
    select
      'funding'::text as module, f.client_id,
      to_char(f.received_date, 'YYYY-MM') as month,
      sum(f.amount)::numeric as amount,
      count(*) as items
    from public.funding_receipts f
    join enabled m on m.client_id = f.client_id and m.module_key = 'funding'
    where (target_client_id is null or f.client_id = target_client_id)
      and (p_date_from is null or f.received_date >= p_date_from::date)
      and (p_date_to is null or f.received_date <= p_date_to::date)
    group by f.client_id, 3
  )
  select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
  from (
    select * from perdiem union all select * from salary union all select * from hotels
    union all select * from funding
  ) t
$$;
