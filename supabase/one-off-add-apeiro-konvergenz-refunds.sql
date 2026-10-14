-- One-off insert: Apeiro's "Konvergenz Refund from T4H" refund payments
-- (user, 14 Oct 2026). Two invoices, KES 67,489,108 in total:
--   INV00075  KES 40,000,000  paid 28 Jul 2025
--   INV00081  KES 27,489,108  paid 19 Aug 2025
-- Reference was "N/A" on the source sheet, so it is left blank.
-- Run AFTER 0037_funding_receipts.sql. Switches the Refunds module on
-- for Apeiro.
-- NOT a numbered migration - run manually in the Supabase SQL Editor.
-- The whole thing runs in one transaction; any failed check rolls it all back.

begin;

-- Step 1: Safety checks.
do $$
begin
  if (select count(*) from clients where name = 'Apeiro') <> 1 then
    raise exception 'Expected exactly one client named Apeiro';
  end if;
  if exists (
    select 1 from funding_receipts
    where client_id = (select id from clients where name = 'Apeiro')
      and upper(trim(invoice_no)) in ('INV00075', 'INV00081')
  ) then
    raise exception 'INV00075 / INV00081 are already recorded for Apeiro';
  end if;
end $$;

-- Step 2: Module on for Apeiro.
insert into client_modules (client_id, module_key, enabled)
select id, 'funding', true from clients where name = 'Apeiro'
on conflict (client_id, module_key) do update set enabled = true, updated_at = now();

-- Step 3: The two receipts.
insert into funding_receipts (client_id, invoice_no, description, payer, amount, received_date, reference, notes)
select c.id, v.invoice_no, 'Konvergenz Refund from T4H', 'T4H', v.amount, v.received_date::date, null,
       null
from clients c
cross join (values
  ('INV00075', 40000000.00, '2025-07-28'),
  ('INV00081', 27489108.00, '2025-08-19')
) as v (invoice_no, amount, received_date)
where c.name = 'Apeiro';

-- Step 4: Check the result.
do $$
declare n int; s numeric;
begin
  select count(*), coalesce(sum(amount), 0) into n, s
  from funding_receipts where client_id = (select id from clients where name = 'Apeiro');
  if n <> 2 or s <> 67489108 then
    raise exception 'Expected 2 receipts / KES 67,489,108 for Apeiro, got % / KES %', n, s;
  end if;
end $$;

commit;
