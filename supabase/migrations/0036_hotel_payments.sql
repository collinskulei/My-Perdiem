-- Hotel Bookings module (module_key 'hotels', see 0030): record-keeping
-- for what a client has paid hotels - event accommodation, conference
-- packages, staff stays. First used for Apeiro's "Hotels bookings list".
-- Everything recorded here is already paid; there is no pending/approval
-- flow, and the module is deliberately not linked to Per Diem events.
--
--   hotel_import_batches  one uploaded file (so an upload can be undone)
--   hotel_payments        one payment to one hotel
--
-- Hotels are free text on each payment, not a separate table - the Hotels
-- tab groups payments by name. Columns a file brings that aren't one of
-- the fixed fields are kept in `extra` (header -> value) rather than
-- dropped. Keep the field list in sync with HOTEL_FIELDS in
-- src/lib/hotels/fields.ts.
--
-- Access: anyone who can_access_client() (Super Admin and above, or that
-- client's own Organization Admin) AND only while the client has the
-- hotels module enabled. Those users may add and edit payments; deleting
-- a payment or a whole upload is Super Admin and above.
--
-- Duplicates: a payment with the same client, hotel name (case/space
-- insensitive), payment date and amount as one already on file is treated
-- as the same payment, so re-uploading a file never double-counts. The
-- import skips those unless the row is explicitly forced.
--
-- Safe to re-run.

-- --- Module key ---

alter table public.client_modules drop constraint if exists client_modules_module_key_check;
alter table public.client_modules add constraint client_modules_module_key_check
  check (module_key in ('perdiem', 'salary', 'hotels'));

-- --- Tables ---

create table if not exists public.hotel_import_batches (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id),
  source_file_name text,
  row_count int not null default 0,
  total_amount numeric(14,2) not null default 0,
  -- The file's own TOTAL row, when it has one.
  stated_total numeric(14,2),
  imported_by uuid default auth.uid(),
  imported_at timestamptz not null default now()
);

create table if not exists public.hotel_payments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id),
  batch_id uuid references public.hotel_import_batches (id) on delete cascade,
  event_name text,
  event_type text,
  hotel_name text not null check (trim(hotel_name) <> ''),
  -- Town or county, from a Location column or read out of the hotel
  -- name / description at upload.
  location text,
  description text,
  stay_start date,
  stay_end date,
  payment_date date not null,
  payment_method text,
  reference text,
  amount numeric(14,2) not null check (amount > 0),
  notes text,
  extra jsonb not null default '{}'::jsonb,
  warnings text[] not null default '{}',
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_by uuid,
  updated_at timestamptz not null default now()
);

create index if not exists hotel_payments_client_date_idx on public.hotel_payments (client_id, payment_date);
create index if not exists hotel_payments_dedupe_idx
  on public.hotel_payments (client_id, lower(regexp_replace(trim(hotel_name), '\s+', ' ', 'g')), payment_date, amount);

-- --- RLS ---

alter table public.hotel_import_batches enable row level security;
alter table public.hotel_payments enable row level security;

drop policy if exists hotel_import_batches_select on public.hotel_import_batches;
create policy hotel_import_batches_select on public.hotel_import_batches
  for select using (public.can_access_client(client_id) and public.has_module(client_id, 'hotels'));

drop policy if exists hotel_import_batches_delete on public.hotel_import_batches;
create policy hotel_import_batches_delete on public.hotel_import_batches
  for delete using ((select public.is_super_admin_or_above()));

drop policy if exists hotel_payments_select on public.hotel_payments;
create policy hotel_payments_select on public.hotel_payments
  for select using (public.can_access_client(client_id) and public.has_module(client_id, 'hotels'));

drop policy if exists hotel_payments_insert on public.hotel_payments;
create policy hotel_payments_insert on public.hotel_payments
  for insert with check (public.can_access_client(client_id) and public.has_module(client_id, 'hotels'));

drop policy if exists hotel_payments_update on public.hotel_payments;
create policy hotel_payments_update on public.hotel_payments
  for update using (public.can_access_client(client_id) and public.has_module(client_id, 'hotels'))
  with check (public.can_access_client(client_id) and public.has_module(client_id, 'hotels'));

drop policy if exists hotel_payments_delete on public.hotel_payments;
create policy hotel_payments_delete on public.hotel_payments
  for delete using ((select public.is_super_admin_or_above()));

