-- One-off fix: add the 6 July 2025 payments that are in Kibet's "Payment Analysis ..."
-- Q3 2025 sheet but not in the system - KES 152,800, the gap between the July
-- expense invoice (35,349,700) and the system (35,197,900) plus the KES 1,000 by
-- which the source exceeds the invoice.
--   * Gilbert Kamau - Workshop/Conference, Eseriani Resort, 12 Jul, KES 87,000 (row 1002).
--     Source phone "70089025" has lost digits; +254707089025 is the only number the
--     system holds for him (Oct 2024 and Dec 2025 payments). Not flagged.
--   * 5 EUT County Sub-Counties payments, 10 Jul, KES 65,800 - each person is listed
--     TWICE in the source block with the same amount (rows 119/372, 367/425, 366/426,
--     399/483, 123/579) and the system already holds one copy. The user confirmed
--     on 25 Sep 2026 that the bank paid each of them twice, so the second payments
--     are added WITHOUT a flag.
-- Expected after: July 2025 = 1,284 rows / KES 35,350,700 (= Kibet's 16 July events).
-- The dates are TRUE dates, so these rows must be EXCLUDED from the later +1 day
-- importer-bug backfill - they are listed in perdiem_requests_backup_2025_07_inserts.
-- NOT a numbered migration - run manually in the Supabase SQL Editor.
-- The whole thing runs in one transaction; any failed check rolls it all back.

begin;

create temp table new_rows (
  id text primary key, participant_name text, participant_phone text, event_id text, event_name text, pay_date text,
  employer text, dha_staff boolean, sha_staff boolean, transport double precision, dsa double precision, total double precision,
  notes text, flag_reason text) on commit drop;
insert into new_rows values
  ('7c1e4b2a-5d90-4f3e-8a61-2b7d9c0e4f11', 'Gilbert Kamau', '+254707089025', 'b0695ce1-d1b3-43a1-8a06-8e2c6dca482f', 'Workshop/Conference', '2025-07-12',
   'SHA', null, true, 3000, 84000, 87000,
   'Workshop/Conference - Eseriani Resort. Phone number referred from his other payments in the system (source phone 70089025 incomplete) (July 2025 audit).', null),
  ('3a8f6d21-0b4c-4e7a-9f52-6c1d8e2b7a02', 'Peter Chege', '+254790770284', '04a718c5-ea45-4819-b4a9-1d3146ad6fef', 'EUT', '2025-07-10',
   'DHA', true, null, 6000, 44800, 50800,
   'EUT - County Sub-Counties. Second payment - listed twice in the source (Q3 rows 119 & 372); two bank payments confirmed by the user 25 Sep 2026 (July 2025 audit).',
   null),
  ('9d2c7e40-6a1f-4b8d-b3e5-1f0a7c9d2e13', 'Jane Kimani', '+254795752941', '04a718c5-ea45-4819-b4a9-1d3146ad6fef', 'EUT', '2025-07-10',
   'Embu', null, null, 4500, 0, 4500,
   'EUT - County Sub-Counties. Second payment - listed twice in the source (Q3 rows 367 & 425); two bank payments confirmed by the user 25 Sep 2026 (July 2025 audit).',
   null),
  ('e5b1a9c3-2f7d-4c60-8e4a-7d3b0f1c6a24', 'Matilivo Mbutha', '+254729793588', '04a718c5-ea45-4819-b4a9-1d3146ad6fef', 'EUT', '2025-07-10',
   'Embu', null, null, 4500, 0, 4500,
   'EUT - County Sub-Counties. Second payment - listed twice in the source (Q3 rows 366 & 426); two bank payments confirmed by the user 25 Sep 2026 (July 2025 audit).',
   null),
  ('b0f4d8e6-9c3a-4d17-a2b9-5e8c1d7f3b35', 'Kelvin Mugendi', '+254716786796', '04a718c5-ea45-4819-b4a9-1d3146ad6fef', 'EUT', '2025-07-10',
   'Embu', null, null, 1500, 0, 1500,
   'EUT - County Sub-Counties. Second payment - listed twice in the source (Q3 rows 399 & 483); two bank payments confirmed by the user 25 Sep 2026 (July 2025 audit).',
   null),
  ('4f7a3c9e-1d5b-4a82-9c6e-8b2f0d4e1c46', 'Magdalene Mutie', '+254721574131', '04a718c5-ea45-4819-b4a9-1d3146ad6fef', 'EUT', '2025-07-10',
   'Embu', null, null, 4500, 0, 4500,
   'EUT - County Sub-Counties. Second payment - listed twice in the source (Q3 rows 123 & 579); two bank payments confirmed by the user 25 Sep 2026 (July 2025 audit).',
   null);

-- Step 1: Safety checks.
do $$
declare n int; s double precision;
begin
  select count(*), coalesce(sum(total_perdiem), 0) into n, s
  from perdiem_requests where date between '2025-07-01' and '2025-07-31';
  if n <> 1278 or s <> 35197900 then
    raise exception 'July is not in the expected state: % rows / KES % (expected 1278 / 35197900) - has something already been added?', n, s;
  end if;
  if (select count(*) from new_rows) <> 6 or (select sum(total) from new_rows) <> 152800 then
    raise exception 'Row list is not 6 rows / KES 152800';
  end if;
  if exists (select 1 from perdiem_requests p join new_rows r on p.id = r.id) then
    raise exception 'An id already exists';
  end if;
  if (select count(*) from events where id in ('04a718c5-ea45-4819-b4a9-1d3146ad6fef', 'b0695ce1-d1b3-43a1-8a06-8e2c6dca482f')) <> 2 then
    raise exception 'Expected events not found';
  end if;
  -- Exactly one copy of each repeated payment must already be there; Gilbert must not be.
  if exists (
    select 1 from new_rows r
    where (select count(*) from perdiem_requests p
           where p.event_id = r.event_id and p.date = r.pay_date and p.total_perdiem = r.total
             and right(p.participant_phone, 9) = right(r.participant_phone, 9))
          <> case when r.participant_name = 'Gilbert Kamau' then 0 else 1 end) then
    raise exception 'The existing copies are not as expected (Gilbert already there, or a repeated payment not exactly once)';
  end if;
end $$;

-- Step 2: The payments.
insert into perdiem_requests (
  id, client_id, participant_id, participant_name, participant_phone, event_id, event_name, location, date, status,
  notes, employer, dha_staff, sha_staff, transport_allowance, dsa_allowance, total_perdiem, imported_at, flag_reason, is_overpayment, recovered_amount)
select id, '87283dbf-d590-4f66-b28d-ffe8023a1f54', null, participant_name, participant_phone, event_id, event_name, '', pay_date, 'Paid',
  notes, employer, dha_staff, sha_staff, transport, dsa, total, now(), flag_reason, false, 0
from new_rows;

-- Step 3: Backup / undo list. Undo with:
--   delete from perdiem_requests where id in (select id from perdiem_requests_backup_2025_07_inserts);
create table perdiem_requests_backup_2025_07_inserts as
  select id, participant_name, pay_date, total, now() as inserted_at from new_rows;

-- Step 4: Check before committing.
do $$
declare n int; s double precision;
begin
  select count(*), coalesce(sum(total_perdiem), 0) into n, s
  from perdiem_requests where date between '2025-07-01' and '2025-07-31';
  if n <> 1284 or s <> 35350700 then
    raise exception 'July after insert is % rows / KES % (expected 1284 / 35350700)', n, s;
  end if;
end $$;

commit;

-- Step 5: Verify - expect 2025-07 = 1284 / 35350700.
select substring(date, 1, 7) as month, count(*) as requests, sum(total_perdiem) as amount
from perdiem_requests where date between '2025-07-01' and '2025-07-31'
group by 1;
