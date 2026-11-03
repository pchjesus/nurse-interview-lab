-- PREPARED ONLY. Do not execute against Supabase before separate approval.
-- Metadata only: no auth users, tokens, backups or application data are selected.
begin read only;
select current_database(), current_user, session_user, version();
select rolname, rolsuper, rolbypassrls, rolcanlogin, rolinherit
from pg_roles where rolname in ('postgres','anon','authenticated','authenticator','service_role',current_user);
select parent.rolname as granted_role, member.rolname as member_role, m.admin_option, m.inherit_option, m.set_option
from pg_auth_members m join pg_roles parent on parent.oid=m.roleid
join pg_roles member on member.oid=m.member;
select nspname, pg_get_userbyid(nspowner) as owner, nspacl
from pg_namespace where nspname in ('public','auth');
select n.nspname, c.relname, c.relkind, pg_get_userbyid(c.relowner) as owner,
       c.relrowsecurity, c.relforcerowsecurity, c.relacl
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where (n.nspname='public' and c.relname='nurse_backups') or (n.nspname='auth' and c.relname='users');
-- All overloads count as a collision, not just the intended signature.
select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as signature,
       pg_get_userbyid(p.proowner) as owner, p.prosecdef, p.proconfig, p.proacl,
       pg_get_functiondef(p.oid) as definition
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where (n.nspname='public' and p.proname='save_nurse_backup') or
      (n.nspname='auth' and p.proname in ('uid','jwt','role'));
select * from pg_policies where schemaname='public' and tablename='nurse_backups';
select pg_get_userbyid(defaclrole) as owner, defaclnamespace::regnamespace, defaclobjtype, defaclacl
from pg_default_acl;
select evtname, evtevent, evtenabled from pg_event_trigger;
-- Effective schema privileges and role escalation reachability (PG 16+).
select r.rolname, n.nspname,
       has_schema_privilege(r.oid,n.oid,'USAGE') as can_use,
       has_schema_privilege(r.oid,n.oid,'CREATE') as can_create
from pg_roles r cross join pg_namespace n
where r.rolname in ('anon','authenticated','service_role',current_user)
  and n.nspname in ('public','auth');
select client.rolname as client, target.rolname as target,
       pg_has_role(client.oid,target.oid,'MEMBER') as member,
       pg_has_role(client.oid,target.oid,'USAGE') as inherited,
       pg_has_role(client.oid,target.oid,'SET') as can_set_role
from pg_roles client cross join pg_roles target
where client.rolname in ('anon','authenticated','service_role')
  and (target.rolsuper or target.rolbypassrls or target.rolname=current_user);
select a.attname, format_type(a.atttypid,a.atttypmod) as column_type, a.attnotnull,
       a.atttypid='uuid'::regtype as is_uuid
from pg_attribute a where a.attrelid=to_regclass('auth.users') and a.attname='id' and not a.attisdropped;
select conname, contype, pg_get_constraintdef(oid) as definition
from pg_constraint where conrelid=to_regclass('auth.users') and contype in ('p','u');
select pg_get_userbyid(d.defaclrole) as owner, d.defaclnamespace::regnamespace as schema,
       d.defaclobjtype, case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end as grantee,
       a.privilege_type, a.is_grantable
from pg_default_acl d cross join lateral aclexplode(d.defaclacl) a;
rollback;
