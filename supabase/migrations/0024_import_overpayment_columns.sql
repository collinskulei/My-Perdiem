-- Lets a historical-import file carry its own overpayment info instead of
-- requiring the "Flag Overpayment"/bulk-flag actions to be run by hand,
-- row by row, after a normal import - directly requested after using those
-- actions manually for a real file (a finance team's reconciliation sheet
-- that already had Payable/Recoveries columns, e.g. "Feedbacks for Bungoma
-- EUT Anomalies Q4.xlsx": Name, Phone, Paid by Bank, Payable, Over-pay,
-- Recoveries, Pending).
--
-- Three new optional fields on each row (HistoricalImportRow in
-- src/lib/supabase/database.ts): payableAmount, overpaymentReason,
-- recoveredAmount - all admittedly absent on most templates, which is fine:
-- when payableAmount is missing (the common case) a row imports exactly as
-- it always has, status 'Paid'. Only when it's present AND less than the
-- row's own total_perdiem does the row get created already flagged
-- (status='Amended', original_total=payableAmount, is_overpayment=true,
-- amendment_reason=overpaymentReason, recovered_amount=recoveredAmount),
-- matching exactly what "Flag Overpayment" does by hand but for a whole
-- batch in one pass. Safe under the same permission model as before -
-- 0023's guard trigger only blocks *updates* to is_overpayment/
-- recovered_amount, not inserts, and only Super Admin+ can call this RPC at
-- all (see the existing check at the top of the function).
--
-- The gap-fill (existing-row) branch treats these the same coalesce-only-if-
-- blank way every other field here already does, with one deliberate
-- exception: is_overpayment is OR'd rather than coalesced (once true, a
-- later batch can never silently un-flag it), and recovered_amount only
-- gets filled from an incoming value while it's still at its default of 0 -
-- once an admin has started recording real recoveries through the Reports
-- tab's "Record Recovery" action, a re-upload of the same source file must
-- never stomp that progress back down.

