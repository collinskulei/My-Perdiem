-- One-off fix: Workshop/Conference - Maanzoni Lodge Machakos - 13 payments,
-- KES 927,600 - paid on 23 July 2025 (confirmed by the user, 25 Sep 2026), not
-- 23 June. It was typed 23/6/2026 in Kibet's "Payment Analysis ..." Q2 2025 sheet
-- (rows 707-719) and moved to 2025-06-23 by the remaining-corrections script; the
-- June expense invoice (KES 460,500) does not include it.
-- Expected after: June 2025 = 98 rows / KES 460,500 (= the June invoice);
-- July 2025 = 1,168 rows / KES 25,309,100.
-- The date is the TRUE date, so these rows must be EXCLUDED from the later +1 day
-- importer-bug backfill - they are listed in perdiem_requests_backup_2025_maanzoni_23jul.
-- NOT a numbered migration - run manually in the Supabase SQL Editor.
-- The whole thing runs in one transaction; any failed check rolls it all back.

begin;

create temp table fix_ids (id text primary key) on commit drop;
insert into fix_ids (id) values
    ('566d3c4e-c7e3-43cf-b30e-8f97ec8d5c6f'),  -- Alex Wainaina Njihia, +254718967264, KES 94,000
    ('1fcbb5da-9594-4775-bdb9-7db0d4f03d3d'),  -- Antony Lenaiyara, +254705807006, KES 84,000
    ('91f04cc7-db29-433e-a4f7-f9c5dcd04e4a'),  -- Charles Simiyu, +254722334219, KES 66,000
    ('d861d334-6153-4213-bdb4-acb0760a454f'),  -- Dennis Nganga, +254701855641, KES 66,000
    ('8989bf6d-4703-48b6-8201-3d22a7cf71a4'),  -- Emma Ndirangu, +254722914298, KES 80,000
    ('a2d0d2a7-4d70-4f0d-96a6-48236dcebf5a'),  -- Francis Ndolo Ngumu, +254726298693, KES 66,000
    ('e1963910-ce16-4d26-b406-e7df8b4139ed'),  -- Hellen Wanyaga, +254722779750, KES 80,000
    ('0fff259b-9cf4-4e30-a40d-3149d9672ac7'),  -- Martha Wangari, +254724118305, KES 66,000
    ('744ae917-95dc-460b-a33d-b2c6f3ba1778'),  -- Mary Ndorongo, +254720345866, KES 80,000
    ('b4cb98e6-133b-4d1f-87ba-09864a8fdc42'),  -- Meschack Kaminza, +254703848538, KES 56,000
    ('e449684b-36b4-4038-9b2d-4f84c78f4268'),  -- Paul Saunyi Lila, +254708949781, KES 66,000
    ('ba3075a6-14a3-436f-b0e5-efa95b265609'),  -- Rose Kinganga, +254720473908, KES 43,600
    ('496401ad-a689-4b12-b27f-910ec8157615');  -- Samuel Cheburet, +254721624338, KES 80,000

-- Step 1: Safety check - all 13 rows still on 2025-06-23 with the audited total.
do $$
declare n int; s double precision;
begin
  select count(*), coalesce(sum(p.total_perdiem), 0) into n, s
  from fix_ids f join perdiem_requests p on p.id = f.id
  where p.date = '2025-06-23' and p.event_id = '9e842976-d22b-4f55-98c8-c768a524f4fa'
    and coalesce(p.recovered_amount, 0) = 0 and not coalesce(p.is_overpayment, false);
  if n <> 13 or s <> 927600 then
    raise exception 'Safety check failed: % rows / KES % (expected 13 / 927600)', n, s;
  end if;
end $$;

-- Step 2: Backup. Undo with:
--   update perdiem_requests p set date = b.old_date
--   from perdiem_requests_backup_2025_maanzoni_23jul b where p.id = b.id;
create table perdiem_requests_backup_2025_maanzoni_23jul as
  select id, '2025-06-23'::text as old_date, '2025-07-23'::text as new_date, now() as changed_at from fix_ids;

-- Step 3: Move the dates.
do $$
declare n int;
begin
  update perdiem_requests set date = '2025-07-23'
  where id in (select id from fix_ids) and date = '2025-06-23';
  get diagnostics n = row_count;
  if n <> 13 then raise exception 'Expected to update 13 rows, updated %', n; end if;
end $$;

-- Step 4: The event's date list (only this workshop's rows use it).
update events set event_dates = array['2025-07-23']
where id = '9e842976-d22b-4f55-98c8-c768a524f4fa' and event_dates = array['2025-06-23'];

commit;

-- Step 5: Verify - expect 2025-06 = 98 / 460500 and 2025-07 = 1168 / 25309100.
select substring(date, 1, 7) as month, count(*) as requests, sum(total_perdiem) as amount
from perdiem_requests where date between '2025-06-01' and '2025-07-31'
group by 1 order by 1;
