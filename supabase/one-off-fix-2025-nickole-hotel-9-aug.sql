-- One-off fix: Workshop/Conference - Nickole Hotel Nanyuki - paid 9 August 2025.
-- Kibet's "Payment Analysis ..." Q3 2025 sheet, rows 1294-1321, Excel date 2025-09-08 =
-- the usual day/month swap (the block sits between the 16 Jul and 27 Aug blocks).
-- Two payment runs for the same event, together exactly the August invoice gap
-- (KES 2,204,800):
--   Run A, rows 1294-1308: 15 payments, KES 1,462,800 - in the system but dated
--          2025-09-07; moved to the TRUE date 2025-08-09.
--   Run B, rows 1310-1321: 12 payments, KES 742,000 - never uploaded (phones were a broken
--          =CONCATENATE formula); added on 2025-08-09 with each person's phone from run A.
-- Expected after: August 2025 = 2,549 rows / KES 4,900,800 (= the August invoice);
-- September 2025 = 3,363 rows / KES 3,663,500.
-- These rows must be EXCLUDED from the later +1 day importer-bug backfill - they are
-- listed in perdiem_requests_backup_2025_nickole_9aug.
-- NOT a numbered migration - run manually in the Supabase SQL Editor.
-- The whole thing runs in one transaction; any failed check rolls it all back.

begin;

create temp table move_ids (id text primary key) on commit drop;
insert into move_ids (id) values
    ('f98c8555-1cc7-4044-9868-4665d1477fb9'),  -- Alex Wainaina Njihia, +254718967264, KES 127,600
    ('482f2024-f2f8-4c7e-8814-5bf6401915a9'),  -- Andrian Bosire, +254703209068, KES 88,400
    ('818fbf2d-f4ac-4d47-b073-fd038a835d97'),  -- Antony Lenaiyara, +254705807006, KES 117,600
    ('772791e7-7919-48f5-8cb6-5cf4b3b68ea7'),  -- Charles Simiyu, +254722334219, KES 88,400
    ('2d96ba68-6d31-45fa-94e7-cdcb8e9ea585'),  -- Dennis Nganga, +254701855641, KES 88,400
    ('0b53b247-9d35-45a9-b00c-701db59ca535'),  -- Eliakim Mzungu Mliwa, +254705604704, KES 108,000
    ('ef57fa32-80f8-4150-9a59-51b150b6eb44'),  -- Emma Ndirangu, +254722914298, KES 108,000
    ('6dcf47cc-5693-44aa-aa7a-f6f549831b8d'),  -- Francis Ndolo Ngumu, +254726298693, KES 88,400
    ('c6ed0dd3-60d3-4bc6-b682-a4e32bcd5955'),  -- Jeremy Kariuki, +254715653163, KES 88,400
    ('e6a4aa75-17a9-43f6-8df3-deeae8b140a7'),  -- Mary Ndorongo, +254720345866, KES 108,000
    ('c6039459-3fd9-4377-a68c-90ef1087ab8c'),  -- Meschack Kaminza, +254703848538, KES 78,400
    ('9ee7550c-0dfb-49fb-97e2-cbf71c4e8efa'),  -- Michael Kitheka Mwangangi, +254711481338, KES 88,400
    ('9309acb3-9833-468e-b3b0-1883a0946401'),  -- Paul Saunyi Lila, +254708949781, KES 88,400
    ('ee95a387-6e73-4095-b75e-5f29c1aa4e66'),  -- Rose King'ang'a, +254720473908, KES 88,400
    ('4f16e5ae-deaa-4a56-badc-7c759507c518');  -- Samuel Cheburet, +254721624338, KES 108,000

create temp table new_rows (id text primary key, participant_name text, participant_phone text, employer text, dha_staff boolean,
  transport double precision, dsa double precision, total double precision, notes text) on commit drop;
