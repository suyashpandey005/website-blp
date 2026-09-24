-- Run this in Supabase SQL Editor and paste the complete result back.
-- Read-only inspection: it does not change data or schema.

-- 1. Public tables and views
select table_schema, table_name, table_type
from information_schema.tables
where table_schema in ('public', 'storage')
order by table_schema, table_name;

-- 2. Public columns and defaults
select table_name, ordinal_position, column_name, data_type, udt_name,
       is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
order by table_name, ordinal_position;

-- 3. Primary keys, foreign keys, and delete actions
select tc.table_schema, tc.table_name, tc.constraint_name,
       tc.constraint_type, kcu.column_name,
       ccu.table_schema as referenced_schema,
       ccu.table_name as referenced_table,
       ccu.column_name as referenced_column,
       rc.delete_rule, rc.update_rule
from information_schema.table_constraints tc
left join information_schema.key_column_usage kcu
  on kcu.constraint_name = tc.constraint_name
 and kcu.table_schema = tc.table_schema
left join information_schema.constraint_column_usage ccu
  on ccu.constraint_name = tc.constraint_name
 and ccu.table_schema = tc.table_schema
left join information_schema.referential_constraints rc
  on rc.constraint_name = tc.constraint_name
 and rc.constraint_schema = tc.table_schema
where tc.table_schema = 'public'
  and tc.constraint_type in ('PRIMARY KEY', 'FOREIGN KEY', 'UNIQUE')
order by tc.table_name, tc.constraint_type, tc.constraint_name;

-- 4. RLS state and policies
select n.nspname as schema_name, c.relname as table_name,
       c.relrowsecurity as rls_enabled,
       c.relforcerowsecurity as rls_forced,
      p.policyname, p.permissive, p.roles,
       p.cmd, p.qual, p.with_check
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_policies p
  on p.schemaname = n.nspname and p.tablename = c.relname
where n.nspname in ('public', 'storage')
  and c.relkind in ('r', 'p')
order by n.nspname, c.relname, p.policyname;

-- 5. Functions used by RLS and application authorization
select n.nspname as schema_name,
       p.proname as function_name,
       pg_get_function_identity_arguments(p.oid) as arguments,
       pg_get_function_result(p.oid) as return_type,
       p.prosecdef as security_definer,
       pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public', 'auth')
order by n.nspname, p.proname;

-- 6. Triggers
select event_object_schema as schema_name,
       event_object_table as table_name,
       trigger_name, event_manipulation,
       action_timing, action_statement
from information_schema.triggers
where event_object_schema in ('public', 'auth')
order by event_object_table, trigger_name;

-- 7. Existing business counts (only tables that exist)
select table_name, rows_estimate
from (
  select c.relname as table_name, c.reltuples::bigint as rows_estimate
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p')
) counts
where table_name in (
  'companies', 'company_members', 'user_profiles', 'customers', 'vehicles',
  'drivers', 'trips', 'routes', 'invoices', 'invoice_items', 'payments',
  'expenses', 'fuel_records', 'maintenance', 'gst_records',
  'daily_register', 'notifications', 'audit_log'
)
order by table_name;

-- 8. Storage buckets (names only)
select id, name, public, created_at, updated_at
from storage.buckets
order by name;
