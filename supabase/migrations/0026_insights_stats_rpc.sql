-- Server-side aggregates for the Super/Master Admin "Insights" tab (see
-- admin-insights.tsx and insights/*.tsx). Same problem 0025 fixed for the
-- Overview widget grid: every Insights section used to sum/group the full
-- perdiem_requests array (29,000+ rows) in the browser, so the whole tab sat
-- on a loading skeleton until that entire table had downloaded, and every
-- filter change re-scanned every row. These functions do the same math
-- inside Postgres and return only the few hundred numbers the charts need.
--
-- Only the requests-derived numbers move here. events/venues/participants/
-- clients are small and already loaded client-side, so the event-derived
-- charts (training duration, venues, counties, events over time) and the
-- participant/event counts keep being computed in the browser.
--
-- Filters: Event Type / Event Name / County are resolved to a set of event
-- IDs client-side (exactly the logic admin-insights.tsx already had) and
-- passed in as p_event_ids - null means "no event filter", an empty array
-- means "a filter matched no events" (and so matches no requests). The
-- Payment Date range is passed as inclusive 'YYYY-MM-DD' strings and
-- compared as text, which sorts correctly for that format; `date` is a text
-- column (0001_init.sql) and malformed values (see
-- one-off-find-bad-dates.sql) are excluded from anything date-based.
--
-- `security invoker` + `stable` for the same reasons spelled out in 0025:
-- RLS scoping applies exactly as it did to the client-side fetch, and the
-- numbers are always live (rows get amended after the fact).

-- The one SQL definition of "money actually transacted" - mirrors
-- isTransacted() in src/lib/data.ts (keep the two in sync). A plain
-- immutable SQL function, so Postgres inlines it into each caller's query -
-- deliberately no `set search_path` (it touches no tables, and a SET clause
-- would stop the inlining).
create or replace function public.perdiem_is_transacted(p_status text, p_is_overpayment boolean)
returns boolean
language sql
immutable
as $$
  select p_status in ('Paid', 'Confirmed') or (p_status = 'Amended' and coalesce(p_is_overpayment, false))
$$;

-- Re-pointed at the shared helper above, same signature and output as 0025.
create or replace function public.get_perdiem_overview_stats(target_client_id uuid default null)
returns table (
  total_requests bigint,
  pending_requests bigint,
  total_paid_out numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    count(*)::bigint as total_requests,
    count(*) filter (where status = 'Pending')::bigint as pending_requests,
    coalesce(sum(total_perdiem) filter (where public.perdiem_is_transacted(status, is_overpayment)), 0)::numeric as total_paid_out
  from public.perdiem_requests
  where target_client_id is null or client_id = target_client_id
$$;

create or replace function public.get_insights_stats(
  p_event_ids text[] default null,
  p_date_from text default null,
  p_date_to text default null,
  -- First day of the Overview's "last 90 days" trend, computed in the
  -- browser's own timezone so "today" means the admin's today.
  p_trend_from text default null
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with f as materialized (
    select
      r.id, r.client_id, r.participant_name, r.event_id, r.event_name, r.date, r.status,
      r.total_perdiem, r.original_total, r.recovered_amount, r.is_overpayment, r.amendment_reason,
      r.mileage_total, r.accommodation_total, r.out_of_office_allowance, r.air_ticket_cost,
      r.ground_transfer_cost, r.transport_allowance, r.dsa_allowance,
      r.employer, r.dha_staff, r.moh_staff, r.knh_staff, r.sha_staff, r.other_staff,
      public.perdiem_is_transacted(r.status, r.is_overpayment) as transacted,
      r.date ~ '^\d{4}-\d{2}-\d{2}$' as valid_date
    from public.perdiem_requests r
    where (p_event_ids is null or r.event_id = any(p_event_ids))
      and (
        (p_date_from is null and p_date_to is null)
        or (
          r.date ~ '^\d{4}-\d{2}-\d{2}$'
          and (p_date_from is null or r.date >= p_date_from)
          and (p_date_to is null or r.date <= p_date_to)
        )
      )
  )
  select jsonb_build_object(
    'totals', (
      select jsonb_build_object(
        'request_count', count(*),
        'total_perdiem', coalesce(sum(total_perdiem), 0),
        'total_paid_out', coalesce(sum(total_perdiem) filter (where transacted), 0),
        'amendment_delta', coalesce(sum(total_perdiem - original_total) filter (where status = 'Amended' and original_total is not null), 0)
      )
      from f
    ),

    'by_status', coalesce((
      select jsonb_agg(jsonb_build_object('status', status, 'count', n, 'amount', amount) order by n desc)
      from (select status, count(*) as n, coalesce(sum(total_perdiem), 0) as amount from f group by status) s
    ), '[]'::jsonb),

    'by_client', coalesce((
      select jsonb_agg(jsonb_build_object('client_id', client_id, 'request_count', n, 'total_paid', paid))
      from (
        select client_id, count(*) as n, coalesce(sum(total_perdiem) filter (where transacted), 0) as paid
        from f group by client_id
      ) c
    ), '[]'::jsonb),

    -- Every month with data, per client - small (clients x months), and
    -- lets the browser pick whichever trailing window each chart shows.
    'monthly_by_client', coalesce((
      select jsonb_agg(jsonb_build_object('client_id', client_id, 'month', month, 'count', n, 'amount', amount))
      from (
        select client_id, substring(date, 1, 7) as month, count(*) as n, coalesce(sum(total_perdiem), 0) as amount
        from f where valid_date group by client_id, substring(date, 1, 7)
      ) m
    ), '[]'::jsonb),

    'daily', coalesce((
      select jsonb_agg(jsonb_build_object('day', date, 'count', n))
      from (
        select date, count(*) as n from f
        where valid_date and p_trend_from is not null and date >= p_trend_from
        group by date
      ) d
    ), '[]'::jsonb),

    'allowances', (
      select jsonb_build_object(
        'mileage', coalesce(sum(mileage_total), 0),
        'accommodation', coalesce(sum(accommodation_total), 0),
        'out_of_office', coalesce(sum(out_of_office_allowance), 0),
        'air_ticket', coalesce(sum(air_ticket_cost), 0),
        'ground_transfer', coalesce(sum(ground_transfer_cost), 0),
        'transport', coalesce(sum(transport_allowance), 0),
        'dsa', coalesce(sum(dsa_allowance), 0)
      )
      from f
    ),

    -- Same buckets as AMOUNT_BUCKETS in insights/financial.tsx.
    'histogram', (
      select jsonb_build_array(
        count(*) filter (where total_perdiem >= 0 and total_perdiem < 5000),
        count(*) filter (where total_perdiem >= 5000 and total_perdiem < 10000),
        count(*) filter (where total_perdiem >= 10000 and total_perdiem < 20000),
        count(*) filter (where total_perdiem >= 20000 and total_perdiem < 30000),
        count(*) filter (where total_perdiem >= 30000 and total_perdiem < 50000),
        count(*) filter (where total_perdiem >= 50000)
      )
      from f
    ),

    -- Only the Amended subset, only the fields the Financial scatter and
    -- the Amendments table actually render.
    'amended_rows', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id, 'client_id', client_id, 'participant_name', participant_name,
        'event_name', event_name, 'date', date, 'amendment_reason', amendment_reason,
        'total_perdiem', total_perdiem, 'original_total', original_total,
        'recovered_amount', recovered_amount, 'is_overpayment', is_overpayment
      ))
      from f where status = 'Amended'
    ), '[]'::jsonb),

    'staff_by_status', coalesce((
      select jsonb_agg(jsonb_build_object('category', category, 'status', status, 'count', n))
      from (
        select c.category, f.status, count(*) as n
        from f
        cross join lateral (values
          ('DHA', f.dha_staff), ('MOH', f.moh_staff), ('KNH', f.knh_staff),
          ('SHA', f.sha_staff), ('Other', f.other_staff)
        ) as c(category, flag)
        where c.flag
        group by c.category, f.status
      ) s
    ), '[]'::jsonb),

    'top_employers', coalesce((
      select jsonb_agg(jsonb_build_object('name', employer, 'value', n) order by n desc)
      from (
        select employer, count(*) as n from f
        where employer is not null and employer <> ''
        group by employer order by count(*) desc limit 10
      ) e
    ), '[]'::jsonb),

    -- Training Days vs Amount scatter: one point per distinct (days, amount)
    -- pair rather than one per request - identical points overlap exactly
    -- on the chart anyway. Days mirrors trainingDaysFor() in
    -- insights/training.tsx (keep in sync): number_of_training_days when
    -- set, else the count of event_dates.
    'training_points', coalesce((
      select jsonb_agg(jsonb_build_object('days', days, 'amount', amount))
      from (
        select distinct
          case when coalesce(e.number_of_training_days, 0) > 0 then e.number_of_training_days
               else coalesce(cardinality(e.event_dates), 0) end as days,
          f.total_perdiem as amount
        from f join public.events e on e.id = f.event_id
      ) t
      where days > 0
    ), '[]'::jsonb),

    -- Narrows the client-side, event-derived charts to events that had a
    -- request in the chosen Payment Date range. null when no date filter.
    'event_ids_in_range', case
      when p_date_from is null and p_date_to is null then null
      else coalesce((select jsonb_agg(distinct event_id) from f), '[]'::jsonb)
    end,

    -- Deliberately unfiltered - feeds the Year dropdown itself.
    'years', coalesce((
      select jsonb_agg(y order by y desc)
      from (
        select distinct substring(date, 1, 4) as y
        from public.perdiem_requests
        where date ~ '^\d{4}-\d{2}-\d{2}$'
      ) yrs
    ), '[]'::jsonb)
  )
$$;

revoke all on function public.get_insights_stats(text[], text, text, text) from public;
grant execute on function public.get_insights_stats(text[], text, text, text) to authenticated;

-- Participant Lookup (insights/participant-lookup.tsx): name/phone search
-- done in Postgres. The count and totals cover every match; only the first
-- p_limit rows (newest first) come back for the table.
create or replace function public.search_insights_requests(
  p_query text,
  p_event_ids text[] default null,
  p_date_from text default null,
  p_date_to text default null,
  p_limit integer default 500
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with q as (
    -- Escape LIKE wildcards so a literal % or _ in the search box matches itself.
    select '%' || replace(replace(replace(trim(p_query), '\', '\\'), '%', '\%'), '_', '\_') || '%' as pattern
  ),
  m as materialized (
    select r.id, r.client_id, r.participant_name, r.participant_phone, r.event_name, r.date, r.status,
           r.total_perdiem, public.perdiem_is_transacted(r.status, r.is_overpayment) as transacted
    from public.perdiem_requests r, q
    where trim(coalesce(p_query, '')) <> ''
      and (r.participant_name ilike q.pattern or coalesce(r.participant_phone, '') like q.pattern)
      and (p_event_ids is null or r.event_id = any(p_event_ids))
      and (
        (p_date_from is null and p_date_to is null)
        or (
          r.date ~ '^\d{4}-\d{2}-\d{2}$'
          and (p_date_from is null or r.date >= p_date_from)
          and (p_date_to is null or r.date <= p_date_to)
        )
      )
  )
  select jsonb_build_object(
    'match_count', (select count(*) from m),
    'total_paid', (select coalesce(sum(total_perdiem) filter (where transacted), 0) from m),
    'total_all', (select coalesce(sum(total_perdiem), 0) from m),
    'rows', coalesce((
      select jsonb_agg(to_jsonb(t) - 'transacted' order by t.date desc)
      from (select * from m order by date desc limit greatest(p_limit, 0)) t
    ), '[]'::jsonb)
  )
$$;

revoke all on function public.search_insights_requests(text, text[], text, text, integer) from public;
grant execute on function public.search_insights_requests(text, text[], text, text, integer) to authenticated;
