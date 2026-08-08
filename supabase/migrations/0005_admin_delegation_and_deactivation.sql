-- Extends Milestone 3: Client Admins can now invite/demote peer Client
-- Admins for their own client, and admins can deactivate participants
-- (blocks sign-in via an Auth ban, not just a cosmetic flag).

alter table public.participants add column if not exists disabled_at timestamptz;

-- Guard disabled_at the same way as access_tier/client_id: only the
-- deactivate API route (service_role) or set_access_tier() may change it,
-- so the auth-ban state and this column can never drift apart.
create or replace function public.guard_participant_privilege_columns()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'UPDATE' and (new.access_tier is distinct from old.access_tier
                            or new.client_id is distinct from old.client_id
                            or new.disabled_at is distinct from old.disabled_at) then
    if coalesce(current_setting('app.bypass_tier_guard', true), '') <> 'on'
       and auth.role() <> 'service_role' then
      raise exception 'access_tier/client_id/disabled_at can only change via public.set_access_tier() or the admin API';
    end if;
  elsif TG_OP = 'INSERT' and new.access_tier <> 'client_user' then
    if auth.role() <> 'service_role' then
      raise exception 'Self-registration must be access_tier = client_user';
    end if;
  end if;
  return new;
end;
$$;

-- set_access_tier(): adds a fourth caller branch. Client Admins may demote
-- (only) another Client Admin (only) at their own client (only) down to
-- Client User - never touch master_admin/super_admin, never another client,
-- and (per the existing top-of-function check) never themselves.
create or replace function public.set_access_tier(
  target_participant uuid,
  new_tier public.access_tier,
  new_client_id uuid default null
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  caller_tier public.access_tier := public.current_tier();
  caller_client uuid := public.current_client_id();
  target_current public.access_tier;
  target_client uuid;
begin
  if target_participant = auth.uid() then
    raise exception 'Cannot change your own access tier';
  end if;

  select access_tier, client_id into target_current, target_client
    from public.participants where id = target_participant;
  if target_current is null then
    raise exception 'Participant not found';
  end if;

  if caller_tier = 'master_admin' then
    null;
  elsif caller_tier = 'super_admin' then
    if new_tier not in ('client_admin', 'client_user') then
      raise exception 'Super Admins may only assign Client Admin or Client User';
    end if;
    if target_current in ('master_admin', 'super_admin') then
      raise exception 'Super Admins cannot modify Master/Super Admin accounts';
    end if;
  elsif caller_tier = 'client_admin' then
    if new_tier <> 'client_user' then
      raise exception 'Client Admins may only demote a peer to Client User';
    end if;
    if target_current <> 'client_admin' then
      raise exception 'Client Admins may only demote another Client Admin';
    end if;
    if target_client is distinct from caller_client then
      raise exception 'Client Admins may only manage their own client';
    end if;
  else
    raise exception 'Insufficient privileges';
  end if;

  perform set_config('app.bypass_tier_guard', 'on', true);
  update public.participants
    set access_tier = new_tier,
        client_id = case when new_tier in ('master_admin', 'super_admin') then null else coalesce(new_client_id, client_id) end
    where id = target_participant;
end;
$$;
