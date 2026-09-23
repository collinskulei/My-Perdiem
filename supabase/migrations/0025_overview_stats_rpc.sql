-- Fast, live-aggregated stats for the admin dashboard's landing "Overview"
-- widget grid (see admin-overview-tab.tsx). Before this, Overview's Per
-- Diem Requests / Reports / Analytics cards depended on the full
-- perdiem_requests array already being fetched client-side by
-- fetchAllData() - fine when that table was small, but at 29,000+ rows
-- (and growing with every import) that fetch alone was taking well over a
-- minute, so the landing page sat on "0" for its most important numbers
-- until the whole table had downloaded and been summed in JavaScript.
--
-- This does the same three numbers (total requests, pending requests,
-- total paid out) as one small aggregate query run *inside* Postgres
-- instead - a few bytes back over the wire instead of the whole table.
--
-- Deliberately `security invoker`, not `security definer` (unlike most
-- other RPCs in this schema) - this must respect the caller's own RLS
-- ("Tenant-scoped request read" in 0003_tenancy_and_tiers.sql) exactly the
-- way the existing client-side fetch does, so a Client Admin only ever
-- sees their own client's numbers and a Super/Master Admin sees across all
-- clients, with zero extra access-control logic to keep in sync here.
--
-- Deliberately a live query, not a materialized/cached snapshot - rows in
-- this table get amended after the fact (status changes, overpayment
-- flags, recovered amounts - see 0022/0023), and a cached number would
-- silently drift stale the next time someone corrects a row. `stable`
-- (not `immutable`) is the honest marker for that: safe to reuse *within*
-- one query/transaction, never cached across calls.
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
    -- Same "money actually transacted" definition as isTransacted() in
    -- src/lib/data.ts - Paid/Confirmed, or an Amended row specifically
    -- flagged as an overpayment (flagging only ever happens on money
    -- that's already been disbursed). Keep these two in sync if either
    -- changes - see isTransacted's comment for the full reasoning.
    coalesce(sum(total_perdiem) filter (
      where status in ('Paid', 'Confirmed') or (status = 'Amended' and is_overpayment)
    ), 0)::numeric as total_paid_out
  from public.perdiem_requests
  where target_client_id is null or client_id = target_client_id
$$;

revoke all on function public.get_perdiem_overview_stats(uuid) from public;
grant execute on function public.get_perdiem_overview_stats(uuid) to authenticated;

-- Covering index so the aggregate above can be satisfied by an index-only
-- scan (status/total_perdiem/is_overpayment read straight from the index,
-- no heap fetch needed) instead of scanning every column of every wide
-- perdiem_requests row just to sum four of them.
create index if not exists perdiem_requests_overview_stats_idx
  on public.perdiem_requests (client_id, status)
  include (total_perdiem, is_overpayment);
