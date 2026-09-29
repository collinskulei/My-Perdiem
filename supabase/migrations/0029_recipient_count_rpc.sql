-- "Per Diem Recipients": how many distinct people were actually paid, for the
-- dashboard Overview card (admin-overview-tab.tsx) and the Insights Overview
-- (insights/overview.tsx). Both used to count participants rows with
-- access_tier = 'client_user' - registered app accounts - but almost every
-- payment arrives through the historical importer with no account behind
-- it, so that number said nothing about who was paid.
--
-- A person is identified the way the importer identifies a repeat payment
-- (conflictIdentityKey() in admin-historical-import.tsx - keep in sync): the
-- last 9 digits of the phone when it has at least 9, otherwise the name,
-- lowercased and trimmed with a leading Mr/Mrs/Ms/Miss/Dr removed. Rows
-- with neither are skipped. "Paid" = perdiem_is_transacted() (0026), the
-- same rule as Total Paid Out.
--
-- Filters mirror get_insights_stats (0026): p_event_ids null = no event
-- filter, dates are inclusive 'YYYY-MM-DD' text. `security invoker` +
-- `stable` for the same reasons as 0025/0026 - RLS tenant scoping applies,
-- so a Client Admin only ever counts their own client's recipients.

create or replace function public.perdiem_person_key(p_phone text, p_name text)
returns text
language sql
immutable
as $$
  select case
    when length(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')) >= 9
      then 'p:' || right(regexp_replace(p_phone, '\D', '', 'g'), 9)
    else nullif('n:' || regexp_replace(lower(trim(coalesce(p_name, ''))), '^(mr|mrs|ms|miss|dr)\.?\s+', ''), 'n:')
  end
$$;

create or replace function public.get_perdiem_recipient_count(
  target_client_id uuid default null,
  p_event_ids text[] default null,
  p_date_from text default null,
  p_date_to text default null
)
returns bigint
language sql
stable
security invoker
set search_path = public
as $$
  select count(distinct public.perdiem_person_key(r.participant_phone, r.participant_name))::bigint
  from public.perdiem_requests r
  where public.perdiem_is_transacted(r.status, r.is_overpayment)
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
$$;

revoke all on function public.get_perdiem_recipient_count(uuid, text[], text, text) from public;
grant execute on function public.get_perdiem_recipient_count(uuid, text[], text, text) to authenticated;
