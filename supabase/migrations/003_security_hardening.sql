-- BLP COMMAND security hardening for the existing company_members architecture.
-- Does not delete business data or change the existing company model.
begin;

create or replace function public.is_company_owner(target_company uuid)
returns boolean
language sql
security definer
stable
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.company_members
    where company_id = target_company
      and user_id = auth.uid()
      and role = 'owner'
  );
$$;

create or replace function public.is_company_admin(target_company uuid)
returns boolean
language sql
security definer
stable
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.company_members
    where company_id = target_company
      and user_id = auth.uid()
      and role in ('owner', 'admin')
  );
$$;

create or replace function public.is_company_member(target_company uuid)
returns boolean
language sql
security definer
stable
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.company_members
    where company_id = target_company
      and user_id = auth.uid()
      and role in ('owner', 'admin', 'member')
  );
$$;

create or replace function public.is_admin_user()
returns boolean
language sql
security definer
stable
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.company_members
    where user_id = auth.uid()
      and role in ('owner', 'admin')
  );
$$;

revoke all on function public.is_company_owner(uuid) from public;
revoke all on function public.is_company_admin(uuid) from public;
revoke all on function public.is_company_member(uuid) from public;
revoke all on function public.is_admin_user() from public;
grant execute on function public.is_company_owner(uuid) to authenticated;
grant execute on function public.is_company_admin(uuid) to authenticated;
grant execute on function public.is_company_member(uuid) to authenticated;
grant execute on function public.is_admin_user() to authenticated;

-- Membership is readable only by the member or an authorized administrator in the same company.
drop policy if exists members_select on public.company_members;
drop policy if exists members_insert on public.company_members;
drop policy if exists members_update on public.company_members;
drop policy if exists members_delete on public.company_members;
create policy members_select on public.company_members
for select to authenticated
using (user_id = auth.uid() or public.is_company_admin(company_id));
create policy members_insert on public.company_members
for insert to authenticated
with check (public.is_company_admin(company_id) and role in ('admin', 'member'));
create policy members_update on public.company_members
for update to authenticated
using (public.is_company_admin(company_id) and (role <> 'owner' or public.is_company_owner(company_id)))
with check (role in ('admin', 'member') or public.is_company_owner(company_id));
create policy members_delete on public.company_members
for delete to authenticated
using (public.is_company_admin(company_id) and role <> 'owner' and user_id <> auth.uid());

-- Members may work with records in their company, but only admins/owners may delete.
do $$
declare table_name text;
begin
  foreach table_name in array array['drivers','vehicles','customers','trips','invoices','payments','expenses'] loop
    execute format('drop policy if exists %I_delete on public.%I', table_name, table_name);
    execute format('create policy %I_delete on public.%I for delete to authenticated using (public.is_company_admin(company_id))', table_name, table_name);
  end loop;
end $$;

-- Profile administration is scoped to users sharing a company with the current admin.
drop policy if exists user_profiles_admin_select on public.user_profiles;
drop policy if exists user_profiles_admin_update on public.user_profiles;
drop policy if exists user_profiles_admin_insert on public.user_profiles;
create policy user_profiles_admin_select on public.user_profiles
for select to authenticated
using (
  public.is_admin_user()
  and exists (
    select 1
    from public.company_members viewer
    join public.company_members target on target.company_id = viewer.company_id
    where viewer.user_id = auth.uid()
      and viewer.role in ('owner', 'admin')
      and target.user_id = user_profiles.user_id
  )
);
create policy user_profiles_admin_update on public.user_profiles
for update to authenticated
using (
  public.is_admin_user()
  and exists (
    select 1
    from public.company_members viewer
    join public.company_members target on target.company_id = viewer.company_id
    where viewer.user_id = auth.uid()
      and viewer.role in ('owner', 'admin')
      and target.user_id = user_profiles.user_id
  )
)
with check (role in ('admin', 'staff'));
create policy user_profiles_admin_insert on public.user_profiles
for insert to authenticated
with check (public.is_admin_user());

-- Audit history is append-only from the client: no update/delete policies are granted.
drop policy if exists audit_log_admin_select on public.audit_log;
drop policy if exists audit_log_authenticated_insert on public.audit_log;
create policy audit_log_admin_select on public.audit_log
for select to authenticated
using (public.is_company_admin(company_id));
create policy audit_log_authenticated_insert on public.audit_log
for insert to authenticated
with check (
  actor_user_id = auth.uid()
  and public.is_company_member(company_id)
);

create index if not exists company_members_user_company_idx on public.company_members(user_id, company_id);
create index if not exists vehicles_company_idx on public.vehicles(company_id);
create index if not exists drivers_company_idx on public.drivers(company_id);
create index if not exists customers_company_idx on public.customers(company_id);
create index if not exists trips_vehicle_idx on public.trips(vehicle_id);
create index if not exists trips_driver_idx on public.trips(driver_id);
create index if not exists trips_customer_idx on public.trips(customer_id);
create index if not exists invoices_customer_idx on public.invoices(customer_id);
create index if not exists payments_customer_idx on public.payments(customer_id);
create index if not exists expenses_vehicle_idx on public.expenses(vehicle_id);

commit;
