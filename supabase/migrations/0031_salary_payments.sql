-- Salary Payments module (module_key 'salary', see 0030): record-keeping
-- for payroll a client runs for one or more employers - e.g. Apeiro runs
-- payroll for Digital Health Agency. Historical/monthly muster rolls are
-- uploaded and stored; nothing here calculates tax or produces payslips.
--
--   salary_employers   an employer under a client (Apeiro -> DHA)
--   salary_templates   versioned column mapping for that employer's muster
--                      roll layout (append-only: a new column found during
--                      an upload creates a new version, never an edit)
--   salary_employees   one row per Staff No per employer, kept as it appears
--                      in the file (e.g. "00101DUH 3")
--   salary_runs        one month of payroll for one employer
--   salary_lines       one employee's pay for that month
--
-- Core amounts are typed columns; deductions/earnings that come and go
-- month to month (SACCO, HELB, insurance, overpayment recoveries...) live
-- in other_deductions / other_earnings jsonb keyed by the file's own
-- column header, so a new column never needs a schema change. Keep the
-- core field list in sync with SALARY_CORE_FIELDS in
-- src/lib/salary/fields.ts.
--
-- Access: anyone who can_access_client() (Super Admin and above, or that
-- client's own Organization Admin) AND only while the client has the
-- salary module enabled. Tables are read-only through RLS except for
-- Super Admin housekeeping (employers, deleting a run); uploads and
-- template versions go through the security definer RPCs below, which
-- do their own checks.
--
-- "Salary cost" (what the employer actually spent) = gross pay + employer
-- contributions (housing levy + NITA + NSSF) - the same figure as the
-- "Salary Cost" line on the employer's own Payroll Summary report. This is
-- what counts toward the overall platform total (get_platform_totals).

-- --- Tables ---

create table if not exists public.salary_employers (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id),
  name text not null,
  company_pin text,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

create unique index if not exists salary_employers_client_name_idx
  on public.salary_employers (client_id, lower(name)) where archived_at is null;

create table if not exists public.salary_templates (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.salary_employers (id) on delete cascade,
  version int not null,
  -- [{ "header": "Basic Pay", "kind": "core", "field": "basic_pay" },
  --  { "header": "HELB Loan Deduction", "kind": "other_deduction" },
  --  { "header": "Total Other Ded.", "kind": "core", "field": "total_other_deductions" },
  --  { "header": "", "kind": "ignore" }, ...]
  columns jsonb not null check (jsonb_typeof(columns) = 'array'),
  -- First cell text of the row that ends the employee list (the file's own
  -- totals row) - that row is read as the stated totals, not an employee.
  totals_marker text not null default 'Grand Totals',
  sample_file_name text,
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  unique (employer_id, version)
);

create table if not exists public.salary_employees (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.salary_employers (id) on delete cascade,
  staff_no text not null,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employer_id, staff_no)
);

create table if not exists public.salary_runs (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.salary_employers (id) on delete cascade,
  -- Denormalised from the employer so RLS/aggregates don't need a join.
  client_id uuid not null references public.clients (id),
  -- First day of the payroll month.
  period date not null check (extract(day from period) = 1),
  template_id uuid references public.salary_templates (id),
  source_file_name text,
  -- The file's own totals row, as stated (header -> amount), kept so a
  -- run can always be re-checked against what the source document said.
  stated_totals jsonb not null default '{}'::jsonb,
  totals_mismatch boolean not null default false,
  warning_count int not null default 0,
  imported_by uuid default auth.uid(),
  imported_at timestamptz not null default now(),
  unique (employer_id, period)
);

create index if not exists salary_runs_client_period_idx on public.salary_runs (client_id, period);

create table if not exists public.salary_lines (
  id bigint generated always as identity primary key,
  run_id uuid not null references public.salary_runs (id) on delete cascade,
  employee_id uuid not null references public.salary_employees (id),
  -- Snapshot as it appeared in that month's file.
  staff_no text not null,
  employee_name text not null,
  basic_pay numeric(14,2) not null default 0,
  commuter_allowance numeric(14,2) not null default 0,
  house_allowance numeric(14,2) not null default 0,
  other_earnings jsonb not null default '{}'::jsonb,
  gross_pay numeric(14,2) not null default 0,
  housing_levy numeric(14,2) not null default 0,
  nssf numeric(14,2) not null default 0,
  shif numeric(14,2) not null default 0,
  paye numeric(14,2) not null default 0,
  total_statutory numeric(14,2) not null default 0,
  other_deductions jsonb not null default '{}'::jsonb,
  total_other_deductions numeric(14,2) not null default 0,
  net_pay numeric(14,2) not null default 0,
  employer_housing_levy numeric(14,2) not null default 0,
  employer_nita numeric(14,2) not null default 0,
  employer_nssf numeric(14,2) not null default 0,
  warnings text[] not null default '{}',
  unique (run_id, employee_id)
);

