-- One-off cleanup: January 2025 audit ("2025 1 January System vs Source.xlsx").
-- The DHA Regulations Public Participation payments (paid 20 Jan 2025, stored
-- as 2025-01-19) were uploaded twice: once from Jonah's "DHA Public
-- Participation Q1 2025.xlsx" (event "DHA Regulations Public Participation
-- (14 Days)") and once from Kibet's "Payment Analysis ... Q1 2025" sheet
-- (event "Workshop/Conference", Enashipai). Same 63 people, same amounts.
-- Per the audit, keep the Jonah copy (it carries training dates/roles) and
-- remove the Kibet copy: 63 rows, KES 12,177,000.
--
-- The pairs below are the audit's "Duplicates to Remove" sheet (REMOVE / KEEP
-- request IDs), independently re-matched on the live DB by phone + transport +
-- DSA + total: all 63 pairs agree, each remove row has exactly one keep row,
-- all are status Paid, none flagged or with recoveries.
--
-- Before running: confirm against the 20-Jan-2025 bank statement that each
-- person was paid once (audit recommendation 3).
-- NOT a numbered migration - run manually in the Supabase SQL Editor.
-- The whole thing runs in one transaction; any failed check rolls it all back.

begin;

create temp table dup_pairs (remove_id text primary key, keep_id text not null) on commit drop;
insert into dup_pairs (remove_id, keep_id) values
    ('d6c83c62-6534-4fb3-8152-b1c1faee6fe5', '5b9b7b7e-18f9-419c-8fa3-74bfd13754f3'),  -- Silas Simatwo, +254722517998, KES 259800
    ('1cd473ff-b112-4afc-b8f3-328094ad437c', 'de7b64c2-8bcb-47ef-bdc0-0cb6695d5d2a'),  -- Lily Koros, +254722578626, KES 259800
    ('af805c5d-75f5-4408-a7a4-d4f8c97b3be6', '1f11060a-3b49-44bf-a4b9-25cb2a84aacd'),  -- Antony Lenayara, +254705807006, KES 259800
    ('a2925ccd-31d1-4835-8c31-f6dee76d833c', 'b36d6d69-e4b9-4102-aa2a-412330d887ca'),  -- Tom Odede, +254723944156, KES 240200
    ('a8a3211f-c219-47d6-8797-08fbf3d727b1', '6a0c1b83-b36f-4819-a996-b09c6c0638e5'),  -- Jeremiah Mumo, +254710370820, KES 201000
    ('35c10d35-d9dc-42d2-9bd4-13816af50479', '9104c622-8534-4ec8-a0e2-c550e4f61056'),  -- George Owiso, +254722923525, KES 201000
    ('f3378942-e0a8-4ecc-b38c-f90fc91d8db9', '9f171a1f-e531-4a90-8466-789f1082c32b'),  -- Joyce Wamicwe, +254727092998, KES 201000
    ('76092244-442e-407a-a2f2-dd543f293ba6', '7bf85bb0-4098-488f-b80e-c8e2ff990bc7'),  -- Diana Kamar, +254722674998, KES 201000
    ('b4dd1ff7-0740-4deb-a089-0b66944f5e07', '95e577ed-eab4-4ad4-857d-f5340fa45b43'),  -- Grace Kiragu, +254718160805, KES 161800
    ('044b9508-90a0-4a68-8564-c0f333190e17', '053f120d-0dbe-47ae-9d10-ea626c5f2941'),  -- Josephine Ochwando, +254723275061, KES 161800
    ('d8f6ff49-e03d-441e-93c8-f19720d919f2', 'edb3ae16-50a0-4102-bc81-c041be35ed54'),  -- Edith Torome, +254722993525, KES 240200
    ('fa0c8a8f-3ead-4e9c-9965-ab0499c1ef8e', 'd9c95f8d-eaef-4669-8602-c72245ef9dfd'),  -- Lilian Wanjiku, +254722809084, KES 240200
    ('c5fd5141-d26d-4206-955f-0faf5a01405a', '6a83f4bd-881a-4be1-96d5-728efc835d26'),  -- Charles Mulandi, +254720674684, KES 240200
    ('fecfe6cb-9871-4afd-a808-19782a7ce7e6', 'b253ba47-5208-47ae-9c9f-16dfe6cf55c8'),  -- Steven Ouko, +254729847538, KES 240200
    ('c180aa6b-57ba-4a1d-b133-a0e0a95cfc27', '731c4a0b-5403-4d9b-a44a-81cd4227a5cb'),  -- Ian Were, +254719186840, KES 240200
    ('ab5aebfc-29d1-472a-b8d1-b9cac717aee0', 'b6897829-6a7c-45df-8c6a-1fecebf38d80'),  -- Ayub Manya, +254722221266, KES 240200
    ('5f51e45f-cd92-4f90-b01d-495a51d5af39', 'c1c92a38-dec9-467b-a836-b524149724fd'),  -- Purity Kiunga, +254722474700, KES 201000
    ('c514d9d7-0ceb-4882-9300-f5464091e3db', 'a56b58be-9f00-4dcc-a2df-c58fbbf74f10'),  -- Wesley Ooga, +254720903265, KES 201000
    ('6f01888e-b088-4a8a-88fb-61d8817d3209', '4748f579-d70c-4823-8cc7-f4089d9c552d'),  -- Lucy Njagi, +254721665159, KES 201000
    ('c2beff6e-0a2a-42a1-8d40-9eda3a2f456d', '623ea228-2598-44b3-a431-135092ba64a4'),  -- Lilian Akisa, +254721439237, KES 201000
    ('96a341f5-ebab-45ca-96b8-c6c2dae73707', '7245e9ca-3c1e-4e01-8356-91d964eb61b3'),  -- Jane Karimi, +254727237836, KES 201000
    ('0818f63e-7e37-4df9-ae41-a884b7243d34', 'ef5bfe84-92ef-4a6b-9b53-de8a9499aae3'),  -- Mary Geitangi, +254720765205, KES 161800
    ('fdaf8614-cb4f-4d91-ae2e-3e217e17fc70', 'e4716123-e432-44bf-9990-a30a271e9007'),  -- Shadrack Koech, +254743062204, KES 161800
    ('8e83683e-d7f8-46a3-b7fc-5da88d7f337a', 'e96cb92a-4f8b-48d4-99f3-84614d2ec030'),  -- Joy Kuisa, +254799380166, KES 161800
    ('8fb6842f-1dc7-416e-98b3-c8d83f428a52', '04fdf21b-2914-4f04-b10c-f9ff14560c40'),  -- David Igecha, +254704607465, KES 161800
    ('d64edf47-b83b-4659-a3e1-8e344a0b2b10', 'c44a391a-3270-4f47-ba55-e5b38fbfbd3d'),  -- Lilian Kevogo, +254726334077, KES 161800
    ('1df3a079-c800-430e-992d-1da14fe72e04', '6430b742-91ca-4ff7-8f57-273847d0cd7d'),  -- Edwin Mutendwa, +254718407180, KES 161800
    ('ef1593d0-68d0-4e6a-b3e9-ef161f82f318', '4192d1b3-e170-416b-92f2-6ecbbc89108d'),  -- Moses Gitahi, +254703654292, KES 161800
    ('1a70eb5e-25f9-418c-ade1-fdc1861a6add', '8f9886e5-8d3d-4251-9b65-569665574797'),  -- Ashley Shivachi, +254721937057, KES 161800
    ('2ae6bec6-7ec8-40ae-8b15-c8678d1be584', 'd6323c55-a0cf-4229-83e9-4bc124329312'),  -- David Njagih, +254746548656, KES 161800
    ('1a999359-978d-4349-881b-09caa047d6f7', '368e27da-4f07-482e-89a1-b14ce463cd5d'),  -- Brian Kori, +254705898718, KES 161800
    ('86c1b079-eb00-48d5-b83c-c715607acf98', '666357ee-a392-4e35-b41a-e81d462938ab'),  -- Justinah Mwikali, +254722371254, KES 161800
    ('5a578f9f-0f69-48ad-9012-dea237f1ae23', '9fcfd874-eedc-4e8a-bb89-da054813f94b'),  -- Paul Kasioki, +254722486567, KES 156800
    ('ba57637c-6daf-4e49-b482-b6fa9404ac92', '54c38319-9a66-4975-b5aa-5e5fa2354421'),  -- Geoffrey Cheprot, +254722425471, KES 161800
    ('df0c65b8-5d00-47b6-83de-eef5bdce3d89', '1d1c116e-097a-4fbb-a134-b5b4d5b787b5'),  -- Oscar Omari, +254713116934, KES 93200
    ('774964b4-9451-48b4-99e2-34f074f1ec70', '095d6688-ce41-43d7-9998-aa1f2b3d7ff9'),  -- Luke Kipyekomen, +254721809700, KES 88200
    ('af93c1c7-f225-48e0-a588-630d3c236bce', 'e5465867-ac92-4ea1-8f77-8eaeb735b4ab'),  -- Julius Momanyi, +254725200769, KES 88200
    ('636b4f49-a5d9-4ff6-8298-385e9c282e0f', 'efd10a8c-31c6-4100-aeff-0c2973c06895'),  -- Lincoln Kinyunye, +254722926670, KES 88200
    ('b48c9e7f-0457-4f28-90b4-7f7dda73ebb0', 'b52bb2d8-de45-4d13-93f6-185824969a85'),  -- Nicholas Macharia, +254725628098, KES 88200
    ('8a891dea-f190-48b1-a806-9e3696ff5deb', '7ffb9f7a-1c9d-47ad-8344-3ef4f53785b0'),  -- Salesio Muriuki, +254721555163, KES 88200
    ('197a0719-4845-4e22-86bc-9b1b3b7b1b36', '5f1af908-ef34-47cc-99a9-65909dddc2b1'),  -- Samuel Kipngok, +254719274590, KES 88200
    ('15e5a6a7-79f5-43d3-a218-e8517cdcfa4c', '3e3f3744-d5f9-4134-9502-3ea4e133f97c'),  -- Edward Mwenda, +254721441030, KES 88200
    ('25a8fa6b-4192-435d-a1dc-faa6199cf3f9', 'd1171762-2954-456c-a7cf-30b3fb10367d'),  -- Joshua Mwangi, +254721715618, KES 88200
    ('35526f51-d4d2-4e28-87c8-aa396d59b26a', '3402a87b-7e59-474b-ac64-1a3428e0ac8e'),  -- Abdi Mohamed, +254721222784, KES 259800
    ('6e4959ea-80e7-4cea-993f-5e31db59c4e0', '176d2c8e-1725-47ea-aaf1-3b1e1f12822b'),  -- Terry Rotich, +254725488820, KES 240200
    ('385a563d-bf44-4e2f-808c-2d2229228c19', '778251fd-b911-46fe-928e-bbb400cec4ba'),  -- Harry K. Kimtai, +254722415721, KES 259800
    ('12533f88-ca23-4181-9ebc-696ada403f4d', '86e52e35-f718-452b-a178-9b908bb52512'),  -- Patrick Amoth, +254721518918, KES 259800
    ('539a3984-a011-4edc-8153-fb7b325b7238', 'ddc10c38-bbf6-476b-b532-d4b040ac2142'),  -- Andrew Rukaria, +254722707511, KES 259800
    ('6982f501-bc63-46aa-a84a-981aaf3a79f5', '4252da6f-3edf-4798-9b76-c03df4c3cc73'),  -- Daniel Mwai, +254720757539, KES 259800
    ('865a9077-9188-4e34-8c79-992aa95813c0', 'f46b8126-ee46-428d-b456-0ad46ce6ed4c'),  -- Thuranira Kaugiria, +254720923288, KES 259800
    ('31552fba-0fae-4bf0-821f-7492790e3903', '7526b26c-5143-492c-883a-59a586f1ac85'),  -- Zeinab Gura, +254719679196, KES 240200
    ('de1a41e7-714b-4152-af76-f822eaad12bf', '73f4c5d0-57fa-46bb-9a24-79c7a3aeb78c'),  -- Catherine Ochanda, +254721332807, KES 240200
    ('361fa6ac-5f80-4adb-b98f-da60a707180a', '8ea5ef18-bc1c-4a57-bb1b-9e4887f5b3eb'),  -- Irene Ogamba, +254722400585, KES 240200
    ('1d5ff3e3-87c7-4d05-a1c1-feaea3a265e2', '141b66db-f11a-4ee6-8e8e-4f3549d03ee5'),  -- Emmanuel Bitta, +254722948583, KES 240200
    ('4a34e28e-f132-4d23-b255-c4ea8d66ea6e', '3719f951-4102-4055-b88b-fb2705afdfad'),  -- Nevis Ombasa, +254727323305, KES 240200
    ('49970688-7e0c-46f3-ab31-b8b3565d6c40', '75fe4956-0f08-4309-8da2-ef6f3cf95513'),  -- Wilson Dima Dima, +254722759328, KES 240200
    ('6cd942e5-bbb0-4d8f-9284-a36872a2f83e', '4c5d3987-6f46-4b44-9b10-66ca46dcb5e7'),  -- Faith Rotich, +254711151863, KES 240200
    ('7a179735-9b6e-4ea5-9715-fa7c32900702', 'bdd213ea-a086-4bb1-8d13-611b4a25e963'),  -- Odongo Mohammed, +254720789484, KES 201000
    ('7de676bd-3b0b-4428-8949-0f34ef52fb9e', 'db6ad2f9-b881-4343-a0cd-f26e55aae4cf'),  -- Susan Kamau, +254722296148, KES 201000
    ('cbfc5705-e3af-403e-9d41-44ab95dc9793', '34a57c74-668a-4eda-afa8-e2e4b226978c'),  -- Judy Chepkirui, +254714010337, KES 201000
    ('d664cdda-955d-4ba7-aa20-9a51c0e17295', 'f1ce87bb-98ef-4ece-a137-00a3195d148e'),  -- Abigael Muinde, +254723061909, KES 201000
    ('291fcc0e-964e-47cd-ae92-f5ce24599e6c', 'e6298f9e-7b8d-4f9a-b46d-3480389209fe'),  -- Doreen Mwende, +254741674891, KES 201000
    ('c6611a86-91f8-4993-b46e-b3212ae2180f', '81f071ef-df85-4df3-8ff5-116d6b228704');  -- Justice Thuranira, +254711373465, KES 201000

