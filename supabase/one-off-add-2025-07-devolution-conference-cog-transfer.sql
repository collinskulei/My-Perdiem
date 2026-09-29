-- One-off insert: Devolution Conference 2025 (12-15 Aug 2025, Homa Bay County) - Council of Governors
-- side event & pavilion, paid by bank transfer (RTGS) on 28 Jul 2025, KES 1,350,000.
-- Backed by CoG invoice COG-INV00340 (14 Jul 2025, billed to T4Health Limited, KES 1,350,000,
-- "hosting of one side event and one pavilion during the devolution conference ... 12th to 15th
-- August 2025 in Homabay County", KCB account 1164902318) - file
-- "PR-T4H-0196-T4Health Limited Invoice -Devolution Conference.pdf".
-- From the bank statement (user, 29 Sep 2026): "IB RTGS Local Transfer I250728103923354 /1164902318
-- COUNCILOFGOVERNORS Council of Governors Refund", reference 001ICGS252090001, debit 1,350,000,
-- value date 28-JUL-25. Paid to the Council of Governors' bank account (1164902318), not a person,
-- so it goes in as ONE payment with a blank phone, the RTGS reference as the transaction code and
-- the account / reference details in the notes.
-- The bank narrative says "Refund" but the invoice shows it is the conference hosting fee.
-- Payment date 2025-07-28 is the TRUE date - this row must be EXCLUDED from the later +1 day
-- importer-bug backfill; it is listed in perdiem_requests_backup_2025_07_cog_refund.
-- Expected after: July 2025 = 1,285 rows / KES 36,700,700 (was 1,284 / 35,350,700) - KES 1,351,000
-- ABOVE the July invoice (35,349,700), unless the invoice is updated.
-- NOT a numbered migration - run manually in the Supabase SQL Editor.
-- The whole thing runs in one transaction; any failed check rolls it all back.

begin;

-- Step 1: Safety checks.
do $$
declare n int; s double precision;
begin
  select count(*), coalesce(sum(total_perdiem), 0) into n, s from perdiem_requests where date between '2025-07-01' and '2025-07-31';
  if n <> 1284 or s <> 35350700 then
    raise exception 'July is not in the expected state: % rows / KES % (expected 1284 / 35350700) - already added?', n, s;
  end if;
  if exists (select 1 from events where name = 'Devolution Conference 2025 - Council of Governors side event & pavilion (bank transfer)') then raise exception 'The Devolution Conference CoG transfer event already exists'; end if;
  if exists (select 1 from perdiem_requests where transaction_code = 'I250728103923354' or (total_perdiem = 1350000 and date between '2025-07-01' and '2025-08-31')) then
    raise exception 'This transfer (or a KES 1,350,000 payment in Jul-Aug 2025) is already in the system';
  end if;
  if not exists (select 1 from venues where id = 'f2947b82-8d9a-488f-ad72-3955a46243ea' and name = 'Homa Bay County') then raise exception 'Homa Bay County venue not found'; end if;
end $$;

-- Step 2: The event.
insert into events (id, client_id, name, created_at, event_dates, event_type, venue_id, venue_name, venue_city, facilitator,
                    training_start_date, training_end_date, number_of_training_days)
values ('15fdf89e-883e-43c7-a0de-3393f543286a', '87283dbf-d590-4f66-b28d-ffe8023a1f54', 'Devolution Conference 2025 - Council of Governors side event & pavilion (bank transfer)', now(),
        array['2025-07-28'], 'Workshop', 'f2947b82-8d9a-488f-ad72-3955a46243ea', 'Homa Bay County', '', 'Imported (historical)',
        '2025-08-12', '2025-08-15', 4);

-- Step 3: The transfer.
insert into perdiem_requests (
  id, client_id, participant_id, participant_name, participant_phone, event_id, event_name, location, date, status, transaction_code,
  notes, employer, other_staff, transport_allowance, dsa_allowance, total_perdiem, imported_at, flag_reason, is_overpayment, recovered_amount)
values ('2f82a270-2ca5-4b44-b574-e94e80f2c574', '87283dbf-d590-4f66-b28d-ffe8023a1f54', null,
        'Council of Governors (bank transfer) - invoice COG-INV00340', null,
        '15fdf89e-883e-43c7-a0de-3393f543286a', 'Devolution Conference 2025 - Council of Governors side event & pavilion (bank transfer)', '', '2025-07-28', 'Paid', 'I250728103923354',
        'Bank transfer (IB RTGS Local Transfer) of KES 1,350,000 on 28 Jul 2025 to COUNCIL OF GOVERNORS, KCB account 1164902318 (bank narrative "Council of Governors Refund"), paying CoG invoice COG-INV00340 of 14 Jul 2025: hosting of one side event and one pavilion at the Devolution Conference, 12-15 Aug 2025, Homa Bay County. Bank reference 001ICGS252090001, RTGS reference I250728103923354. Paid to an account, not a named person. Added from the bank statement and the CoG invoice (user, 29 Sep 2026).',
        'COG', true, 0, 0, 1350000, now(), null, false, 0);

-- Step 4: Backup / undo list. Undo with:
--   delete from perdiem_requests where id in (select id from perdiem_requests_backup_2025_07_cog_refund where kind = 'payment');
--   delete from events where id in (select id from perdiem_requests_backup_2025_07_cog_refund where kind = 'event');
create table perdiem_requests_backup_2025_07_cog_refund as
  select '2f82a270-2ca5-4b44-b574-e94e80f2c574'::text as id, 'payment'::text as kind, 1350000::double precision as total, now() as inserted_at
  union all select '15fdf89e-883e-43c7-a0de-3393f543286a', 'event', null, now();

-- Step 5: Check before committing.
do $$
declare n int; s double precision;
begin
  select count(*), coalesce(sum(total_perdiem), 0) into n, s from perdiem_requests where date between '2025-07-01' and '2025-07-31';
  if n <> 1285 or s <> 36700700 then raise exception 'July after the insert is % rows / KES % (expected 1285 / 36700700)', n, s; end if;
end $$;

commit;

-- Step 6: Verify - expect 2025-07 = 1285 / 36700700, and the transfer as 1 payment of 1,350,000.
select substring(date, 1, 7) as month, count(*) as requests, sum(total_perdiem) as amount
from perdiem_requests where date between '2025-07-01' and '2025-07-31' group by 1;
select e.name, p.participant_name, p.date, p.transaction_code, p.total_perdiem
from perdiem_requests p join events e on e.id = p.event_id
where e.name = 'Devolution Conference 2025 - Council of Governors side event & pavilion (bank transfer)';
