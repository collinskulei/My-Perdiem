-- One-off fix: Bomet CHP SHA upload (28 Sep 2026) was saved under the event name "CHP"
-- instead of the name in the upload file, "Bomet County — CHP SHA Payment (October 2024)".
-- Renames ONLY the 5 Bomet sub-county events created by that upload (by id - 75 other
-- events are also named "CHP" and are not touched) and the event_name on their 2,480 payments.
-- No amounts or dates change: Analytics totals stay the same
-- (September 2025 = 14,895 rows / KES 2,080,594 of it Bomet).
-- NOT a numbered migration - run manually in the Supabase SQL Editor.
-- The whole thing runs in one transaction; any failed check rolls it all back.

begin;

create temp table bomet_events (id text primary key, venue_name text) on commit drop;
insert into bomet_events values
    ('68b5f848-235a-4a30-9b2c-d401bedaa723', 'Bomet Central Sub-County'),
    ('f6e6d90f-5656-4d92-802d-a77dc4286db0', 'Bomet East Sub-County'),
    ('45fcbf2e-d037-4ce0-bd97-2272814de2a3', 'Chepalungu Sub-County'),
    ('758ed7a2-1245-488b-bcf1-e68403b940e5', 'Konoin Sub-County'),
    ('03c7359c-6b05-483c-80db-30fb137160dc', 'Sotik Sub-County');

-- Step 1: Safety checks.
do $$
declare n int; s double precision;
begin
  if (select count(*) from events e join bomet_events b on b.id = e.id and b.venue_name = e.venue_name where e.name = 'CHP') <> 5 then
    raise exception 'The 5 Bomet events are not all named CHP with the expected venues - already fixed?';
  end if;
  select count(*), coalesce(sum(total_perdiem), 0) into n, s from perdiem_requests where event_id in (select id from bomet_events);
  if n <> 2480 or s <> 2080594 then
    raise exception 'Bomet payments are % rows / KES % (expected 2480 / 2080594)', n, s;
  end if;
  if exists (select 1 from events where name = 'Bomet County — CHP SHA Payment (October 2024)') then
    raise exception 'An event with the Bomet name already exists';
  end if;
end $$;

-- Step 2: Backup / undo list. Undo with:
--   update events e set name = b.old_name from perdiem_requests_backup_2025_09_bomet_name b where b.kind = 'event' and e.id = b.id;
--   update perdiem_requests p set event_name = b.old_name from perdiem_requests_backup_2025_09_bomet_name b where b.kind = 'payment' and p.id = b.id;
create table perdiem_requests_backup_2025_09_bomet_name as
  select id, 'event'::text as kind, name as old_name, now() as backed_up_at from events where id in (select id from bomet_events)
  union all
  select id, 'payment', event_name, now() from perdiem_requests where event_id in (select id from bomet_events);

-- Step 3: Rename.
update events set name = 'Bomet County — CHP SHA Payment (October 2024)' where id in (select id from bomet_events);
update perdiem_requests set event_name = 'Bomet County — CHP SHA Payment (October 2024)' where event_id in (select id from bomet_events);

-- Step 4: Check before committing.
do $$
begin
  if (select count(*) from events where name = 'Bomet County — CHP SHA Payment (October 2024)') <> 5 then raise exception 'Expected 5 renamed events'; end if;
  if (select count(*) from perdiem_requests where event_name = 'Bomet County — CHP SHA Payment (October 2024)') <> 2480 then raise exception 'Expected 2480 renamed payments'; end if;
  if (select count(*) from events where name = 'CHP') <> 70 then raise exception 'Other CHP events changed unexpectedly'; end if;
end $$;

commit;

-- Step 5: Verify - expect 5 rows, 2,480 payments, KES 2,080,594.
select e.venue_name, count(*), sum(p.total_perdiem) from perdiem_requests p join events e on e.id = p.event_id
where e.name = 'Bomet County — CHP SHA Payment (October 2024)' group by 1 order by 1;
