-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║   Migration 008 — Organization integrity (Phase 3, item 9)        ║
-- ║   Invite codes, normalised-name dedupe, domain match               ║
-- ╚═══════════════════════════════════════════════════════════════════╝
-- Idempotent. Safe to re-run.

-- Six-char human-friendly invite code per org. Auto-generated on insert.
alter table organizations add column if not exists invite_code text;
alter table organizations add column if not exists email_domain text;
alter table organizations add column if not exists name_normalised text;

create unique index if not exists organizations_invite_code_idx on organizations(invite_code) where invite_code is not null;
create        index if not exists organizations_email_domain_idx on organizations(email_domain);
create        index if not exists organizations_name_normalised_idx on organizations(name_normalised);

-- Normalise: lowercase, strip non-alphanumeric, collapse whitespace
create or replace function public.normalise_org_name(name text) returns text
language sql immutable as $$
  select lower(regexp_replace(coalesce(name,''), '[^a-zA-Z0-9]+', '', 'g'));
$$;

-- Generate a 6-char A-Z 2-9 invite code, retrying on collision
create or replace function public.generate_org_invite_code() returns text
language plpgsql as $$
declare
  v_code text;
  v_attempts int := 0;
begin
  loop
    v_code := upper(substr(translate(encode(gen_random_bytes(8), 'base64'), '+/=01OIli', ''), 1, 6));
    exit when not exists (select 1 from organizations where invite_code = v_code);
    v_attempts := v_attempts + 1;
    if v_attempts > 5 then v_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6)); end if;
    if v_attempts > 10 then raise exception 'could not generate invite code'; end if;
  end loop;
  return v_code;
end;
$$;

-- Backfill existing rows
update organizations set
  invite_code     = coalesce(invite_code, public.generate_org_invite_code()),
  name_normalised = coalesce(name_normalised, public.normalise_org_name(name));

-- Trigger: fill on insert
create or replace function public.set_org_defaults() returns trigger
language plpgsql as $$
begin
  if new.invite_code is null then
    new.invite_code := public.generate_org_invite_code();
  end if;
  new.name_normalised := public.normalise_org_name(new.name);
  return new;
end;
$$;

drop trigger if exists organizations_set_defaults on organizations;
create trigger organizations_set_defaults
  before insert or update of name on organizations
  for each row execute function public.set_org_defaults();

-- Lookup helper: find candidate orgs to join given email and a search string
create or replace function public.suggest_orgs_for(p_email text, p_query text default '')
returns table (id uuid, name text, invite_code text, email_domain text, match_reason text)
language sql
security definer
set search_path = public as $$
  with email_domain as (
    select split_part(p_email, '@', 2) as d
  )
  select o.id, o.name, o.invite_code, o.email_domain,
         case when o.email_domain is not null and o.email_domain = (select d from email_domain) then 'domain'
              when o.name_normalised like public.normalise_org_name(p_query) || '%' then 'name'
              else 'fuzzy' end as match_reason
    from organizations o
   where (o.email_domain is not null and o.email_domain = (select d from email_domain))
      or (length(coalesce(p_query,'')) >= 2 and o.name_normalised like public.normalise_org_name(p_query) || '%')
   order by match_reason desc, o.created_at
   limit 20;
$$;

grant execute on function public.suggest_orgs_for(text, text) to anon, authenticated;
