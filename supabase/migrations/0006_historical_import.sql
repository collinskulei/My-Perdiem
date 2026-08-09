-- Milestone 4: historical events + per-diem payment import (infrastructure
-- only - this migration adds the capability, it doesn't import any real data).
--
-- Historical payment records predate the app for most people in them - they
-- were paid via the process in the client's own process-flow doc (cash
-- request -> payment-list review/DSA calc -> bulk payment -> reporting/SOA),
-- entirely outside this system, often for people who never had (and may
-- never need) an app login. The existing schema required every
-- perdiem_requests row to point at a real auth.users-backed participant,
-- which historical data can't satisfy. This relaxes that for historical rows
-- while leaving the live self-service flow (register -> check in -> request)
-- completely unchanged - it still always sets participant_id.

alter table public.perdiem_requests alter column participant_id drop not null;
alter table public.perdiem_requests add column if not exists participant_phone text;
alter table public.perdiem_requests add column if not exists participant_id_number text;
alter table public.perdiem_requests add column if not exists imported_at timestamptz;

create index if not exists perdiem_requests_participant_phone_idx on public.perdiem_requests (participant_phone);

-- Same relaxation on events: a historical event's allocated_participants can
-- likewise reference people with no auth.users row. That array already
-- holds plain text uids (not an FK), so no schema change is needed there -
-- historical imports simply don't add unregistered people to it (matching
-- import to an existing participant is best-effort, see the RPC below; it
-- backfills allocated_participants only when a real match is found).

-- Atomic historical import: one call per uploaded file. Every insert in the
-- payload either fully commits or the whole batch rolls back (a single
-- plpgsql function body is one transaction) - no partial imports.
--
-- rows is a jsonb array, each element shaped like:
-- {
--   "eventName": "...", "venueName": "...", "venueCity": "...", "venueCounty": "...",
--   "eventDates": ["2025-01-10", "2025-01-11"],
--   "participantName": "...", "participantPhone": "0712345678", "participantIdNumber": "12345678",
--   "status": "Paid", "transactionCode": "...", "totalPerdiem": 15000,
--   "mileageKm": null, "mileageTotal": null, "accommodationNights": null,
--   "accommodationTotal": null, "outOfOfficeAllowance": null,
--   "airTicketCost": null, "groundTransferCost": null
-- }
--
-- Only Super Admin and above may run this (mirrors who actually runs this
-- process per the client's workflow - Client Admins don't do bulk historical
-- reconciliation). Matches an existing participant by (client_id, phone) if
-- one exists; otherwise leaves participant_id null and keeps the
-- participant_name/phone/id_number snapshot on the row.
create or replace function public.import_historical_events(
  target_client_id uuid,
  rows jsonb
)
returns table (imported_count int, event_count int)
language plpgsql
security definer
set search_path = public
as $$
declare
  row_data jsonb;
  v_venue_id text;
  v_event_id text;
  v_participant_id uuid;
  v_phone text;
  v_imported int := 0;
  v_events_touched text[] := '{}';
begin
  if not public.is_super_admin_or_above() then
    raise exception 'Only Super Admin and above may import historical data';
  end if;

  if not public.client_exists(target_client_id) then
    raise exception 'Client not found';
  end if;

  for row_data in select * from jsonb_array_elements(rows)
  loop
    -- Venue: shared/global directory, matched by name (case-insensitive).
    -- Historical rows commonly reuse the same venue across many rows/events.
    select id into v_venue_id from public.venues
      where lower(name) = lower(row_data->>'venueName') limit 1;
    if v_venue_id is null and row_data->>'venueName' is not null then
      insert into public.venues (name, city, county, latitude, longitude)
        values (
          row_data->>'venueName',
          coalesce(row_data->>'venueCity', ''),
          coalesce(row_data->>'venueCounty', ''),
          0, 0
        )
        returning id into v_venue_id;
    end if;

    -- Event: matched by (client_id, name). Repeated rows for the same event
    -- name just add more per-diem requests against the same event row -
    -- event_dates is unioned in, never overwritten.
    select id into v_event_id from public.events
      where client_id = target_client_id and lower(name) = lower(row_data->>'eventName')
      limit 1;
    if v_event_id is null then
      insert into public.events (
        client_id, name, created_at, event_dates, venue_id, venue_name, venue_city, facilitator
      ) values (
        target_client_id,
        row_data->>'eventName',
        now(),
        coalesce((select array_agg(value::text) from jsonb_array_elements_text(coalesce(row_data->'eventDates', '[]'::jsonb))), '{}'),
        v_venue_id,
        coalesce(row_data->>'venueName', ''),
        coalesce(row_data->>'venueCity', ''),
        'Imported (historical)'
      )
      returning id into v_event_id;
    else
      update public.events set event_dates = (
        select array_agg(distinct d) from unnest(
          event_dates || coalesce((select array_agg(value::text) from jsonb_array_elements_text(coalesce(row_data->'eventDates', '[]'::jsonb))), '{}')
        ) d
      ) where id = v_event_id;
    end if;
    v_events_touched := array_append(v_events_touched, v_event_id);

    -- Participant match: best-effort by (client_id, phone). No match is not
    -- an error - the row still imports with a name/phone/id_number snapshot
    -- and a null participant_id, same as an unregistered event allocation.
    v_participant_id := null;
    v_phone := row_data->>'participantPhone';
    if v_phone is not null then
      select id into v_participant_id from public.participants
        where client_id = target_client_id and phone_number = v_phone limit 1;
      if v_participant_id is not null then
        update public.events set allocated_participants = array_append(allocated_participants, v_participant_id::text)
          where id = v_event_id and not (v_participant_id::text = any(allocated_participants));
      end if;
    end if;

    insert into public.perdiem_requests (
      client_id, participant_id, participant_name, participant_phone, participant_id_number,
      event_id, event_name, location, date, status, transaction_code,
      mileage_km, mileage_total, accommodation_nights, accommodation_total,
      out_of_office_allowance, air_ticket_cost, ground_transfer_cost,
      total_perdiem, imported_at
    ) values (
      target_client_id, v_participant_id, row_data->>'participantName', v_phone, row_data->>'participantIdNumber',
      v_event_id, row_data->>'eventName', coalesce(row_data->>'venueCity', ''),
      coalesce(row_data->'eventDates'->>0, to_char(now(), 'YYYY-MM-DD')),
      coalesce(row_data->>'status', 'Paid'), row_data->>'transactionCode',
      (row_data->>'mileageKm')::double precision, (row_data->>'mileageTotal')::double precision,
      (row_data->>'accommodationNights')::double precision, (row_data->>'accommodationTotal')::double precision,
      (row_data->>'outOfOfficeAllowance')::double precision, (row_data->>'airTicketCost')::double precision,
      (row_data->>'groundTransferCost')::double precision,
      (row_data->>'totalPerdiem')::double precision, now()
    );
    v_imported := v_imported + 1;
  end loop;

  return query select v_imported, (select count(distinct e) from unnest(v_events_touched) e)::int;
end;
$$;
revoke all on function public.import_historical_events(uuid, jsonb) from public;
grant execute on function public.import_historical_events(uuid, jsonb) to authenticated;
