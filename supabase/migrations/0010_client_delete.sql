-- Lets Super Admin and above delete a client from the UI, instead of needing
-- direct SQL Editor access (see docs/MILESTONE_HANDOFF.md - this replaces
-- the one-off cleanup scripts written when duplicate clients had to be
-- removed manually). No new application-level "is this client empty?"
-- check is needed: the existing foreign-key references from participants/
-- events/perdiem_requests/work_types/documents to clients already reject
-- the delete outright if anything is still attached - that's the real
-- safety mechanism, not just a UI confirmation step.

create policy "Super admins and above delete clients" on public.clients
  for delete
  using (public.is_super_admin_or_above());
