-- One-off fix: TOT - Windsor Golf Hotel & Country Club - 110 payments,
-- KES 9,888,800 - paid on 9 July 2025, not 7 September. It is the first block of
-- Kibet's "Payment Analysis ..." Q3 2025 sheet (rows 6-116), above all the 10 July
-- blocks; its Excel date 2025-09-07 is the same day/month swap as every other
-- Excel date in that section (10/07 stored as 2025-10-07), i.e. 9 July 2025. With it
-- July has 16 events, matching the user's invoice records (25 Sep 2026).
-- Stored in the system as 2025-09-06; moved to the TRUE date 2025-07-09. The same
-- event also holds 35 May 2025 payments (2025-05-20), which are not touched.
-- Expected after: July 2025 = 1,278 rows / KES 35,197,900;
-- September 2025 = 3,378 rows / KES 5,126,300.
-- These rows must be EXCLUDED from the later +1 day importer-bug backfill - they
-- are listed in perdiem_requests_backup_2025_windsor_golf_9jul.
-- NOT a numbered migration - run manually in the Supabase SQL Editor.
-- The whole thing runs in one transaction; any failed check rolls it all back.

begin;

create temp table fix_ids (id text primary key) on commit drop;
insert into fix_ids (id) values
    ('2a40b982-c7ef-48c7-9b54-0b359990ef33'),  -- Abdi Shale, +254720756720, KES 93,000
    ('115ca3d0-450b-4724-bd31-a94fe2186eb7'),  -- Abdikadir Hussein, +254726666616, KES 96,000
    ('47f680e8-d1f5-4a7d-a9ce-e5f39361da54'),  -- Aden Hambe, +254722625921, KES 79,000
    ('ac97d10e-bbc0-47e3-873c-3c5ea60ccd5d'),  -- Ahmed Abdi Noor, +254721461367, KES 96,000
    ('0d5f3e83-0cca-46de-911b-8a6d49ffabd2'),  -- Ahmed Abdullah, +254792189890, KES 96,000
    ('08553b27-d4a2-45f0-99c3-ed0afa1b2a42'),  -- Ahmed Kusow Shuriye, +254721270828, KES 96,000
    ('918770f2-1c74-4985-8015-f96b9debea67'),  -- Ali Abdullahi Abdile, +254724108879, KES 96,000
    ('1a1eefff-d5a3-44d7-bc9c-4ce15a28fc1e'),  -- Aloise Lekupe Keretina, +254720803739, KES 93,000
    ('8e0f30cb-8ccc-475d-8339-30925ad9ee58'),  -- Angeline Otieno, +254713710198, KES 79,200
    ('fa245799-2eea-4dbf-b10e-fdd9e3b343c2'),  -- Bashir Hassan, +254742021105, KES 96,000
    ('7df1473a-00ff-4e70-a500-52be1e49c113'),  -- Benjamin M Makau, +254723802599, KES 93,000
    ('032c7deb-7de0-44ee-940c-7abe28704334'),  -- Benson Kamau, +254710430462, KES 96,000
    ('2f08d3b7-e4cd-4be9-a967-642f5038fdb2'),  -- Benson Mwasi, +254722617542, KES 93,000
    ('4773f0ca-b963-4f92-8431-17439c6a7836'),  -- Boniface Olalo, +254710895557, KES 96,000
    ('6b9b02ef-79bd-49d0-bed1-699ceeee5b8e'),  -- Carolyne Jelagat Kenduiywo, +254715433750, KES 93,000
    ('8915ce37-f8d2-4b10-86e9-c9ca9f4bb1ed'),  -- Castro Mugalla, +254721766662, KES 93,000
    ('a8b9f401-9e62-47df-863d-8531bd0db221'),  -- Catherine Mbulwa Kikuvi, +254720625380, KES 93,000
    ('a8850705-2bb9-440a-b6d3-8e89a1aebf73'),  -- Ceaser Mwenda Kisyula, +254712075590, KES 76,200
    ('67df3f64-525a-456e-b8f2-58c1dace1363'),  -- Christine Wakesho, +254721325788, KES 93,000
    ('5b99ba92-d099-4ac8-921c-cb4c73be7ca1'),  -- Cornelius Kiptoo Kotut, +254728800600, KES 93,000
    ('59fc3beb-8551-4e58-846b-f1532d7bdb86'),  -- Daniel Lepartanapa, +254725094044, KES 93,000
    ('684042b9-b28c-4b24-8f2a-388c730d6219'),  -- Daniel Mithamo, +254712513489, KES 79,200
    ('c98c89a6-77fa-45df-9fc4-866cd52dcf27'),  -- Daniel Murithi, +254726260517, KES 79,200
    ('3ac5da27-95e3-472f-b804-f8518d0678f7'),  -- Daniel Mwangi Maina, +254708667455, KES 96,000
    ('ded4552a-e81b-40fa-b709-b8319fda7ab1'),  -- Daniella Makena Gichuru, +254725900450, KES 93,000
    ('144fcd27-f160-44e2-a238-a02df08d3434'),  -- David Makorre Nyamohanga, +254722931712, KES 96,000
    ('c63aee4a-2571-4c29-88e3-028eb77ded7c'),  -- Deka Mohamed Abdi, +254720452390, KES 96,000
    ('841e8a70-1106-41d9-9194-1d28a29846ed'),  -- Dennis M. Wahome, +254720791020, KES 96,000
    ('b8d48236-b52e-4130-91c2-2ea7799c6772'),  -- Dennis Muthomi Mutegi, +254728090004, KES 96,000
    ('87a305e8-2e3d-4b6a-88aa-e755dec012d7'),  -- Diana Kamar, +254722674998, KES 96,000
    ('dda9ebb0-5c45-44dc-a5ae-5ab8e113402f'),  -- Diana Kamar, +254722674998, KES 93,000
    ('536cabd6-71e3-42a8-93f7-2b6150597454'),  -- Dickson Koech, +254720392925, KES 93,000
    ('1cb4a25c-1a6d-4fbc-847f-836cc90db5b5'),  -- Doris Kirumba, +254721430404, KES 96,000
    ('104f9558-8a90-4168-b845-bf33f14604ba'),  -- Dr Stephen Walunywa, +254724108003, KES 93,000
    ('c187cc46-3419-409b-a98a-8de8b753235b'),  -- Dr. Tracy Njonjo, +254722719780, KES 96,000
    ('02dd9d26-cffc-4093-9366-b1371da95787'),  -- Edwina Anyango, +254722469473, KES 93,000
    ('ce713a30-5274-458c-91e1-5f8621c7e9a7'),  -- Eleanor Kemunto Nyachae, +254700511944, KES 96,000
    ('131af189-113b-4969-af89-115ae38e1698'),  -- Emilly Dorothy Atieno, +254720735397, KES 96,000
    ('846fb1a8-bec7-4ea2-88a8-12530cf8a2ea'),  -- Emma Ndirangu, +254722914298, KES 93,000
    ('325accd6-d844-4d20-b643-88b649fa2c86'),  -- Emma Ndirangu, +254722914298, KES 96,000
    ('5fcc2a1e-68e5-4ee4-92ce-3dc1678b8fd0'),  -- Emmily Kiptoo, +254721810850, KES 93,000
    ('0d2759f2-9651-4653-9a6c-268e84366001'),  -- Felix Lengewa, +254710399326, KES 93,000
    ('553dd8b4-f172-4324-a409-a10f7f3ad083'),  -- Francis Kyalo Muia, +254724054270, KES 76,200
    ('8cf6d5b3-7c14-4c60-ada6-856b64cb9607'),  -- Geoffery Mwachoki, +254711318287, KES 93,000
    ('f7af523b-c2d4-4a25-836f-67651be5b470'),  -- George Lipesa, +254721778233, KES 96,000
    ('a2dd95eb-afc8-4153-aa17-e360043a6bff'),  -- Grace Kiragu, +254718160805, KES 76,200
    ('6a3a12d5-b390-4405-b5c7-eec970c406d7'),  -- Grace Tarbei, +254722681351, KES 37,000
    ('292af1c2-8cb8-46be-9686-7f0a6175b046'),  -- Halima Abdisalam, +254727845831, KES 93,000
    ('3cc1733e-4af8-4a95-a685-2dde815e850a'),  -- Haron kahuthu weru, +254723849989, KES 79,200
    ('56123d46-cc51-4761-a092-069bd999d1fd'),  -- Haron Saitiemu Lolkireri, +254713102568, KES 93,000
    ('57bcad3a-8520-40d3-9afa-b96d32f89ecc'),  -- Hashim Abdullahi Mohamud, +254729069533, KES 93,000
    ('b4b27b78-ff0a-479e-ac51-3ca81780fb0f'),  -- Hellen Wanyaga, +254722779750, KES 65,000
    ('7586b1c5-7476-44f4-ab31-aedd047ea50a'),  -- Hellen Wanyaga, +254722779750, KES 96,000
    ('13b21ee7-4f58-4f21-a79d-474d02f88338'),  -- Henry Mwathi Gitonga, +254727397899, KES 96,000
    ('2f2035a6-4901-46cb-a7e8-64fbe7c1e2bd'),  -- Hillary Kosgey, +254720934494, KES 93,000
    ('d3704c09-7e45-428a-aef8-ea5dd46992a0'),  -- Hosea Saitoti Leaduma, +254721746809, KES 93,000
    ('df303003-a264-41f6-ab8a-a16f332b01bd'),  -- Jacinta Kasyoki, +254712195987, KES 93,000
    ('d10c630d-4eed-4090-a178-7becd8c664df'),  -- Jackline Cherotich, +254710470125, KES 93,000
    ('b178d4ff-4b0f-455d-b1b7-ee545b621811'),  -- Jacob Koiyiet, +254712728194, KES 93,000
    ('0bfeb9ad-49af-4902-a56b-77dd4dc02f49'),  -- James Ikuaa Ikonya, +254723718833, KES 93,000
    ('8e0b0723-4750-41ef-bb41-ad106a95318e'),  -- Jane Lydia Amoi, +254711753690, KES 96,000
    ('647fd867-0784-4a08-b66d-8c7a1f33685e'),  -- Jennifer Nduva, +254723445757, KES 79,200
    ('d27e79af-b652-4aec-878d-51525d5fd424'),  -- Jeremiah Mumo, +254710370820, KES 96,000
    ('4f8b1c13-1bb0-43f8-aabe-fe8b7add19c5'),  -- Jeremiah Mumo, +254710370820, KES 93,000
    ('8b25e664-4caf-4f53-a3c1-a3a40367e650'),  -- Jesse David, +254710400031, KES 96,000
    ('98e6b6bf-8934-417b-bfcb-32b5295fad83'),  -- Joan Wasike, +254724542269, KES 96,000
    ('442e3a6b-6b15-46db-9679-c6ef6b22d51b'),  -- John Nyambu, +254725341006, KES 93,000
    ('f21366ef-ae16-4edf-857d-63b7771ab16b'),  -- Johnson Muthami, +254724892375, KES 79,200
    ('588d40f7-5274-47d2-be8e-e31e55e1423a'),  -- Joshua Ohanga, +254712655711, KES 96,000
    ('b5ac7cb0-d415-46ec-9949-e4f06e10640e'),  -- Joyce Jelagat, +254720032960, KES 93,000
    ('689d71f8-4cc3-4512-9751-50855204ea0e'),  -- Julius Njuguna, +254718552405, KES 79,200
    ('9061fd6a-ad10-4529-a36a-3d6d91414af7'),  -- Kennedy K. Bomji, +254723904620, KES 79,200
    ('569241a5-9f84-4df0-ba92-3d41c5b06f3e'),  -- Kenneth Kimathi N, +254720660131, KES 79,200
    ('cff3de04-10e8-418e-89e1-3967bea20efa'),  -- Kenneth Micheni Duncan, +254727628270, KES 96,000
    ('42155232-8b70-403e-ad60-2a88f6719fa6'),  -- Leparmarai Silas, +254723385259, KES 93,000
    ('e819b885-82a5-436e-a9e8-efbd74e1cc0d'),  -- Lilyanne Chepkemboi, +254717586735, KES 93,000
    ('e96f2cdf-89c4-4eff-ab29-5a4cb217aadf'),  -- Luka Kiptarus, +254725793803, KES 93,000
    ('cf46151d-b506-42e1-b4b0-07ee3a19a7ab'),  -- Mary Ndorongo, +254720345866, KES 96,000
    ('719d572c-319a-4a8f-906e-4cc055bdecbe'),  -- Michael Ruto, +254724368494, KES 96,000
    ('189061a3-8d02-45a0-b3b8-6a27f5679d4a'),  -- Mohamed Ibrahim Hassan, +254717306641, KES 96,000
    ('b3731130-2b7e-4886-9af6-e8d763f74600'),  -- Molly Otieno, +254720676808, KES 96,000
    ('e5fa8743-9a6b-45bd-bbcf-46ff59fac709'),  -- Monica Wangui Mugo, +254720567025, KES 96,000
    ('d62d38c1-f0bc-43fe-8118-aeaa2e7ebdd4'),  -- Murithi John, +254722817007, KES 79,200
    ('8bc99c57-846c-4eee-8c11-55542049a73e'),  -- Naomi Kituku, +254725688782, KES 96,000
    ('10612425-e447-4bc1-9eaa-7785ec322930'),  -- Nelson Kivaya, +254722101310, KES 79,200
    ('d83f82e1-9106-4f40-9bcc-3a5784591162'),  -- Onesmus Mutie, +254723950489, KES 93,000
    ('c2058c84-5711-4330-856d-0adbcf5f30aa'),  -- Paul Malusi, +254721359910, KES 96,000
    ('4d8e96d7-c6fb-4391-9ffc-8a0a668b82d7'),  -- Peter Mogoi, +254720666733, KES 79,000
    ('b7db6b2f-cb9d-4602-95f4-0f899dcc040c'),  -- Pritt Okeyo, +254758736390, KES 79,200
    ('a0f21879-0e6e-4509-91cf-89da0a614e0f'),  -- Rael Khwaka Wanjala, +254758674729, KES 93,000
    ('c7173705-6f0c-46e8-8006-9e36ba026ec4'),  -- Raphael Kelvin Nyongesa, +254726420842, KES 79,200
    ('b4686ab4-fa1f-443e-b6f2-ebf027a04a8d'),  -- Richard Wanyonyi, +254722479053, KES 79,200
    ('825f5148-cc25-4b34-a7d8-9601dc38c034'),  -- Robert Kinoti, +254722472761, KES 96,000
    ('e3fbc1d2-55ee-40ac-9d4c-682484cfa18f'),  -- Ruth Wambui Kiyaiyu, +254724353192, KES 79,200
    ('84d47b43-5e86-41cf-af1e-88ef72106d99'),  -- Samuel Cheburet, +254721624338, KES 65,000
    ('842fca13-6570-47b4-ac0e-7856e2f07e8e'),  -- Samuel Kamau, +254703238466, KES 93,000
    ('c0b16586-474f-4067-9dc0-a68792a3aa97'),  -- Samuel Muigai Muiruri, +254719369607, KES 96,000
    ('0540aedc-5caa-4a86-8018-a6c7a128c6e5'),  -- Scolastica Wabwire, +254722409542, KES 93,000
    ('a81ed192-9a25-4d04-bbb5-479d0a5eb715'),  -- Sharon Chebii, +254718538330, KES 96,000
    ('74a1dd01-b13b-4e25-8bfc-777095fb53b8'),  -- Simon Kavisi, +254721469269, KES 93,000
    ('8ba37c81-a6a8-43d6-a3a9-bd75a0534a4f'),  -- Stanley Chirchir, +254724329639, KES 93,000
    ('755aeaf8-1737-46f7-aa48-5d03b0b69f5a'),  -- Sugow Mohamed, +254722967307, KES 96,000
    ('11f89894-9531-478d-ab01-57337cc97876'),  -- Taib Ali, +254719571170, KES 40,000
    ('55727f48-00a5-4854-a3d2-217b4a34f6c5'),  -- Tracy Njonjo, +254722719780, KES 93,000
    ('968c72bf-52c6-4a8f-9b1f-609f6a156814'),  -- Veronica Naliaka Wanyonyi, +254704817384, KES 96,000
    ('2a8bc148-c37f-4445-9187-18b727fdd6c8'),  -- Walter Andande, +254721677496, KES 79,200
    ('d720f4df-c4b7-4621-9bcb-07b427e7c91f'),  -- Wastara Ayub Misiani, +254725951924, KES 96,000
    ('6a9b8f35-8689-4285-8bbd-ce7da3c9e79f'),  -- Wesley Ooga, +254720903265, KES 93,000
    ('248c4ed7-d42e-49d5-8e70-b1199aa69c52'),  -- William Laltangwas, +254727571263, KES 93,000
    ('5286c1c9-b783-4725-a1bc-59803aacd8a3');  -- Williamson Mwanyika, +254725407501, KES 93,000

