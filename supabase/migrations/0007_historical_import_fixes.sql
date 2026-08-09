-- Fixes to import_historical_events() found while testing against a real
-- sample file (a bulk-payment list: NAME, PHONE NUMBER, AMOUNT, DESCRIPTION
-- - no event/venue/date columns at all, since one such file is one payment
-- batch for one event, not a mix of many).
--
-- 1. Phone matching was an exact-string comparison; real phone numbers show
--    up in wildly different formats (with/without +254, with/without a
--    leading 0). Registered participants store the full "+254..." form.
--    Switched to comparing the last 9 digits, same convention the rest of
--    the app already uses for phone matching (see addParticipant's
--    retroactive event-allocation logic).
-- 2. Added a free-text `notes` column so a per-row description (like the
--    sample's DESCRIPTION column) isn't discarded on import.

alter table public.perdiem_requests add column if not exists notes text;

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

    -- Match by the last 9 digits, not an exact string - historical phone
    -- numbers show up as 07XXXXXXXX, 7XXXXXXXX, 2547XXXXXXXX, +2547XXXXXXXX
    -- interchangeably; registered participants always store +254XXXXXXXXX.
    v_participant_id := null;
    v_phone := row_data->>'participantPhone';
    if v_phone is not null and length(v_phone) >= 9 then
      select id into v_participant_id from public.participants
        where client_id = target_client_id and right(phone_number, 9) = right(v_phone, 9) limit 1;
      if v_participant_id is not null then
        update public.events set allocated_participants = array_append(allocated_participants, v_participant_id::text)
          where id = v_event_id and not (v_participant_id::text = any(allocated_participants));
      end if;
    end if;

    insert into public.perdiem_requests (
      client_id, participant_id, participant_name, participant_phone, participant_id_number,
      event_id, event_name, location, date, status, transaction_code, notes,
      mileage_km, mileage_total, accommodation_nights, accommodation_total,
      out_of_office_allowance, air_ticket_cost, ground_transfer_cost,
      total_perdiem, imported_at
    ) values (
      target_client_id, v_participant_id, row_data->>'participantName', v_phone, row_data->>'participantIdNumber',
      v_event_id, row_data->>'eventName', coalesce(row_data->>'venueCity', ''),
      coalesce(row_data->'eventDates'->>0, to_char(now(), 'YYYY-MM-DD')),
      coalesce(row_data->>'status', 'Paid'), row_data->>'transactionCode', row_data->>'notes',
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
