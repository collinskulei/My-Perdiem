-- Insights Overview's "Recipients vs Amount Paid" chart (insights/overview.tsx):
-- per month, how many distinct people were paid and how much was paid.
-- Replaces the chart's old series (count of every record and the sum of
-- every status), since per diems are a record of payments made rather
-- than requests.
--
-- Same rules as the rest of Insights:
-- - "Paid" = perdiem_is_transacted() (0026), the Total Paid Out rule.
-- - A person = perdiem_person_key() (0029), as the Per Diem Recipients card
--   counts them. A person paid in two months counts in both.
-- - Filters mirror get_perdiem_recipient_count (0029): p_event_ids null = no
--   event filter, dates are inclusive 'YYYY-MM-DD' text. p_month_from
--   ('YYYY-MM') limits the result to the chart's window.
-- `security invoker` + `stable`, so RLS keeps a Client Admin to their own
-- client's rows.
--
-- Safe to re-run.

create or replace function public.get_perdiem_monthly_recipients(
  target_client_id uuid default null,
  p_event_ids text[] default null,
  p_date_from text default null,
  p_date_to text default null,
  p_month_from text default null
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('month', month, 'recipients', recipients, 'amount', amount) order by month), '[]'::jsonb)
  from (
    select
      substring(r.date, 1, 7) as month,
      count(distinct public.perdiem_person_key(r.participant_phone, r.participant_name)) as recipients,
      coalesce(sum(r.total_perdiem), 0) as amount
    from public.perdiem_requests r
    where public.perdiem_is_transacted(r.status, r.is_overpayment)
      and r.date ~ '^\d{4}-\d{2}-\d{2}$'
      and (p_month_from is null or substring(r.date, 1, 7) >= p_month_from)
      and (target_client_id is null or r.client_id = target_client_id)
      and (p_event_ids is null or r.event_id = any(p_event_ids))
      and (p_date_from is null or r.date >= p_date_from)
      and (p_date_to is null or r.date <= p_date_to)
    group by 1
  ) m
$$;

revoke all on function public.get_perdiem_monthly_recipients(uuid, text[], text, text, text) from public;
grant execute on function public.get_perdiem_monthly_recipients(uuid, text[], text, text, text) to authenticated;