insert into new_rows values
    ('fd5fd97d-541e-4016-834b-60143022c186', 'Antony Lenaiyara', '+254705807006', 'DHA', true, 0, 84000, 84000, 'Workshop/Conference - Nickole Hotel Nanyuki, 2nd payment run (Kibet Q3 row 1310, sub-block total KES 742,000). Phone number referred from the same person''s row in the first run of this event (source phone was a broken CONCATENATE formula) (August 2025 audit).'),
    ('8901c547-ff88-4bcb-b96f-107990185abe', 'Mary Ndorongo', '+254720345866', 'DHA', true, 0, 70000, 70000, 'Workshop/Conference - Nickole Hotel Nanyuki, 2nd payment run (Kibet Q3 row 1311, sub-block total KES 742,000). Phone number referred from the same person''s row in the first run of this event (source phone was a broken CONCATENATE formula) (August 2025 audit).'),
    ('4512d120-70a1-4005-b330-37658b4dc7d0', 'Francis Ndolo Ngumu', '+254726298693', 'DHA', true, 0, 56000, 56000, 'Workshop/Conference - Nickole Hotel Nanyuki, 2nd payment run (Kibet Q3 row 1312, sub-block total KES 742,000). Phone number referred from the same person''s row in the first run of this event (source phone was a broken CONCATENATE formula) (August 2025 audit).'),
    ('5f0ff3ee-8fd3-4c76-af15-1db66497656f', 'Charles Simiyu', '+254722334219', 'DHA', true, 0, 56000, 56000, 'Workshop/Conference - Nickole Hotel Nanyuki, 2nd payment run (Kibet Q3 row 1313, sub-block total KES 742,000). Phone number referred from the same person''s row in the first run of this event (source phone was a broken CONCATENATE formula) (August 2025 audit).'),
    ('91f422ec-d2d1-4f0d-9b8c-846bb6c193db', 'Dennis Nganga', '+254701855641', 'DHA', true, 0, 56000, 56000, 'Workshop/Conference - Nickole Hotel Nanyuki, 2nd payment run (Kibet Q3 row 1314, sub-block total KES 742,000). Phone number referred from the same person''s row in the first run of this event (source phone was a broken CONCATENATE formula) (August 2025 audit).'),
    ('7337286b-d519-4f43-b055-887a1f37d67b', 'Paul Saunyi Lila', '+254708949781', 'DHA', true, 0, 56000, 56000, 'Workshop/Conference - Nickole Hotel Nanyuki, 2nd payment run (Kibet Q3 row 1315, sub-block total KES 742,000). Phone number referred from the same person''s row in the first run of this event (source phone was a broken CONCATENATE formula) (August 2025 audit).'),
    ('37451b17-3159-4f26-9a35-ba6e0142f330', 'Alex Wainaina Njihia', '+254718967264', 'DHA', true, 0, 84000, 84000, 'Workshop/Conference - Nickole Hotel Nanyuki, 2nd payment run (Kibet Q3 row 1316, sub-block total KES 742,000). Phone number referred from the same person''s row in the first run of this event (source phone was a broken CONCATENATE formula) (August 2025 audit).'),
    ('3ae04718-e308-4108-81df-3dbec6beeff2', 'Andrian Bosire', '+254703209068', 'DHA', true, 0, 56000, 56000, 'Workshop/Conference - Nickole Hotel Nanyuki, 2nd payment run (Kibet Q3 row 1317, sub-block total KES 742,000). Phone number referred from the same person''s row in the first run of this event (source phone was a broken CONCATENATE formula) (August 2025 audit).'),
    ('335819f5-e37c-4808-bb7f-ab1fb1023c2a', 'Michael Kitheka Mwangangi', '+254711481338', 'DHA', true, 0, 56000, 56000, 'Workshop/Conference - Nickole Hotel Nanyuki, 2nd payment run (Kibet Q3 row 1318, sub-block total KES 742,000). Phone number referred from the same person''s row in the first run of this event (source phone was a broken CONCATENATE formula) (August 2025 audit).'),
    ('d74c1845-6136-46dd-870e-98cdcab658dd', 'Emma Ndirangu', '+254722914298', 'DHA', true, 0, 56000, 56000, 'Workshop/Conference - Nickole Hotel Nanyuki, 2nd payment run (Kibet Q3 row 1319, sub-block total KES 742,000). Phone number referred from the same person''s row in the first run of this event (source phone was a broken CONCATENATE formula) (August 2025 audit).'),
    ('fb019097-7a7f-4cdc-becc-3adc96333fc0', 'Jeremy Kariuki', '+254715653163', 'DHA', true, 0, 56000, 56000, 'Workshop/Conference - Nickole Hotel Nanyuki, 2nd payment run (Kibet Q3 row 1320, sub-block total KES 742,000). Phone number referred from the same person''s row in the first run of this event (source phone was a broken CONCATENATE formula) (August 2025 audit).'),
    ('37065472-1dbe-46b7-aab1-887b8e88847b', 'Meschack Kaminza', '+254703848538', 'DHA', true, 0, 56000, 56000, 'Workshop/Conference - Nickole Hotel Nanyuki, 2nd payment run (Kibet Q3 row 1321, sub-block total KES 742,000). Phone number referred from the same person''s row in the first run of this event (source phone was a broken CONCATENATE formula) (August 2025 audit).');

