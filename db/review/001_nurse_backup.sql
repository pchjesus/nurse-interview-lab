-- REVIEW DRAFT ONLY. Do not run against any Supabase project without separate approval.
-- Expected platform prerequisites: auth.users, auth.uid(), auth.jwt(), anon and authenticated roles.
begin;

create table public.nurse_backups (
  owner_id uuid primary key references auth.users(id) on delete restrict,
  format_version text not null check (format_version = '1.0'),
  revision bigint not null check (revision between 1 and 9007199254740991),
  backup jsonb not null,
  updated_at timestamptz not null default pg_catalog.clock_timestamp(),
  constraint nurse_backup_envelope check (coalesce(
    pg_catalog.jsonb_typeof(backup) = 'object'
    and backup->>'kind' = 'nurse-interview-lab-backup'
    and backup->>'schemaVersion' = '1.0'
    and pg_catalog.jsonb_typeof(backup->'people') = 'array'
    and pg_catalog.jsonb_typeof(backup->'reports') = 'array'
  , false))
);
alter table public.nurse_backups enable row level security;
revoke all on table public.nurse_backups from public, anon, authenticated;
grant select on table public.nurse_backups to authenticated;
create policy nurse_backups_read_own on public.nurse_backups
  for select to authenticated using ((select auth.uid()) = owner_id and (select auth.jwt())->'is_anonymous' = 'false'::jsonb);

-- SECURITY DEFINER is required here because the authenticated role has no write privileges.
-- The owner of this function must be a trusted migration role; review ownership before applying.
create function public.save_nurse_backup(p_expected_owner_id uuid, p_expected_revision bigint, p_format_version text, p_backup jsonb)
returns public.nurse_backups
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_saved public.nurse_backups;
begin
  if v_owner is null or auth.jwt()->>'role' is distinct from 'authenticated'
    or auth.jwt()->'is_anonymous' is distinct from 'false'::jsonb then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;
  if p_expected_owner_id is distinct from v_owner then
    raise exception using errcode = '42501', message = 'owner_mismatch';
  end if;
  if p_format_version is distinct from '1.0'
    or pg_catalog.jsonb_typeof(p_backup) is distinct from 'object'
    or p_backup->>'kind' is distinct from 'nurse-interview-lab-backup'
    or p_backup->>'schemaVersion' is distinct from '1.0'
    or pg_catalog.jsonb_typeof(p_backup->'people') is distinct from 'array'
    or pg_catalog.jsonb_typeof(p_backup->'reports') is distinct from 'array'
    or (p_expected_revision is not null and (p_expected_revision < 1 or p_expected_revision >= 9007199254740991)) then
    raise exception using errcode = '22023', message = 'invalid_backup_or_revision';
  end if;
  if p_expected_revision is null then
    insert into public.nurse_backups (owner_id, format_version, revision, backup, updated_at)
    values (v_owner, p_format_version, 1, p_backup, pg_catalog.clock_timestamp())
    on conflict (owner_id) do nothing
    returning * into v_saved;
  else
    update public.nurse_backups
    set format_version = p_format_version, backup = p_backup,
        revision = revision + 1, updated_at = pg_catalog.clock_timestamp()
    where owner_id = v_owner and revision = p_expected_revision
    returning * into v_saved;
  end if;
  if not found then
    raise exception using errcode = 'P0001', message = 'revision_conflict';
  end if;
  return v_saved;
end;
$$;
revoke all on function public.save_nurse_backup(uuid, bigint, text, jsonb) from public, anon, authenticated;
grant execute on function public.save_nurse_backup(uuid, bigint, text, jsonb) to authenticated;
commit;
