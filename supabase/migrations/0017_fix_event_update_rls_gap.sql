-- Security fix (see 2026-08-25 security review). The original "Tenant-scoped
-- event update" policy (0003_tenancy_and_tiers.sql) let a participant update
-- an event row whenever their own auth.uid() appeared in that event's
-- allocated_participants, with no WITH CHECK clause:
--
--   using (public.can_access_client(client_id) or auth.uid()::text = any (allocated_participants))
--
-- With no WITH CHECK, Postgres reuses USING for the post-update check too -
-- so the only real constraint on a participant's write was "my uid is still
-- in allocated_participants afterward". Nothing stopped them updating ANY
-- other column on the row: job_group_allowances (drives calculated per-diem
-- amounts), venue_id/venue_name, letter_url/program_url, event_dates, or
-- even removing other participants from allocated_participants. This was
-- directly reachable from the browser - src/lib/supabase/database.ts's
-- updateEvent() does a plain `supabase.from('events').update(row)` with the
-- user's own session (anon key + JWT), so RLS was the only real enforcement
-- layer here, and it wasn't restrictive enough.
--
-- The only legitimate thing a participant actually needs to do to an event
-- is check themselves in (checked_in_participants) - see checkInToEvent() in
-- database.ts and its one caller, employee-dashboard.tsx's self-check-in
-- flow (geolocation-verified, always for the caller's own auth.uid(), never
-- someone else's). That's moved into its own SECURITY DEFINER RPC below,
-- same pattern as set_access_tier/import_historical_events - it takes no
-- participant_id parameter at all (always auth.uid() internally), so a
-- participant can't even attempt to check in on someone else's behalf. With
-- that in place, the events UPDATE policy is narrowed to admins only.

create function public.check_in_to_event(p_event_id uuid, p_check_in_date text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated int;
begin
  update public.events
  set checked_in_participants = jsonb_set(
    coalesce(checked_in_participants, '{}'::jsonb),
    array[auth.uid()::text],
    coalesce(checked_in_participants->(auth.uid()::text), '{}'::jsonb)
      || jsonb_build_object(p_check_in_date, (extract(epoch from now()) * 1000)::bigint),
    true
  )
  where id = p_event_id
    and auth.uid()::text = any(allocated_participants);

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    raise exception 'Event not found or you are not allocated to it';
  end if;
end;
$$;
revoke all on function public.check_in_to_event(uuid, text) from public;
grant execute on function public.check_in_to_event(uuid, text) to authenticated;

drop policy if exists "Tenant-scoped event update" on public.events;

create policy "Tenant-scoped event update" on public.events
  for update
  using (public.can_access_client(client_id))
  with check (public.can_access_client(client_id));