-- Step 1: Safety checks - every pair must still look like a duplicate.
do $$
declare
  n_remove int; n_keep int; remove_sum double precision;
begin
  select count(*), coalesce(sum(r.total_perdiem), 0) into n_remove, remove_sum
  from dup_pairs d
  join perdiem_requests r on r.id = d.remove_id
  join perdiem_requests k on k.id = d.keep_id
  where r.event_id = '0d4a0826-70c2-4da0-a2ed-72e073db9e59'
    and r.date = '2025-01-19' and k.date = '2025-01-19'
    and k.event_name = 'DHA Regulations Public Participation (14 Days)'
    and r.participant_phone = k.participant_phone
    and r.total_perdiem = k.total_perdiem
    and coalesce(r.transport_allowance, 0) = coalesce(k.transport_allowance, 0)
    and coalesce(r.dsa_allowance, 0) = coalesce(k.dsa_allowance, 0)
    and coalesce(r.recovered_amount, 0) = 0;
  select count(*) into n_keep from perdiem_requests where id in (select keep_id from dup_pairs);
  if n_remove <> 63 or n_keep <> 63 or remove_sum <> 12177000 then
    raise exception 'Safety check failed: % remove rows, % keep rows, KES % (expected 63 / 63 / 12177000)',
      n_remove, n_keep, remove_sum;
  end if;
