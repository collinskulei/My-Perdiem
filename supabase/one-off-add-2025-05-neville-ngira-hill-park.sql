-- One-off fix: add Neville Ngira's TOT - Hill Park Hotel payment of 29 May 2025
-- (KES 7,500 transport, no DSA) - Kibet's "Payment Analysis ..." Q2 2025 sheet,
-- row 584, the one May 2025 payment missing from the system. The source phone
-- "7254883606" is malformed; the phone used is +254725488225, the only number the
-- system holds for him across 7 other payments (Mar 2025 - Sep 2026). He was also
-- paid KES 7,500 the same day for EUT - Weston Hotel; the user confirmed on
-- 25 Sep 2026 that the bank shows two payments, so this is not a duplicate.
-- Expected after: May 2025 = 298 rows / KES 5,215,800 (= the May expense invoice).
-- The date is the TRUE date, so this row must be EXCLUDED from the later +1 day
-- importer-bug backfill - it is listed in perdiem_requests_backup_2025_05_neville_insert.
-- NOT a numbered migration - run manually in the Supabase SQL Editor.
-- The whole thing runs in one transaction; any failed check rolls it all back.

begin;

-- Step 1: Safety checks.
do $$
declare n int; s double precision;
begin
  select count(*), coalesce(sum(total_perdiem), 0) into n, s
  from perdiem_requests where date between '2025-05-01' and '2025-05-31';
  if n <> 297 or s <> 5208300 then
    raise exception 'May is not in the expected state: % rows / KES % (expected 297 / 5208300)', n, s;
  end if;
  if not exists (select 1 from events where id = '9ba7c013-1124-4e56-8b43-f3efcb2b3ad8' and venue_name = 'Hill Park Hotel') then
    raise exception 'Hill Park Hotel TOT event not found';
  end if;
  if exists (select 1 from perdiem_requests
             where event_id = '9ba7c013-1124-4e56-8b43-f3efcb2b3ad8' and right(participant_phone, 9) = '725488225') then
    raise exception 'Neville Ngira is already on the Hill Park Hotel TOT event';
  end if;
end $$;

-- Step 2: The payment.
insert into perdiem_requests (
  id, client_id, participant_id, participant_name, participant_phone, event_id, event_name, location, date, status,
  notes, employer, transport_allowance, dsa_allowance, total_perdiem, imported_at, flag_reason, is_overpayment, recovered_amount)
values (
  '5b1d0c8e-7a44-4f2e-9d61-3c8e2f0a9b17', '87283dbf-d590-4f66-b28d-ffe8023a1f54', null, 'Neville Ngira', '+254725488225',
  '9ba7c013-1124-4e56-8b43-f3efcb2b3ad8', 'TOT', '', '2025-05-29', 'Paid',
  'TOT - Hill Park Hotel. Phone number referred from his other payments in the system (source phone 7254883606 is malformed). Second payment on 29 May 2025 (also paid for EUT - Weston Hotel the same day) - two bank payments confirmed (May 2025 audit).',
  'Nairobi', 7500, 0, 7500, now(), null, false, 0);

-- Step 3: Event date list.
update events set event_dates = array_append(event_dates, '2025-05-29')
where id = '9ba7c013-1124-4e56-8b43-f3efcb2b3ad8' and not ('2025-05-29' = any(event_dates));

-- Step 4: Backup / undo list. Undo with:
--   delete from perdiem_requests where id in (select id from perdiem_requests_backup_2025_05_neville_insert);
create table perdiem_requests_backup_2025_05_neville_insert as
  select '5b1d0c8e-7a44-4f2e-9d61-3c8e2f0a9b17'::text as id, '2025-05-29'::text as pay_date, 7500::double precision as total, now() as inserted_at;

-- Step 5: Check before committing.
do $$
declare n int; s double precision;
begin
  select count(*), coalesce(sum(total_perdiem), 0) into n, s
  from perdiem_requests where date between '2025-05-01' and '2025-05-31';
  if n <> 298 or s <> 5215800 then
    raise exception 'May after insert is % rows / KES % (expected 298 / 5215800)', n, s;
  end if;
end $$;

commit;

-- Step 6: Verify - expect 2025-05 = 298 / 5215800.
select substring(date, 1, 7) as month, count(*) as requests, sum(total_perdiem) as amount
from perdiem_requests where date between '2025-04-01' and '2025-05-31'
group by 1 order by 1;
