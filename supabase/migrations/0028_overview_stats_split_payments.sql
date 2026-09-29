-- Splits get_perdiem_overview_stats' single "total_requests" count into
-- per diem *requests* (submitted through the app) and per diem *payments*
-- (historical payment records brought in by the importer - any row with
-- imported_at set). Historical rows are payments that already happened,
-- not requests anyone submitted, so counting them as requests made the
-- Overview's Per Diem Requests card read "29,000+ total" for clients that
-- have never had a single in-app request.
--
-- total_paid_out is unchanged - still every transacted row, historical or
-- live (same isTransacted() definition as 0025).
--
-- Adding a column changes the function's return type, which
-- `create or replace` can't do - hence the drop first. Grants are
-- re-applied below exactly as 0025 had them.
drop function if exists public.get_perdiem_overview_stats(uuid);

create function public.get_perdiem_overview_stats(target_client_id uuid default null)
returns table (
  total_requests bigint,
  pending_requests bigint,
  total_paid_out numeric,
  total_payments bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    count(*) filter (where imported_at is null)::bigint as total_requests,
    count(*) filter (where imported_at is null and status = 'Pending')::bigint as pending_requests,
    -- Keep in sync with isTransacted() in src/lib/data.ts (see 0025).
    coalesce(sum(total_perdiem) filter (
      where status in ('Paid', 'Confirmed') or (status = 'Amended' and is_overpayment)
    ), 0)::numeric as total_paid_out,
    count(*) filter (where imported_at is not null)::bigint as total_payments
  from public.perdiem_requests
  where target_client_id is null or client_id = target_client_id
$$;

revoke all on function public.get_perdiem_overview_stats(uuid) from public;
grant execute on function public.get_perdiem_overview_stats(uuid) to authenticated;

-- Rebuild 0025's covering index with imported_at included, so the new
-- filters stay an index-only scan instead of a heap fetch per row.
drop index if exists public.perdiem_requests_overview_stats_idx;
create index perdiem_requests_overview_stats_idx
  on public.perdiem_requests (client_id, status)
  include (total_perdiem, is_overpayment, imported_at);
