-- Run after applying the production cleanup migration.
-- Read-only verification queries.

select 'customers' as table_name, count(*)::bigint as row_count from public.customers
union all select 'vehicles', count(*) from public.vehicles
union all select 'drivers', count(*) from public.drivers
union all select 'trips', count(*) from public.trips
union all select 'invoices', count(*) from public.invoices
union all select 'payments', count(*) from public.payments
union all select 'expenses', count(*) from public.expenses
order by table_name;

select table_name, rowsecurity as rls_enabled, forcerowsecurity as rls_forced
from pg_tables
where schemaname = 'public'
  and table_name in ('user_profiles', 'audit_log', 'customers', 'vehicles', 'drivers', 'trips', 'invoices', 'payments', 'expenses')
order by table_name;

select schemaname, tablename, policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('user_profiles', 'audit_log')
order by tablename, policyname;

select p.user_id, p.display_name, p.role, u.email, p.created_at
from public.user_profiles p
join auth.users u on u.id = p.user_id
order by p.created_at;

select id, company_id, actor_user_id, action, entity_type, entity_id, created_at
from public.audit_log
order by created_at desc
limit 20;
