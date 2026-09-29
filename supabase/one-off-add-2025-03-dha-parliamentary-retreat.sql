-- One-off insert: DHA Regulation Parliamentary Retreat, 9-19 Mar 2025, Hilton Inn Hotel -
-- KES 2,500,000 cash withdrawal, 18 Mar 2025 (expense invoice "MOH Per Diem Management", item 1).
-- The withdrawal has no named payee, so it goes in as ONE payment under the event with a blank
-- phone and a descriptive name. The user confirmed (29 Sep 2026) that it is SEPARATE money from
-- the 32 Hilton Inn cash payments already in the system ("Workshop/Conference", KES 3,098,800,
-- paid 4 Apr 2025, April audit) - those are not touched.
-- Payment date 2025-03-18 is the TRUE date - this row must be EXCLUDED from the later +1 day
-- importer-bug backfill; it is listed in perdiem_requests_backup_2025_03_dha_retreat.
-- Expected after: March 2025 = 91 rows / KES 4,316,800 (was 90 / 1,816,800) - KES 85,600
-- below the March invoice (4,402,400).
-- NOT a numbered migration - run manually in the Supabase SQL Editor.
-- The whole thing runs in one transaction; any failed check rolls it all back.

begin;

-- Step 1: Safety checks.
do $$
declare n int; s double precision;
begin
  select count(*), coalesce(sum(total_perdiem), 0) into n, s from perdiem_requests where date between '2025-03-01' and '2025-03-31';
  if n <> 90 or s <> 1816800 then
    raise exception 'March is not in the expected state: % rows / KES % (expected 90 / 1816800) - already added?', n, s;
  end if;
  if exists (select 1 from events where name = 'DHA Regulation Parliamentary Retreat') then raise exception 'The retreat event already exists'; end if;
  if not exists (select 1 from venues where id = '879de480-f9f2-460c-bec2-4ebdf6aa01a6' and name = 'Hilton Inn Hotel') then raise exception 'Hilton Inn Hotel venue not found'; end if;
  if exists (select 1 from perdiem_requests where total_perdiem = 2500000 and date between '2025-03-01' and '2025-04-30') then
    raise exception 'A KES 2,500,000 payment already exists in Mar-Apr 2025';
  end if;
end $$;

-- Step 2: The event.
insert into events (id, client_id, name, created_at, event_dates, event_type, venue_id, venue_name, venue_city, facilitator,
                    training_start_date, training_end_date, number_of_training_days)
values ('64273be1-e590-46ee-a513-fde669d53f70', '87283dbf-d590-4f66-b28d-ffe8023a1f54', 'DHA Regulation Parliamentary Retreat', now(),
        array['2025-03-18'], 'Workshop', '879de480-f9f2-460c-bec2-4ebdf6aa01a6', 'Hilton Inn Hotel', '', 'Imported (historical)',
        '2025-03-09', '2025-03-19', 11);

-- Step 3: The withdrawal.
insert into perdiem_requests (
  id, client_id, participant_id, participant_name, participant_phone, event_id, event_name, location, date, status,
  notes, employer, transport_allowance, dsa_allowance, total_perdiem, imported_at, flag_reason, is_overpayment, recovered_amount)
values ('e5f8d711-039a-4b61-87fc-595e047c58ad', '87283dbf-d590-4f66-b28d-ffe8023a1f54', null,
        'Cash withdrawal - DHA Regulation Parliamentary Retreat (no named payee)', null,
        '64273be1-e590-46ee-a513-fde669d53f70', 'DHA Regulation Parliamentary Retreat', 'Hilton Inn Hotel', '2025-03-18', 'Paid',
        'Cash withdrawal of KES 2,500,000 on 18 Mar 2025 for the DHA Regulation Parliamentary Retreat (9-19 Mar 2025, Hilton Inn Hotel) - expense invoice "MOH Per Diem Management", item 1. No named payee. Separate from the 32 Hilton Inn cash payments of 4 Apr 2025 (user, 29 Sep 2026).',
        'MOH', 0, 0, 2500000, now(), null, false, 0);

-- Step 4: Backup / undo list. Undo with:
--   delete from perdiem_requests where id in (select id from perdiem_requests_backup_2025_03_dha_retreat where kind = 'payment');
--   delete from events where id in (select id from perdiem_requests_backup_2025_03_dha_retreat where kind = 'event');
create table perdiem_requests_backup_2025_03_dha_retreat as
  select 'e5f8d711-039a-4b61-87fc-595e047c58ad'::text as id, 'payment'::text as kind, 2500000::double precision as total, now() as inserted_at
  union all select '64273be1-e590-46ee-a513-fde669d53f70', 'event', null, now();

-- Step 5: Check before committing.
do $$
declare n int; s double precision;
begin
  select count(*), coalesce(sum(total_perdiem), 0) into n, s from perdiem_requests where date between '2025-03-01' and '2025-03-31';
  if n <> 91 or s <> 4316800 then raise exception 'March after the insert is % rows / KES % (expected 91 / 4316800)', n, s; end if;
end $$;

commit;

-- Step 6: Verify - expect 2025-03 = 91 / 4316800, and the retreat with 1 payment of 2,500,000.
select substring(date, 1, 7) as month, count(*) as requests, sum(total_perdiem) as amount
from perdiem_requests where date between '2025-03-01' and '2025-03-31' group by 1;
select e.name, e.venue_name, e.training_start_date, e.training_end_date, count(*), sum(p.total_perdiem)
from perdiem_requests p join events e on e.id = p.event_id
where e.name = 'DHA Regulation Parliamentary Retreat' group by 1, 2, 3, 4;
