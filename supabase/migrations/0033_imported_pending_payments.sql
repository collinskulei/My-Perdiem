-- Imported pending payments: historical-import rows (imported_at set) that
-- came in with status 'Pending' - payments known to be owed but not yet
-- made (e.g. the TaifaCare Q3 2026 register, held back awaiting attendance
-- sheets). Until now nothing surfaced them: the Reports Paid tab only shows
-- Paid/Confirmed, Overview's pending_requests counts live requests only
-- (imported_at is null - see 0028), and there was no way to move an
-- imported row from Pending to Paid once the money actually went out.
--
-- 1. get_perdiem_pending_stats - count/amount of imported pending rows plus
--    a per event+venue breakdown, for the Overview card, the Insights
--    Overview section and the Reports Pending tab summary. Same filters as
--    get_insights_stats (0026) so Insights' filter bar applies to it too.
--    `security invoker`, so tenant scoping comes from RLS exactly as for
--    every other stats RPC.
--
-- 2. mark_imported_pending_paid - moves selected imported Pending rows to
--    Paid with the real payment date and (optionally) a transaction code.
--    Super/Master Admin only: RLS alone would also let a Client Admin
--    update their own tenant's rows, so this is `security definer` with an
--    explicit tier check, and only ever touches imported rows still in
--    Pending - a stale selection can't re-date an already-paid row.

create or replace function public.get_perdiem_pending_stats(
  target_client_id uuid default null,
  p_event_ids text[] default null,
  p_date_from text default null,
  p_date_to text default null
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with p as materialized (
    select r.event_id, r.event_name, r.total_perdiem
    from public.perdiem_requests r
    where r.imported_at is not null
      and r.status = 'Pending'
      and (target_client_id is null or r.client_id = target_client_id)
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
    'count', (select count(*) from p),
    'amount', (select coalesce(sum(total_perdiem), 0) from p),
    'by_event', coalesce((
      select jsonb_agg(jsonb_build_object(
        'event_id', b.event_id, 'event_name', b.event_name, 'venue_name', b.venue_name,
        'county', b.county, 'count', b.n, 'amount', b.amount
      ) order by b.amount desc)
      from (
        select p.event_id, min(p.event_name) as event_name, min(e.venue_name) as venue_name,
               min(v.county) as county, count(*) as n, coalesce(sum(p.total_perdiem), 0) as amount
        from p
        left join public.events e on e.id = p.event_id
        left join public.venues v on v.id = e.venue_id
        group by p.event_id
      ) b
    ), '[]'::jsonb)
  )
$$;

revoke all on function public.get_perdiem_pending_stats(uuid, text[], text, text) from public;
grant execute on function public.get_perdiem_pending_stats(uuid, text[], text, text) to authenticated;

create or replace function public.mark_imported_pending_paid(
  p_request_ids text[],
  p_paid_date text,
  p_transaction_code text default null
)
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_updated integer;
begin
  if not public.is_super_admin_or_above() then
    raise exception 'Only Super or Master Admins can mark pending payments as paid'
      using errcode = '42501';
  end if;
  if p_paid_date is null or p_paid_date !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'Payment date must be YYYY-MM-DD (got %)', coalesce(p_paid_date, 'null')
      using errcode = '22007';
  end if;

  update public.perdiem_requests set
    status = 'Paid',
    date = p_paid_date,
    -- A blank code keeps whatever the import already recorded.
    transaction_code = coalesce(nullif(trim(p_transaction_code), ''), transaction_code)
  where id = any(p_request_ids)
    and imported_at is not null
    and status = 'Pending';

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

revoke all on function public.mark_imported_pending_paid(text[], text, text) from public;
grant execute on function public.mark_imported_pending_paid(text[], text, text) to authenticated;
