-- PREPARED ONLY. Do not execute against Supabase before separate approval.
-- Metadata only: no auth users, tokens, backups or application data are selected.
begin read only;
select current_database(), current_user, session_user, version();
select rolname, rolsuper, rolbypassrls, rolcanlogin, rolinherit
from pg_roles where rolname in ('postgres','anon','authenticated','authenticator','service_role',current_user);
select parent.rolname as granted_role, member.rolname as member_role
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
rollback;