create index if not exists salary_lines_employee_idx on public.salary_lines (employee_id);

-- --- RLS ---

alter table public.salary_employers enable row level security;
alter table public.salary_templates enable row level security;
alter table public.salary_employees enable row level security;
alter table public.salary_runs enable row level security;
alter table public.salary_lines enable row level security;

-- One place for "may this caller see this employer's salary data".
create or replace function public.can_access_salary_employer(target_employer uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.salary_employers e
    where e.id = target_employer
      and public.can_access_client(e.client_id)
      and public.has_module(e.client_id, 'salary')
  );
$$;

drop policy if exists salary_employers_select on public.salary_employers;
create policy salary_employers_select on public.salary_employers
  for select using (public.can_access_client(client_id) and public.has_module(client_id, 'salary'));

drop policy if exists salary_employers_insert on public.salary_employers;
create policy salary_employers_insert on public.salary_employers
  for insert with check ((select public.is_super_admin_or_above()) and public.has_module(client_id, 'salary'));

drop policy if exists salary_employers_update on public.salary_employers;
create policy salary_employers_update on public.salary_employers
  for update using ((select public.is_super_admin_or_above()))
  with check ((select public.is_super_admin_or_above()));

drop policy if exists salary_templates_select on public.salary_templates;
create policy salary_templates_select on public.salary_templates
  for select using (public.can_access_salary_employer(employer_id));

drop policy if exists salary_employees_select on public.salary_employees;
create policy salary_employees_select on public.salary_employees
  for select using (public.can_access_salary_employer(employer_id));

drop policy if exists salary_runs_select on public.salary_runs;
create policy salary_runs_select on public.salary_runs
  for select using (public.can_access_client(client_id) and public.has_module(client_id, 'salary'));

drop policy if exists salary_runs_delete on public.salary_runs;
create policy salary_runs_delete on public.salary_runs
  for delete using ((select public.is_super_admin_or_above()));

drop policy if exists salary_lines_select on public.salary_lines;
create policy salary_lines_select on public.salary_lines
  for select using (exists (
    select 1 from public.salary_runs r
    where r.id = run_id and public.can_access_client(r.client_id) and public.has_module(r.client_id, 'salary')
  ));

-- --- Templates ---

-- Appends a new template version for an employer. The first version is a
-- Super Admin setup step; later versions are what an upload creates when
-- the uploader classifies a column the template hasn't seen before, so
-- anyone allowed to upload may create those.
create or replace function public.save_salary_template(
  p_employer_id uuid,
  p_columns jsonb,
  p_totals_marker text default 'Grand Totals',
  p_sample_file_name text default null,
  p_notes text default null
)
returns public.salary_templates
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next int;
  v_row public.salary_templates;
begin
  if not public.can_access_salary_employer(p_employer_id) then
    raise exception 'Not allowed to manage this employer''s salary templates';
  end if;

  select coalesce(max(version), 0) + 1 into v_next
    from public.salary_templates where employer_id = p_employer_id;

  if v_next = 1 and not public.is_super_admin_or_above() then
    raise exception 'Only Super Admin and above may set up an employer''s first template';
  end if;

  if jsonb_typeof(p_columns) <> 'array' or jsonb_array_length(p_columns) = 0 then
    raise exception 'Template has no columns';
  end if;

  insert into public.salary_templates (employer_id, version, columns, totals_marker, sample_file_name, notes)
  values (p_employer_id, v_next, p_columns, coalesce(nullif(trim(p_totals_marker), ''), 'Grand Totals'), p_sample_file_name, p_notes)
  returning * into v_row;

  return v_row;
end;
$$;

-- --- Import ---