end $$;

-- Step 2: Backup - a permanent copy of the rows being removed, so this can be
-- undone with: insert into perdiem_requests select * from perdiem_requests_backup_2025_01_duplicates;
create table perdiem_requests_backup_2025_01_duplicates as
  select * from perdiem_requests where id in (select remove_id from dup_pairs);

-- Step 3: Delete the Kibet copies.
do $$
declare n int;
begin
  delete from perdiem_requests where id in (select remove_id from dup_pairs);
  get diagnostics n = row_count;
  if n <> 63 then raise exception 'Expected to delete 63 rows, deleted %', n; end if;
end $$;

-- Step 4: The Kibet event keeps its 2025-09-30 rows; drop the now-empty
-- 2025-01-19 date from it.
update events
set event_dates = array_remove(event_dates, '2025-01-19')
where id = '0d4a0826-70c2-4da0-a2ed-72e073db9e59'
  and not exists (
    select 1 from perdiem_requests
    where event_id = '0d4a0826-70c2-4da0-a2ed-72e073db9e59' and date = '2025-01-19'
  );

commit;

-- Step 5: Verify - expect 63 rows on 2025-01-19 (all DHA Regulations Public
-- Participation), and 63 rows / 12177000 in the backup table.
select event_name, count(*), sum(total_perdiem) from perdiem_requests
where date = '2025-01-19' group by event_name;
select count(*), sum(total_perdiem) from perdiem_requests_backup_2025_01_duplicates;
