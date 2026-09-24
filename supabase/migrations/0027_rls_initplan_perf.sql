-- Performance-only rewrite of the tenant-scoped RLS policies on
-- perdiem_requests and events - same access rules, evaluated once per
-- query instead of once per row.
--
-- Found via get_insights_stats (0026) hitting the `authenticated` role's
-- statement timeout (57014) while the same call ran instantly in the SQL
-- Editor (which bypasses RLS). The policies from 0003/0017 called
-- public.can_access_client(client_id) directly - a `security definer`
-- function, which Postgres can't inline, so it ran for every single row,
-- and each run did up to three lookups on participants (current_tier()
-- twice via is_super_admin_or_above(), plus current_client_id()). At
-- 36,000+ requests that's 100,000+ extra lookups per full-table read -
-- it slowed every requests read in the app, not just Insights.
--
-- Fix is Supabase's documented RLS pattern: wrap each caller-dependent
-- call in `(select ...)`, which Postgres runs once as an initPlan and
-- reuses for every row. can_access_client(target) was defined (0003) as
--
--   is_super_admin_or_above()
--   or (current_tier() = 'client_admin' and current_client_id() = target)
--
-- and that exact expression is spelled out inline below, with only the
-- per-row part (the row's own client_id) left outside a subselect.
-- can_access_client() itself is untouched and still used elsewhere (e.g.
-- documents, insert checks). If its definition ever changes, these
-- policies must change with it.

begin;

-- perdiem_requests ---------------------------------------------------------

drop policy if exists "Tenant-scoped request read" on public.perdiem_requests;
create policy "Tenant-scoped request read" on public.perdiem_requests
  for select
  using (
    participant_id = (select auth.uid())
    or (select public.is_super_admin_or_above())
    or ((select public.current_tier()) = 'client_admin' and client_id = (select public.current_client_id()))
  );

drop policy if exists "Tenant-scoped request update" on public.perdiem_requests;
create policy "Tenant-scoped request update" on public.perdiem_requests
  for update
  using (
    (select public.is_super_admin_or_above())
    or ((select public.current_tier()) = 'client_admin' and client_id = (select public.current_client_id()))
  );

drop policy if exists "Tenant-scoped request delete" on public.perdiem_requests;
create policy "Tenant-scoped request delete" on public.perdiem_requests
  for delete
  using (
    (select public.is_super_admin_or_above())
    or ((select public.current_tier()) = 'client_admin' and client_id = (select public.current_client_id()))
  );

-- events -------------------------------------------------------------------

drop policy if exists "Tenant-scoped event read" on public.events;
create policy "Tenant-scoped event read" on public.events
  for select
  using (
    (select public.is_super_admin_or_above())
    or ((select public.current_tier()) = 'client_admin' and client_id = (select public.current_client_id()))
    or (select auth.uid())::text = any (allocated_participants)
  );

-- Same using + with check as 0017_fix_event_update_rls_gap.sql.
drop policy if exists "Tenant-scoped event update" on public.events;
create policy "Tenant-scoped event update" on public.events
  for update
  using (
    (select public.is_super_admin_or_above())
    or ((select public.current_tier()) = 'client_admin' and client_id = (select public.current_client_id()))
  )
  with check (
    (select public.is_super_admin_or_above())
    or ((select public.current_tier()) = 'client_admin' and client_id = (select public.current_client_id()))
  );

drop policy if exists "Tenant-scoped event delete" on public.events;
create policy "Tenant-scoped event delete" on public.events
  for delete
  using (
    (select public.is_super_admin_or_above())
    or ((select public.current_tier()) = 'client_admin' and client_id = (select public.current_client_id()))
  );

commit;