-- Step 1: Safety checks.
do $$
declare n int; s double precision;
begin
  select count(*), coalesce(sum(p.total_perdiem), 0) into n, s
  from move_ids m join perdiem_requests p on p.id = m.id
  where p.date = '2025-09-07' and p.event_id = 'ed0dda2d-1a42-430b-bc71-1d7a754965da'
    and coalesce(p.recovered_amount, 0) = 0 and not coalesce(p.is_overpayment, false);
  if n <> 15 or s <> 1462800 then
    raise exception 'Run A check failed: % rows / KES % (expected 15 / 1462800)', n, s;
  end if;
  if (select count(*) from new_rows) <> 12 or (select sum(total) from new_rows) <> 742000 then
    raise exception 'Run B list is not 12 rows / KES 742000';
  end if;
  if exists (select 1 from perdiem_requests p join new_rows r on p.id = r.id) then raise exception 'An id already exists'; end if;
  if exists (select 1 from new_rows r where not exists (
      select 1 from move_ids m join perdiem_requests p on p.id = m.id where p.participant_phone = r.participant_phone)) then
    raise exception 'A run-B phone does not match a run-A row';
  end if;
  select count(*), coalesce(sum(total_perdiem), 0) into n, s from perdiem_requests where date between '2025-08-01' and '2025-08-31';
  if n <> 2522 or s <> 2696000 then raise exception 'August is not in the expected state: % / %', n, s; end if;
end $$;

-- Step 2: Backup / undo list. Undo with:
--   update perdiem_requests p set date = '2025-09-07' where p.id in (select id from perdiem_requests_backup_2025_nickole_9aug where action = 'moved');
--   delete from perdiem_requests where id in (select id from perdiem_requests_backup_2025_nickole_9aug where action = 'inserted');
create table perdiem_requests_backup_2025_nickole_9aug as
  select id, 'moved'::text as action, '2025-09-07'::text as old_date, '2025-08-09'::text as new_date, now() as changed_at from move_ids
  union all
  select id, 'inserted', null, '2025-08-09', now() from new_rows;

-- Step 3: Move run A.
do $$
declare n int;
begin
  update perdiem_requests set date = '2025-08-09' where id in (select id from move_ids) and date = '2025-09-07';
  get diagnostics n = row_count;
  if n <> 15 then raise exception 'Expected to move 15 rows, moved %', n; end if;
end $$;

-- Step 4: Add run B.
insert into perdiem_requests (
  id, client_id, participant_id, participant_name, participant_phone, event_id, event_name, location, date, status,
  notes, employer, dha_staff, transport_allowance, dsa_allowance, total_perdiem, imported_at, flag_reason, is_overpayment, recovered_amount)
select id, '87283dbf-d590-4f66-b28d-ffe8023a1f54', null, participant_name, participant_phone, 'ed0dda2d-1a42-430b-bc71-1d7a754965da', 'Workshop/Conference', '', '2025-08-09', 'Paid',
  notes, employer, dha_staff, transport, dsa, total, now(), null, false, 0
from new_rows;

-- Step 5: Event date list.
update events set event_dates = array['2025-08-09'] where id = 'ed0dda2d-1a42-430b-bc71-1d7a754965da' and event_dates = array['2025-09-07'];

-- Step 6: Check before committing.
do $$
declare n int; s double precision;
begin
  select count(*), coalesce(sum(total_perdiem), 0) into n, s from perdiem_requests where date between '2025-08-01' and '2025-08-31';
  if n <> 2549 or s <> 4900800 then raise exception 'August after the fix is % rows / KES % (expected 2549 / 4900800)', n, s; end if;
end $$;

commit;

-- Step 7: Verify - expect 2025-08 = 2549 / 4900800 and 2025-09 = 3363 / 3663500.
select substring(date, 1, 7) as month, count(*) as requests, sum(total_perdiem) as amount
from perdiem_requests where date between '2025-08-01' and '2025-09-30'
group by 1 order by 1;
