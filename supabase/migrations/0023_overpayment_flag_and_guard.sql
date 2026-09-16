-- Two follow-ups to 0022, both prompted directly by the admin using the
-- overpayment-flagging feature for real:
--
-- 1. "Is it possible to have a flagging column so the system can read it
--    with ease" - yes, and it turns out to fix a real bug, not just be
--    tidier. The Amended tab/Insights section so far *inferred* "this is an
--    overpayment" from total_perdiem > original_total - but the existing
--    amend-a-pending-request flow (admin-dashboard.tsx's AmendRejectDialog,
--    unrelated to overpayment tracking) recalculates a Pending request's
--    total from its line items, which can legitimately land *higher* than
--    what the participant originally submitted (e.g. the admin adds an
--    accommodation allowance that was missing). That would have been
--    misread as an overpayment needing recovery when nothing was ever
--    overpaid. An explicit is_overpayment flag, set only by the "Flag
--    Overpayment" action (never by the ordinary amend flow), removes the
--    ambiguity entirely - the Amended tab and Insights now gate on this
--    column directly instead of inferring intent from an amount comparison.
--
-- 2. "Amendments can be done by super admin" - the existing "Tenant-scoped
--    request update" policy (0003_tenancy_and_tiers.sql) lets any admin
--    tier with access to the client update any column on a perdiem_requests
--    row, including these two - correct for the ordinary approve/reject/
--    amend-a-pending-request workflow a Client Admin does every day, but not
--    for flagging/recovering an overpayment, which should be a Super Admin+
--    action. RLS alone can't restrict individual columns (only which rows a
--    policy applies to), so - same pattern as guard_participant_privilege_
--    columns on `participants` (0003/0005) - a BEFORE UPDATE trigger blocks
--    a change to is_overpayment/recovered_amount specifically unless the
--    caller is Super Admin or above, while leaving every other column
--    (including the ordinary amend flow's original_total/amendment_reason/
--    status, which Client Admins still need) untouched by this guard.

alter table public.perdiem_requests
  add column if not exists is_overpayment boolean not null default false;

create or replace function public.guard_overpayment_columns()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'UPDATE' and (new.is_overpayment is distinct from old.is_overpayment
                            or new.recovered_amount is distinct from old.recovered_amount) then
    if not public.is_super_admin_or_above() and auth.role() <> 'service_role' then
      raise exception 'is_overpayment/recovered_amount can only be changed by Super Admin and above';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_overpayment_columns_trigger on public.perdiem_requests;
create trigger guard_overpayment_columns_trigger
  before update on public.perdiem_requests
  for each row execute function public.guard_overpayment_columns();