-- Stores one employer-month. Refuses if that month already exists unless
-- p_replace, in which case the old run (and its lines) is replaced
-- wholesale - a month is never merged or double-counted. Employees are
-- matched on Staff No exactly as it appears; a new Staff No creates an
-- employee, and the name is refreshed from the latest month on file.
create or replace function public.import_salary_run(
  p_employer_id uuid,
  p_period date,
  p_template_id uuid,
  p_source_file_name text,
  p_stated_totals jsonb,
  p_totals_mismatch boolean,
  p_rows jsonb,
  p_replace boolean default false
)
returns table (run_id uuid, employee_count int, new_employee_count int, replaced boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_id uuid;
  v_period date := date_trunc('month', p_period)::date;
  v_existing uuid;
  v_run_id uuid;
  v_employee_id uuid;
  v_inserted boolean;
  v_row jsonb;
  v_count int := 0;
  v_new int := 0;
  v_warnings int := 0;
  v_latest_period date;
begin
  if not public.can_access_salary_employer(p_employer_id) then
    raise exception 'Not allowed to upload salary data for this employer';
  end if;

  select client_id into v_client_id from public.salary_employers
    where id = p_employer_id and archived_at is null;
  if v_client_id is null then
    raise exception 'Employer not found';
  end if;

  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'No employee rows to import';
  end if;

  select id into v_existing from public.salary_runs
    where employer_id = p_employer_id and period = v_period;

  if v_existing is not null then
    if not p_replace then
      raise exception 'RUN_EXISTS: % already has salary data for %', p_employer_id, to_char(v_period, 'Mon YYYY');
    end if;
    delete from public.salary_runs where id = v_existing;
  end if;

  select max(period) into v_latest_period from public.salary_runs where employer_id = p_employer_id;

  insert into public.salary_runs (employer_id, client_id, period, template_id, source_file_name, stated_totals, totals_mismatch)
  values (p_employer_id, v_client_id, v_period, p_template_id, p_source_file_name, coalesce(p_stated_totals, '{}'::jsonb), coalesce(p_totals_mismatch, false))
  returning id into v_run_id;

  for v_row in select * from jsonb_array_elements(p_rows)
  loop
    if coalesce(trim(v_row->>'staffNo'), '') = '' then
      raise exception 'Row without a Staff No (%)', coalesce(v_row->>'name', '?');
    end if;

    insert into public.salary_employees (employer_id, staff_no, name)
    values (p_employer_id, trim(v_row->>'staffNo'), trim(coalesce(v_row->>'name', '')))
    on conflict (employer_id, staff_no) do update
      -- Only a month at least as recent as anything on file renames.
      set name = case when v_latest_period is null or v_period >= v_latest_period
                      then excluded.name else salary_employees.name end,
          updated_at = now()
    returning id, (xmax = 0) into v_employee_id, v_inserted;

    if v_inserted then
      v_new := v_new + 1;
    end if;

    insert into public.salary_lines (
      run_id, employee_id, staff_no, employee_name,
      basic_pay, commuter_allowance, house_allowance, other_earnings, gross_pay,
      housing_levy, nssf, shif, paye, total_statutory,
      other_deductions, total_other_deductions, net_pay,
      employer_housing_levy, employer_nita, employer_nssf, warnings
    ) values (
      v_run_id, v_employee_id, trim(v_row->>'staffNo'), trim(coalesce(v_row->>'name', '')),
      coalesce((v_row->>'basicPay')::numeric, 0),
      coalesce((v_row->>'commuterAllowance')::numeric, 0),
      coalesce((v_row->>'houseAllowance')::numeric, 0),
      coalesce(v_row->'otherEarnings', '{}'::jsonb),
      coalesce((v_row->>'grossPay')::numeric, 0),
      coalesce((v_row->>'housingLevy')::numeric, 0),
      coalesce((v_row->>'nssf')::numeric, 0),
      coalesce((v_row->>'shif')::numeric, 0),
      coalesce((v_row->>'paye')::numeric, 0),
      coalesce((v_row->>'totalStatutory')::numeric, 0),
      coalesce(v_row->'otherDeductions', '{}'::jsonb),
      coalesce((v_row->>'totalOtherDeductions')::numeric, 0),
      coalesce((v_row->>'netPay')::numeric, 0),
      coalesce((v_row->>'employerHousingLevy')::numeric, 0),
      coalesce((v_row->>'employerNita')::numeric, 0),
      coalesce((v_row->>'employerNssf')::numeric, 0),
      coalesce(array(select jsonb_array_elements_text(coalesce(v_row->'warnings', '[]'::jsonb))), '{}')
    );

    v_count := v_count + 1;
    if jsonb_array_length(coalesce(v_row->'warnings', '[]'::jsonb)) > 0 then
      v_warnings := v_warnings + 1;
    end if;
  end loop;

  update public.salary_runs set warning_count = v_warnings where id = v_run_id;

  return query select v_run_id, v_count, v_new, v_existing is not null;
end;
$$;

-- --- Aggregates ---

-- One row per employer-month with every total the Salary dashboard shows
-- (Overview, Monthly Runs, Statutory). Small (employers x months), so the
-- browser does any further rollup. security invoker: RLS scopes it.
create or replace function public.get_salary_run_summaries(
  target_client_id uuid default null,
  p_employer_id uuid default null
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(jsonb_agg(to_jsonb(s) order by s.period desc, s.employer_name), '[]'::jsonb)
  from (
    select
      r.id as run_id, r.employer_id, e.name as employer_name, r.client_id, r.period,
      r.source_file_name, r.imported_at, r.template_id, r.totals_mismatch, r.warning_count, r.stated_totals,
      count(l.id) as headcount,
      coalesce(sum(l.basic_pay), 0) as basic_pay,
      coalesce(sum(l.commuter_allowance), 0) as commuter_allowance,
      coalesce(sum(l.house_allowance), 0) as house_allowance,
      coalesce(sum(l.gross_pay), 0) as gross_pay,
      coalesce(sum(l.housing_levy), 0) as housing_levy,
      coalesce(sum(l.nssf), 0) as nssf,
      coalesce(sum(l.shif), 0) as shif,
      coalesce(sum(l.paye), 0) as paye,
      coalesce(sum(l.total_statutory), 0) as total_statutory,
      coalesce(sum(l.total_other_deductions), 0) as total_other_deductions,
      coalesce(sum(l.net_pay), 0) as net_pay,
      coalesce(sum(l.employer_housing_levy), 0) as employer_housing_levy,
      coalesce(sum(l.employer_nita), 0) as employer_nita,
      coalesce(sum(l.employer_nssf), 0) as employer_nssf,
      coalesce(sum(l.gross_pay + l.employer_housing_levy + l.employer_nita + l.employer_nssf), 0) as salary_cost,
      (select coalesce(jsonb_object_agg(k, v), '{}'::jsonb) from (
        select d.key as k, sum(d.value::numeric) as v
        from public.salary_lines l2, jsonb_each_text(l2.other_deductions) d
        where l2.run_id = r.id group by d.key
      ) od) as other_deduction_totals,
      (select coalesce(jsonb_object_agg(k, v), '{}'::jsonb) from (
        select d.key as k, sum(d.value::numeric) as v
        from public.salary_lines l2, jsonb_each_text(l2.other_earnings) d
        where l2.run_id = r.id group by d.key
      ) oe) as other_earning_totals
    from public.salary_runs r
    join public.salary_employers e on e.id = r.employer_id
    left join public.salary_lines l on l.run_id = r.id
    where (target_client_id is null or r.client_id = target_client_id)
      and (p_employer_id is null or r.employer_id = p_employer_id)
    group by r.id, e.name
  ) s
$$;

-- Per employee: first/last month on file, months paid, latest pay - for
-- the Employees tab. Computed from lines rather than stored, so replacing
-- or deleting a run can never leave these stale.
create or replace function public.get_salary_employee_summaries(p_employer_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(jsonb_agg(to_jsonb(s) order by s.staff_no), '[]'::jsonb)
  from (
    select
      emp.id as employee_id, emp.staff_no, emp.name,
      min(r.period) as first_period,
      max(r.period) as last_period,
      count(l.id) as months_paid,
      coalesce(sum(l.gross_pay), 0) as total_gross,
      coalesce(sum(l.net_pay), 0) as total_net,
      (array_agg(l.gross_pay order by r.period desc))[1] as latest_gross,
      (array_agg(l.net_pay order by r.period desc))[1] as latest_net
    from public.salary_employees emp
    left join public.salary_lines l on l.employee_id = emp.id
    left join public.salary_runs r on r.id = l.run_id
    where emp.employer_id = p_employer_id
    group by emp.id
  ) s
$$;

-- --- Platform-wide totals across modules ---

-- Feeds the overall Insights on each portal's Home page: one row per
-- module x client x month with the module's headline amount, so the page
-- can show a grand total, a total per module, a per-client breakdown, and
-- a monthly trend stacked by module. Adding a module = adding one more
-- `union all` branch here.
--
--   perdiem: total paid out - same rule (perdiem_is_transacted, 0026) and
--            the same total as Per Diem's own Insights "Total Paid Out".
--            Rows whose date isn't a clean YYYY-MM-DD still count toward
--            the unfiltered total (month = null), exactly as they do there.
--   salary:  salary cost (see the file comment).
--
-- Only modules the client has switched on are counted. Dates are
-- inclusive 'YYYY-MM-DD' text like get_insights_stats; a salary month is
-- in range when its first day falls between them (month granularity).
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
  )
  select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
  from (select * from perdiem union all select * from salary) t
$$;
