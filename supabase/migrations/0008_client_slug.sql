-- Adds a URL-safe slug per client, used for the new tier-specific admin
-- portals (Client Admins sign in at /<slug>-admin instead of a shared
-- /admin login). "super" and "master" are reserved so a client's slug can
-- never collide with the separately-routed /super-admin or /master-admin
-- portals.

alter table public.clients add column if not exists slug text;

create or replace function public.slugify(input text)
returns text
language sql immutable as $$
  select trim(both '-' from regexp_replace(lower(coalesce(input, '')), '[^a-z0-9]+', '-', 'g'));
$$;

create or replace function public.clients_generate_slug()
returns trigger
language plpgsql as $$
declare
  base_slug text;
  candidate text;
  suffix int := 1;
begin
  if new.slug is not null then
    return new;
  end if;

  base_slug := public.slugify(new.name);
  if base_slug = '' then
    base_slug := 'client';
  end if;

  candidate := base_slug;
  while candidate in ('super', 'master')
     or exists (select 1 from public.clients where slug = candidate and id is distinct from new.id)
  loop
    suffix := suffix + 1;
    candidate := base_slug || '-' || suffix;
  end loop;

  new.slug := candidate;
  return new;
end;
$$;

drop trigger if exists clients_generate_slug on public.clients;
create trigger clients_generate_slug
  before insert or update on public.clients
  for each row execute function public.clients_generate_slug();

-- Backfill existing rows (trigger only fires on writes going forward).
update public.clients set slug = null where slug is null;
update public.clients set name = name where slug is null;

alter table public.clients alter column slug set not null;
alter table public.clients add constraint clients_slug_unique unique (slug);

-- Public/pre-auth lookup by slug, mirroring get_public_client_name(uuid).
-- Used by the client-admin portal's login page (to resolve the slug and
-- display the client's name) and, post-auth, to confirm a signed-in Client
-- Admin's client_id matches the portal they signed in at.
create or replace function public.get_client_by_slug(target_slug text)
returns table (id uuid, name text)
language sql stable security definer set search_path = public as $$
  select id, name from public.clients where slug = target_slug and archived_at is null;
$$;
revoke all on function public.get_client_by_slug(text) from public;
grant execute on function public.get_client_by_slug(text) to anon, authenticated;