-- Step 1: Safety check - all 110 rows still on 2025-09-06 with the audited total.
do $$
declare n int; s double precision;
begin
  select count(*), coalesce(sum(p.total_perdiem), 0) into n, s
  from fix_ids f join perdiem_requests p on p.id = f.id
  where p.date = '2025-09-06' and p.event_id = '2041097d-0c80-439b-a3d9-8807cef3456a'
    and coalesce(p.recovered_amount, 0) = 0 and not coalesce(p.is_overpayment, false);
  if n <> 110 or s <> 9888800 then
    raise exception 'Safety check failed: % rows / KES % (expected 110 / 9888800)', n, s;
  end if;
end $$;

-- Step 2: Backup. Undo with:
--   update perdiem_requests p set date = b.old_date
--   from perdiem_requests_backup_2025_windsor_golf_9jul b where p.id = b.id;
create table perdiem_requests_backup_2025_windsor_golf_9jul as
  select id, '2025-09-06'::text as old_date, '2025-07-09'::text as new_date, now() as changed_at from fix_ids;

-- Step 3: Move the dates.
do $$
declare n int;
begin
  update perdiem_requests set date = '2025-07-09'
  where id in (select id from fix_ids) and date = '2025-09-06';
  get diagnostics n = row_count;
  if n <> 110 then raise exception 'Expected to update 110 rows, updated %', n; end if;
end $$;

-- Step 4: The event's date list - add 9 Jul, drop 6 Sep if nothing else uses it (May stays).
update events set event_dates = array_append(event_dates, '2025-07-09')
where id = '2041097d-0c80-439b-a3d9-8807cef3456a' and not ('2025-07-09' = any(event_dates));
update events set event_dates = array_remove(event_dates, '2025-09-06')
where id = '2041097d-0c80-439b-a3d9-8807cef3456a'
  and not exists (select 1 from perdiem_requests where event_id = '2041097d-0c80-439b-a3d9-8807cef3456a' and date = '2025-09-06');

commit;

-- Step 5: Verify - expect 2025-07 = 1278 / 35197900 and 2025-09 = 3378 / 5126300.
select substring(date, 1, 7) as month, count(*) as requests, sum(total_perdiem) as amount
from perdiem_requests where date between '2025-07-01' and '2025-09-30'
group by 1 order by 1;