create or replace function public.import_historical_events(
  target_client_id uuid,
  rows jsonb
)
returns table (imported_count int, updated_count int, event_ids text[])
language plpgsql
security definer
set search_path = public
as $$
declare
  row_data jsonb;
  v_venue_id text;
  v_event_id text;
  v_event_type public.event_type_category;
  v_participant_id uuid;
  v_phone text;
  v_name_key text;
  v_date text;
  v_amount double precision;
  v_training_start text;
  v_training_end text;
  v_training_days int;
  v_existing_request_id text;
  v_identity_match_id text;
  v_identity_match_amount double precision;
  v_merge_decision text;
  v_flag_reason text;
  v_payable_amount double precision;
  v_overpayment_reason text;
  v_recovered_amount double precision;
  v_is_overpayment_row boolean;
  v_imported int := 0;
  v_updated int := 0;
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
    elsif v_venue_id is not null then
      -- Backfill only - an existing venue's county/city that's already set
      -- (even to something the row disagrees with) is left alone. Each
      -- column's coalesce chain ends in its own current value, so a blank
      -- incoming value (or both sides blank) is a safe no-op, never a NULL
      -- write - see 0021's header for the crash that happened without that
      -- last fallback.
      update public.venues set
        county = coalesce(nullif(county, ''), nullif(row_data->>'venueCounty', ''), county),
        city = coalesce(nullif(city, ''), nullif(row_data->>'venueCity', ''), city)
      where id = v_venue_id
        and (
          (nullif(county, '') is null and nullif(row_data->>'venueCounty', '') is not null)
          or (nullif(city, '') is null and nullif(row_data->>'venueCity', '') is not null)
        );
    end if;

    v_training_start := row_data->>'trainingStartDate';
    v_training_end := row_data->>'trainingEndDate';
    v_training_days := (row_data->>'numberOfTrainingDays')::int;

    -- Set once at event creation, same as venue_name/venue_city below - not
    -- re-derived on the update branch, so a later batch can't silently
    -- flip an already-classified event's category.
    if row_data->>'eventType' in ('TOT', 'EUT', 'CHP', 'Workshop', 'Other') then
      v_event_type := (row_data->>'eventType')::public.event_type_category;
    else
      v_event_type := public.classify_event_type(coalesce(row_data->>'eventName', ''));
    end if;

    -- Matches on name + venue + training start date together - a generic
    -- name/blank-venue combo shared across different counties' rollouts
    -- (see 0018's header) is only the same event if the training period
    -- also lines up, not just because the payment happened to land on the
    -- same disbursement date.
    select id into v_event_id from public.events
      where client_id = target_client_id
        and lower(name) = lower(row_data->>'eventName')
        and venue_id is not distinct from v_venue_id
        and training_start_date is not distinct from v_training_start
      limit 1;
    if v_event_id is null then
      insert into public.events (
        client_id, name, created_at, event_dates, event_type, venue_id, venue_name, venue_city, facilitator,
        training_start_date, training_end_date, number_of_training_days
      ) values (
        target_client_id,
        row_data->>'eventName',
        now(),
        coalesce((select array_agg(value::text) from jsonb_array_elements_text(coalesce(row_data->'eventDates', '[]'::jsonb))), '{}'),
        v_event_type,
        v_venue_id,
        coalesce(row_data->>'venueName', ''),
        coalesce(row_data->>'venueCity', ''),
        'Imported (historical)',
        v_training_start, v_training_end, v_training_days
      )
      returning id into v_event_id;
    else
      update public.events set
        event_dates = (
          select array_agg(distinct d) from unnest(
            event_dates || coalesce((select array_agg(value::text) from jsonb_array_elements_text(coalesce(row_data->'eventDates', '[]'::jsonb))), '{}')
          ) d
        ),
        training_start_date = least(training_start_date, v_training_start),
        training_end_date = greatest(training_end_date, v_training_end),
        number_of_training_days = coalesce(number_of_training_days, v_training_days)
      where id::text = v_event_id;
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
          where id::text = v_event_id and not (v_participant_id::text = any(allocated_participants));
      end if;
    end if;

    -- Normalized for matching only (strip a leading title, lowercase,
    -- collapse whitespace) - the raw participant_name is still stored/shown
    -- exactly as given. Only used as a fallback identity signal when a phone
    -- number isn't available on one side of the match.
    v_name_key := lower(trim(regexp_replace(coalesce(row_data->>'participantName', ''), '^(mr|mrs|ms|miss|dr)\.?\s+', '', 'i')));
    v_date := coalesce(row_data->'eventDates'->>0, to_char(now(), 'YYYY-MM-DD'));
    v_amount := (row_data->>'totalPerdiem')::double precision;
    v_merge_decision := row_data->>'mergeDecision';

    -- Overpayment info is optional on every row - most templates simply
    -- won't have these columns mapped, in which case v_payable_amount is
    -- null and v_is_overpayment_row is false, and this row behaves exactly
    -- as it always has.
    v_payable_amount := (row_data->>'payableAmount')::double precision;
    v_overpayment_reason := row_data->>'overpaymentReason';
    v_recovered_amount := (row_data->>'recoveredAmount')::double precision;
    v_is_overpayment_row := v_payable_amount is not null and v_amount is not null and v_payable_amount < v_amount;

    -- Identity match: same client+event+date+person, regardless of amount.
    -- Prefer a row whose amount also matches (ties broken toward it via the
    -- order by) so the existing gap-fill path below still finds it first
    -- when both an amount-matching and an amount-differing row exist for
    -- the same identity; only falls through to a differing-amount row when
    -- no amount-matching one is present.
    select id, total_perdiem into v_identity_match_id, v_identity_match_amount
      from public.perdiem_requests
      where client_id = target_client_id
        and event_id::text = v_event_id
        and date = v_date
        and (
          (v_phone is not null and participant_phone is not null and right(participant_phone, 9) = right(v_phone, 9))
          or (
            (v_phone is null or participant_phone is null)
            and lower(trim(regexp_replace(coalesce(participant_name, ''), '^(mr|mrs|ms|miss|dr)\.?\s+', '', 'i'))) = v_name_key
          )
        )
      order by (
        total_perdiem is null or v_amount is null or round(total_perdiem::numeric, 2) = round(v_amount::numeric, 2)
      ) desc, id
      limit 1;

    v_existing_request_id := null;
    if v_identity_match_id is not null and (
      v_identity_match_amount is null or v_amount is null
      or round(v_identity_match_amount::numeric, 2) = round(v_amount::numeric, 2)
    ) then
      -- Amount matches (or either side is blank) - same record, gap-fill sync.
      v_existing_request_id := v_identity_match_id;
    end if;

    -- An explicit admin decision (from the import dialog's conflict
    -- resolution UI) always overrides the automatic amount-based call above.
    if v_merge_decision = 'separate' then
      v_existing_request_id := null;
    elsif v_merge_decision = 'merge' and v_identity_match_id is not null then
      v_existing_request_id := v_identity_match_id;
    end if;

    if v_existing_request_id is not null then
      -- Fill blanks only - never overwrite a value that's already set.
      update public.perdiem_requests set
        participant_id = coalesce(participant_id, v_participant_id),
        participant_phone = coalesce(participant_phone, v_phone),
        participant_id_number = coalesce(participant_id_number, row_data->>'participantIdNumber'),
        location = coalesce(nullif(location, ''), row_data->>'venueCity'),
        transaction_code = coalesce(transaction_code, row_data->>'transactionCode'),
        notes = coalesce(notes, row_data->>'notes'),
        employer = coalesce(employer, row_data->>'employer'),
        dha_staff = coalesce(dha_staff, (row_data->>'dhaStaff')::boolean),
        moh_staff = coalesce(moh_staff, (row_data->>'mohStaff')::boolean),
        knh_staff = coalesce(knh_staff, (row_data->>'knhStaff')::boolean),
        sha_staff = coalesce(sha_staff, (row_data->>'shaStaff')::boolean),
        other_staff = coalesce(other_staff, (row_data->>'otherStaff')::boolean),
        mileage_km = coalesce(mileage_km, (row_data->>'mileageKm')::double precision),
        mileage_total = coalesce(mileage_total, (row_data->>'mileageTotal')::double precision),
        accommodation_nights = coalesce(accommodation_nights, (row_data->>'accommodationNights')::double precision),
        accommodation_total = coalesce(accommodation_total, (row_data->>'accommodationTotal')::double precision),
        out_of_office_allowance = coalesce(out_of_office_allowance, (row_data->>'outOfOfficeAllowance')::double precision),
        air_ticket_cost = coalesce(air_ticket_cost, (row_data->>'airTicketCost')::double precision),
        ground_transfer_cost = coalesce(ground_transfer_cost, (row_data->>'groundTransferCost')::double precision),
        transport_allowance = coalesce(transport_allowance, (row_data->>'transportAllowance')::double precision),
        dsa_allowance = coalesce(dsa_allowance, (row_data->>'dsaAllowance')::double precision),
        total_perdiem = coalesce(total_perdiem, (row_data->>'totalPerdiem')::double precision),
        original_total = coalesce(original_total, case when v_is_overpayment_row then v_payable_amount else null end),
        amendment_reason = coalesce(amendment_reason, case when v_is_overpayment_row then coalesce(v_overpayment_reason, 'Overpaid - flagged during historical import') else null end),
        is_overpayment = is_overpayment or v_is_overpayment_row,
        recovered_amount = case when recovered_amount = 0 and v_is_overpayment_row then coalesce(v_recovered_amount, 0) else recovered_amount end,
        status = case when v_is_overpayment_row and not is_overpayment then 'Amended' else status end
      where id = v_existing_request_id;
      v_updated := v_updated + 1;
    else
      -- No amount-matching identity record (or the admin explicitly chose
      -- to keep it separate). If an identity match exists at all, flag both
      -- this new row and the pre-existing one so it's visible for review
      -- rather than looking like an ordinary import.
      v_flag_reason := null;
      if v_identity_match_id is not null then
        v_flag_reason := format(
          'Repeat payment: same participant, event, date and phone/name as another payment of KES %s (this payment: KES %s).%s',
          trim(to_char(coalesce(v_identity_match_amount, 0), 'FM999,999,999.00')),
          trim(to_char(coalesce(v_amount, 0), 'FM999,999,999.00')),
          case when v_merge_decision = 'separate'
            then ' Kept as a separate record - admin chose not to merge during import.'
            else ' Kept as a separate record, not merged - please verify both are legitimate.'
          end
        );
        update public.perdiem_requests set
          flag_reason = coalesce(flag_reason, format(
            'Repeat payment: same participant, event, date and phone/name as another payment of KES %s (this payment: KES %s).%s',
            trim(to_char(coalesce(v_amount, 0), 'FM999,999,999.00')),
            trim(to_char(coalesce(v_identity_match_amount, 0), 'FM999,999,999.00')),
            case when v_merge_decision = 'separate'
              then ' Kept as a separate record - admin chose not to merge during import.'
              else ' Kept as a separate record, not merged - please verify both are legitimate.'
            end
          ))
          where id = v_identity_match_id;
      end if;

      insert into public.perdiem_requests (
        client_id, participant_id, participant_name, participant_phone, participant_id_number,
        event_id, event_name, location, date, status, transaction_code, notes,
        employer, dha_staff, moh_staff, knh_staff, sha_staff, other_staff,
        mileage_km, mileage_total, accommodation_nights, accommodation_total,
        out_of_office_allowance, air_ticket_cost, ground_transfer_cost,
        transport_allowance, dsa_allowance,
        total_perdiem, imported_at, flag_reason,
        original_total, amendment_reason, is_overpayment, recovered_amount
      ) values (
        target_client_id, v_participant_id, row_data->>'participantName', v_phone, row_data->>'participantIdNumber',
        v_event_id, row_data->>'eventName', coalesce(row_data->>'venueCity', ''),
        v_date,
        case when v_is_overpayment_row then 'Amended' else coalesce(row_data->>'status', 'Paid') end,
        row_data->>'transactionCode', row_data->>'notes',
        row_data->>'employer',
        (row_data->>'dhaStaff')::boolean, (row_data->>'mohStaff')::boolean, (row_data->>'knhStaff')::boolean,
        (row_data->>'shaStaff')::boolean, (row_data->>'otherStaff')::boolean,
        (row_data->>'mileageKm')::double precision, (row_data->>'mileageTotal')::double precision,
        (row_data->>'accommodationNights')::double precision, (row_data->>'accommodationTotal')::double precision,
        (row_data->>'outOfOfficeAllowance')::double precision, (row_data->>'airTicketCost')::double precision,
        (row_data->>'groundTransferCost')::double precision,
        (row_data->>'transportAllowance')::double precision, (row_data->>'dsaAllowance')::double precision,
        (row_data->>'totalPerdiem')::double precision, now(), v_flag_reason,
        case when v_is_overpayment_row then v_payable_amount else null end,
        case when v_is_overpayment_row then coalesce(v_overpayment_reason, 'Overpaid - flagged during historical import') else null end,
        v_is_overpayment_row,
        case when v_is_overpayment_row then coalesce(v_recovered_amount, 0) else 0 end
      );
      v_imported := v_imported + 1;
    end if;
  end loop;

  return query select v_imported, v_updated, array(select distinct unnest(v_events_touched));
end;
$$;
