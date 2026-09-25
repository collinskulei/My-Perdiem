-- One-off fix: County L4 & 5 hospitals batch - 9 payments, KES 121,600 - typed
-- "23/05/2025" in Kibet's "Payment Analysis ..." Q2 2025 sheet (rows 292-300) but
-- paid on 23 April 2025 (confirmed by the user, 25 Sep 2026). The batch sits in
-- the sheet's April section and is billed on the April expense invoice. Stored in
-- the system as 2025-05-22; moved to the TRUE date 2025-04-23.
-- Expected after: April 2025 = 287 rows / KES 23,193,400; May 2025 = 297 rows /
-- KES 5,208,300.
-- These rows must be EXCLUDED from the later +1 day importer-bug backfill - they
-- are listed in perdiem_requests_backup_2025_county_l45_23apr.
-- NOT a numbered migration - run manually in the Supabase SQL Editor.
-- The whole thing runs in one transaction; any failed check rolls it all back.

begin;

create temp table fix_ids (id text primary key) on commit drop;
insert into fix_ids (id) values
    ('e0e09d89-2bb1-4a6e-aa61-93f4db345399'),  -- Loise Njoki Mwai, +254707022559, KES 11,200
    ('4760f0f5-8837-4a19-a0c1-6715f83d1f84'),  -- Paul Saunyi Lila, +254708949781, KES 78,400
    ('4c9bbc5e-cb79-4c82-a871-85d4fc07b415'),  -- Amour Riyamy, +254719999991, KES 4,000
    ('118840d1-091b-421b-bd10-97bf9f652679'),  -- Abu Shuraim, +254729069533, KES 2,000
    ('b6a08ff3-fc0d-4693-93d3-16947e13d4e0'),  -- Roble Hassan, +254729613713, KES 10,000
    ('3a050fff-0de1-43aa-85d5-147e69226502'),  -- Fred Obngwa, +254720020284, KES 2,000
    ('75c28968-01d5-40b1-bd0b-63cb4ee65333'),  -- Elias Mungori, +254725426770, KES 2,000
    ('8105b3f7-de05-424c-b421-6e3ad62beef5'),  -- Abdi Mumin, +254722757178, KES 10,000
    ('00c6fac5-235e-4304-bd88-6f3876999a1e');  -- Godfrey Odhiambo, +254714604927, KES 2,000

-- Step 1: Safety check - all 9 rows still on 2025-05-22 with the audited total.
do $$
declare n int; s double precision;
begin
  select count(*), coalesce(sum(p.total_perdiem), 0) into n, s
  from fix_ids f join perdiem_requests p on p.id = f.id
  where p.date = '2025-05-22' and p.event_id = 'df4c9611-3800-4b5d-923b-3f7f95e0c131'
    and coalesce(p.recovered_amount, 0) = 0 and not coalesce(p.is_overpayment, false);
  if n <> 9 or s <> 121600 then
    raise exception 'Safety check failed: % rows / KES % (expected 9 / 121600)', n, s;
  end if;
end $$;

-- Step 2: Backup. Undo with:
--   update perdiem_requests p set date = b.old_date
--   from perdiem_requests_backup_2025_county_l45_23apr b where p.id = b.id;
create table perdiem_requests_backup_2025_county_l45_23apr as
  select id, '2025-05-22'::text as old_date, '2025-04-23'::text as new_date, now() as changed_at from fix_ids;

-- Step 3: Move the dates.
do $$
declare n int;
begin
  update perdiem_requests set date = '2025-04-23'
  where id in (select id from fix_ids) and date = '2025-05-22';
  get diagnostics n = row_count;
  if n <> 9 then raise exception 'Expected to update 9 rows, updated %', n; end if;
end $$;

-- Step 4: The event's date list - add 23 Apr, drop 22 May if nothing else uses it.
update events set event_dates = array_append(event_dates, '2025-04-23')
where id = 'df4c9611-3800-4b5d-923b-3f7f95e0c131' and not ('2025-04-23' = any(event_dates));
update events set event_dates = array_remove(event_dates, '2025-05-22')
where id = 'df4c9611-3800-4b5d-923b-3f7f95e0c131'
  and not exists (select 1 from perdiem_requests where event_id = 'df4c9611-3800-4b5d-923b-3f7f95e0c131' and date = '2025-05-22');

commit;

-- Step 5: Verify - expect 2025-04 = 287 / 23193400 and 2025-05 = 297 / 5208300.
select substring(date, 1, 7) as month, count(*) as requests, sum(total_perdiem) as amount
from perdiem_requests where date between '2025-04-01' and '2025-05-31'
group by 1 order by 1;
