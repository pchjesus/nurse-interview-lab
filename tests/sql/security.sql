\set ON_ERROR_STOP on
-- ONLY run in a new disposable local PostgreSQL database. Never use a Supabase project.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
-- Reproduce broad project defaults, including PostgreSQL 17+ MAINTAIN.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to service_role;
create schema auth;
create table auth.users (id uuid primary key);
-- Mock the integrated JWT setting consumed by the real auth.jwt() helper.
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim', true), ''), nullif(current_setting('request.jwt.claims', true), ''))::jsonb $$;
create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;
create function auth.role() returns text language sql stable as $$ select auth.jwt()->>'role' $$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid(), auth.role(), auth.jwt() to anon, authenticated;
insert into auth.users values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
\ir ../../db/review/001_nurse_backup.sql
create function public.test_assert(ok boolean, msg text) returns void language plpgsql as $$ begin if ok is distinct from true then raise exception 'test failure: %', msg; end if; end $$;
create function public.test_denied(query text) returns void language plpgsql as $$ begin begin execute query; exception when insufficient_privilege then return; end; raise exception 'expected insufficient_privilege for %', query; end $$;
create function public.test_conflict(query text) returns void language plpgsql as $$ begin begin execute query; exception when sqlstate 'P0001' then if sqlerrm = 'revision_conflict' then return; else raise; end if; end; raise exception 'expected revision_conflict for %', query; end $$;
create function public.test_invalid(query text) returns void language plpgsql as $$ begin begin execute query; exception when invalid_parameter_value then return; end; raise exception 'expected invalid_parameter_value for %', query; end $$;
create function public.test_claim(key text, value text) returns text language sql as $$ select set_config('request.jwt.claims', (coalesce(auth.jwt(), '{}'::jsonb) || jsonb_build_object(key, case when value in ('true','false') then value::jsonb when value='' then 'null'::jsonb else to_jsonb(value) end))::text, false) $$;
set role anon;
select public.test_denied('select * from public.nurse_backups');
select public.test_denied($q$select public.save_nurse_backup('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',null,'1.0','{}'::jsonb)$q$);
reset role;
set role authenticated;
select public.test_claim('role','authenticated');
select public.test_claim('is_anonymous','false');
select public.test_claim('sub','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
select public.test_assert((public.save_nurse_backup('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',null,'1.0','{"kind":"nurse-interview-lab-backup","schemaVersion":"1.0","people":[],"reports":[]}'::jsonb)).revision = 1, 'create revision 1');
select public.test_conflict($q$select public.save_nurse_backup('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',null,'1.0','{"kind":"nurse-interview-lab-backup","schemaVersion":"1.0","people":[],"reports":[]}'::jsonb)$q$);
select public.test_assert((public.save_nurse_backup('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',1,'1.0','{"kind":"nurse-interview-lab-backup","schemaVersion":"1.0","people":[],"reports":[]}'::jsonb)).revision = 2, 'update revision 2');
select public.test_conflict($q$select public.save_nurse_backup('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',1,'1.0','{"kind":"nurse-interview-lab-backup","schemaVersion":"1.0","people":[],"reports":[]}'::jsonb)$q$);
select public.test_invalid($q$select public.save_nurse_backup('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',2,'1.1','{}'::jsonb)$q$);
select public.test_invalid($q$select public.save_nurse_backup('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',0,'1.0','{}'::jsonb)$q$);
select public.test_invalid($q$select public.save_nurse_backup('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',9007199254740991,'1.0','{}'::jsonb)$q$);
select public.test_denied($q$update public.nurse_backups set revision=999$q$);
select public.test_denied($q$delete from public.nurse_backups$q$);
select public.test_denied($q$insert into public.nurse_backups(owner_id,format_version,revision,backup) values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','1.0',1,'{}')$q$);
select public.test_claim('sub','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
select public.test_assert((select count(*) from public.nurse_backups) = 0, 'B cannot read A');
select public.test_denied($q$select public.save_nurse_backup('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',2,'1.0','{"kind":"nurse-interview-lab-backup","schemaVersion":"1.0","people":[],"reports":[]}'::jsonb)$q$);
select public.test_assert((public.save_nurse_backup('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',null,'1.0','{"kind":"nurse-interview-lab-backup","schemaVersion":"1.0","people":[],"reports":[]}'::jsonb)).owner_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, 'B can only create own');
select public.test_assert((select count(*) from public.nurse_backups) = 1, 'B sees only own');
select public.test_claim('is_anonymous','true');
select public.test_assert((select count(*) from public.nurse_backups) = 0, 'anonymous authenticated cannot read');
select public.test_denied($q$select public.save_nurse_backup('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',null,'1.0','{}'::jsonb)$q$);
select public.test_claim('is_anonymous','');
select public.test_assert((select count(*) from public.nurse_backups) = 0, 'missing anonymous claim cannot read');
select public.test_denied($q$select public.save_nurse_backup('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',null,'1.0','{}'::jsonb)$q$);
select public.test_claim('is_anonymous','invalid');
select public.test_assert((select count(*) from public.nurse_backups) = 0, 'invalid anonymous claim cannot read');
select public.test_denied($q$select public.save_nurse_backup('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',null,'1.0','{}'::jsonb)$q$);
select public.test_claim('is_anonymous','false');
select public.test_claim('role','anon');
select public.test_denied($q$select public.save_nurse_backup('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',1,'1.0','{}'::jsonb)$q$);
select public.test_claim('role','authenticated');
select public.test_claim('sub','');
select public.test_denied($q$select public.save_nurse_backup('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',null,'1.0','{"kind":"nurse-interview-lab-backup","schemaVersion":"1.0","people":[],"reports":[]}'::jsonb)$q$);
reset role;
-- SECURITY DEFINER metadata and independent EXECUTE privilege checks.
select public.test_assert((select prosecdef and proowner = (select relowner from pg_class where oid = 'public.nurse_backups'::regclass) and proconfig @> array['search_path=""'] from pg_proc where oid = 'public.save_nurse_backup(uuid,bigint,text,jsonb)'::regprocedure), 'trusted shared owner and fixed search_path');
select public.test_assert(not has_function_privilege('anon', 'public.save_nurse_backup(uuid,bigint,text,jsonb)', 'EXECUTE'), 'anon cannot execute RPC');
select public.test_assert(has_function_privilege('authenticated', 'public.save_nurse_backup(uuid,bigint,text,jsonb)', 'EXECUTE'), 'authenticated can execute RPC');
select public.test_assert(not exists (select 1 from pg_proc p, lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a where p.oid='public.save_nurse_backup(uuid,bigint,text,jsonb)'::regprocedure and a.grantee=0 and a.privilege_type='EXECUTE'), 'PUBLIC cannot execute RPC');

-- Effective privileges: RLS does not protect TRUNCATE, REFERENCES or TRIGGER.
select public.test_assert(not exists (select 1 from (values ('anon'),('authenticated'),('service_role')) roles(name), (values ('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')) perms(name) where has_table_privilege(roles.name, 'public.nurse_backups', perms.name)), 'no direct write or administrative privileges for API roles');
select public.test_assert(not has_table_privilege('anon','public.nurse_backups','SELECT') and not has_table_privilege('service_role','public.nurse_backups','SELECT') and has_table_privilege('authenticated','public.nurse_backups','SELECT'), 'only authenticated has SELECT');
-- MAINTAIN was introduced in PostgreSQL 17. Check it where supported.
do $$ begin if current_setting('server_version_num')::int >= 170000 then perform public.test_assert(not exists (select 1 from (values ('anon'),('authenticated'),('service_role')) roles(name) where has_table_privilege(roles.name, 'public.nurse_backups', 'MAINTAIN')), 'no MAINTAIN privilege'); end if; end $$;
select public.test_assert(not has_function_privilege('service_role','public.save_nurse_backup(uuid,bigint,text,jsonb)','EXECUTE'), 'service_role has no RPC execute');
set role service_role;
select public.test_denied('select * from public.nurse_backups');
select public.test_denied('truncate public.nurse_backups');
reset role;
-- Explicit whole-claims input; no individual request.jwt.claim.* settings.
set role authenticated;
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated","is_anonymous":false}',false);
select public.test_assert(auth.uid()='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid and auth.jwt()->'is_anonymous'='false'::jsonb, 'integrated claims preserve UUID and boolean type');
select public.test_assert((select count(*) from public.nurse_backups)=1, 'integrated A sees only A');
select set_config('request.jwt.claims','{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated","is_anonymous":"false"}',false);
select public.test_assert((select count(*) from public.nurse_backups)=0, 'string false fails closed');
select public.test_denied($q$select public.save_nurse_backup('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',1,'1.0','{}'::jsonb)$q$);
reset role;
