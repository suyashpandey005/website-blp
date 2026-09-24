-- Run in Supabase SQL Editor after creating the user in Authentication.
-- Replace only YOUR_EMAIL_HERE. Do not put a password in this script.

begin;

with selected_company as (
  select id
  from public.companies c
  where c.name = 'BLP Construction'
  order by (
    select count(*)
    from public.company_members cm
    where cm.company_id = c.id
  ) desc, c.created_at asc
  limit 1
), created_company as (
  insert into public.companies (name, address)
  select 'BLP Construction', 'Belsari, Takhatpur, Bilaspur, Chhattisgarh - 495330'
  where not exists (select 1 from selected_company)
  returning id
), target_company as (
  select id from selected_company
  union all
  select id from created_company
  limit 1
), selected_user as (
  select id as user_id
  from auth.users
  where lower(email) = lower('YOUR_EMAIL_HERE')
)
insert into public.company_members (company_id, user_id, role)
select target_company.id, selected_user.user_id, 'owner'
from target_company cross join selected_user
on conflict (company_id, user_id)
do update set role = 'owner';

insert into public.user_profiles (user_id, display_name, role)
select id, 'Swapnil Pandey', 'admin'
from auth.users
where lower(email) = lower('YOUR_EMAIL_HERE')
on conflict (user_id)
do update set display_name = 'Swapnil Pandey', role = 'admin', updated_at = now();

commit;

select u.id as user_id, u.email, c.id as company_id, c.name as company_name,
       cm.role as company_role, up.display_name, up.role as profile_role
from auth.users u
join public.company_members cm on cm.user_id = u.id
join public.companies c on c.id = cm.company_id
left join public.user_profiles up on up.user_id = u.id
where lower(u.email) = lower('YOUR_EMAIL_HERE');