-- Who/when on edits, whatever the client sends.
create or replace function public.hotel_payments_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

drop trigger if exists hotel_payments_touch on public.hotel_payments;
create trigger hotel_payments_touch
  before update on public.hotel_payments
  for each row execute function public.hotel_payments_touch();

-- --- Import ---

-- Stores one uploaded file's payments as a batch. p_rows is an array of
-- { eventName, eventType, hotelName, location, description, stayStart,
--   stayEnd, paymentDate, paymentMethod, reference, amount, notes, extra,
--   warnings, force }.
-- A row matching a payment already on file (see "Duplicates" above) - or
-- an earlier row of the same upload - is skipped unless force is true.
-- Returns the batch id, how many were stored, and the 0-based indexes of
-- the rows skipped as duplicates. A file where every row is a duplicate
-- stores no batch.
create or replace function public.import_hotel_payments(
  p_client_id uuid,
  p_source_file_name text,
  p_rows jsonb,
  p_stated_total numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch_id uuid;
  v_row jsonb;
  v_idx int := -1;
  v_count int := 0;
  v_total numeric := 0;
  v_skipped int[] := '{}';
  v_hotel text;
  v_date date;
  v_amount numeric;
begin
  if not (public.can_access_client(p_client_id) and public.has_module(p_client_id, 'hotels')) then
    raise exception 'Not allowed to upload hotel payments for this client';
  end if;

  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'No payment rows to import';
  end if;

  insert into public.hotel_import_batches (client_id, source_file_name, stated_total)
  values (p_client_id, p_source_file_name, p_stated_total)
  returning id into v_batch_id;

  for v_row in select * from jsonb_array_elements(p_rows)
  loop
    v_idx := v_idx + 1;
    v_hotel := nullif(trim(v_row->>'hotelName'), '');
    v_date := nullif(v_row->>'paymentDate', '')::date;
    v_amount := nullif(v_row->>'amount', '')::numeric;

    if v_hotel is null or v_date is null or v_amount is null or v_amount <= 0 then
      raise exception 'Row % needs a hotel, a payment date and an amount above zero', v_idx + 1;
    end if;

    if not coalesce((v_row->>'force')::boolean, false) and exists (
      select 1 from public.hotel_payments p
      where p.client_id = p_client_id
        and lower(regexp_replace(trim(p.hotel_name), '\s+', ' ', 'g')) = lower(regexp_replace(v_hotel, '\s+', ' ', 'g'))
        and p.payment_date = v_date
        and p.amount = v_amount
    ) then
      v_skipped := v_skipped || v_idx;
      continue;
    end if;

    insert into public.hotel_payments (
      client_id, batch_id, event_name, event_type, hotel_name, location, description,
      stay_start, stay_end, payment_date, payment_method, reference, amount, notes, extra, warnings
    ) values (
      p_client_id, v_batch_id,
      nullif(trim(v_row->>'eventName'), ''),
      nullif(trim(v_row->>'eventType'), ''),
      v_hotel,
      nullif(trim(v_row->>'location'), ''),
      nullif(trim(v_row->>'description'), ''),
      nullif(v_row->>'stayStart', '')::date,
      nullif(v_row->>'stayEnd', '')::date,
      v_date,
      nullif(trim(v_row->>'paymentMethod'), ''),
      nullif(trim(v_row->>'reference'), ''),
      v_amount,
      nullif(trim(v_row->>'notes'), ''),
      coalesce(v_row->'extra', '{}'::jsonb),
      coalesce(array(select jsonb_array_elements_text(coalesce(v_row->'warnings', '[]'::jsonb))), '{}')
    );

    v_count := v_count + 1;
    v_total := v_total + v_amount;
  end loop;

  if v_count = 0 then
    delete from public.hotel_import_batches where id = v_batch_id;
    v_batch_id := null;
  else
    update public.hotel_import_batches set row_count = v_count, total_amount = v_total where id = v_batch_id;
  end if;

  return jsonb_build_object('batch_id', v_batch_id, 'inserted', v_count, 'skipped', to_jsonb(v_skipped));
end;
$$;

-- --- Platform-wide totals across modules ---

-- Same as 0031 plus a 'hotels' branch: total paid to hotels, by payment
-- month. See 0031 for the other branches.
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
  )
  select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
  from (select * from perdiem union all select * from salary union all select * from hotels) t
$$;
