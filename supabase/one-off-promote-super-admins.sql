-- Promotes 4 already-existing Supabase Auth users (created directly in
-- Supabase, not through the app's own invite flow) to Super Admin.
-- Safe to re-run: uses ON CONFLICT to update rather than duplicate if a
-- participants row already exists for any of them.
--
-- Why a participants row is needed at all: the app's access control reads
-- public.participants.access_tier, not anything in Supabase Auth itself -
-- an auth user with no matching participants row has no access tier and
-- can sign in but won't be recognized as an admin anywhere in the app.

-- Step 1: Diagnostic - confirm all three auth users actually exist, and
-- see whether a participants row already exists for any of them.
select
  au.email,
  au.id as auth_user_id,
  p.id as existing_participant_id,
  p.access_tier as existing_access_tier
from auth.users au
left join public.participants p on p.id = au.id
where au.email in (
  'kamathilimukii@iacentre.co.ke',
  'jkimathi@iacentre.co.ke',
  'mfiona@consulttuque.com',
  'admin@iacentre.co.ke'
);

-- Step 2: Insert as Super Admin (or update to Super Admin if a row already
-- exists for them). name is a placeholder derived from the email address,
-- since none was given - each person can update their own name from their
-- Profile page after signing in.
insert into public.participants (id, name, email, designation, access_tier, client_id, avatar_url)
select
  au.id,
  initcap(replace(split_part(au.email, '@', 1), '.', ' ')),
  au.email,
  'Super Admin',
  'super_admin',
  null,
  'https://picsum.photos/seed/' || au.id || '/100/100'
from auth.users au
where au.email in (
  'kamathilimukii@iacentre.co.ke',
  'jkimathi@iacentre.co.ke',
  'mfiona@consulttuque.com',
  'admin@iacentre.co.ke'
)
on conflict (id) do update set
  access_tier = 'super_admin',
  client_id = null,
  designation = 'Super Admin';

-- Step 3: Confirm - expect exactly 4 rows, all access_tier = 'super_admin'.
-- Fewer than 4 means one of the emails above doesn't exist in auth.users
-- yet (check Step 1's output to see which).
select id, name, email, access_tier, client_id from public.participants
where email in (
  'kamathilimukii@iacentre.co.ke',
  'jkimathi@iacentre.co.ke',
  'mfiona@consulttuque.com',
  'admin@iacentre.co.ke'
);
