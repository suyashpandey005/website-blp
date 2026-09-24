create extension if not exists pgcrypto;

create type public.vehicle_status as enum ('Active', 'Idle', 'Maintenance', 'Inactive');
create type public.trip_status as enum ('In transit', 'Completed', 'Scheduled');
create type public.invoice_status as enum ('Paid', 'Pending', 'Overdue', 'Partially Paid');
create type public.customer_status as enum ('Active', 'On hold');

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  gstin text,
  pan text,
  phone text,
  email text,
  logo_path text,
  created_at timestamptz not null default now()
);
create table public.company_members (
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  primary key (company_id, user_id)
);
create table public.drivers (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  name text not null, phone text, license_number text, license_expiry date, status text not null default 'Active', created_at timestamptz not null default now()
);
create table public.vehicles (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  registration_number text not null, vehicle_type text not null, status public.vehicle_status not null default 'Idle', registration_date date, created_at timestamptz not null default now(), unique(company_id, registration_number)
);
create table public.customers (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  company_name text not null, phone text, gstin text, address text, status public.customer_status not null default 'Active', created_at timestamptz not null default now()
);
create table public.trips (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  trip_date date not null default current_date, vehicle_id uuid not null references public.vehicles(id) on delete restrict, driver_id uuid references public.drivers(id) on delete set null, customer_id uuid not null references public.customers(id) on delete restrict,
  route text not null, goods_type text, trip_count numeric(12,2) not null check (trip_count > 0), rate_per_trip numeric(12,2) not null check (rate_per_trip >= 0), diesel_consumed numeric(12,2) not null default 0 check (diesel_consumed >= 0), diesel_rate numeric(12,2) not null default 0 check (diesel_rate >= 0), other_expenses numeric(12,2) not null default 0 check (other_expenses >= 0), status public.trip_status not null default 'Scheduled', notes text, created_at timestamptz not null default now()
);
create table public.invoices (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  invoice_number text not null, invoice_date date not null default current_date, due_date date, customer_id uuid not null references public.customers(id) on delete restrict, taxable_amount numeric(12,2) not null check (taxable_amount >= 0), gst_rate numeric(5,2) not null default 0 check (gst_rate between 0 and 100), cgst numeric(12,2) not null default 0, sgst numeric(12,2) not null default 0, igst numeric(12,2) not null default 0, grand_total numeric(12,2) not null check (grand_total >= 0), amount_paid numeric(12,2) not null default 0 check (amount_paid >= 0), status public.invoice_status not null default 'Pending', unique(company_id, invoice_number)
);
create table public.payments (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  payment_date date not null default current_date, customer_id uuid not null references public.customers(id) on delete restrict, invoice_id uuid references public.invoices(id) on delete set null, amount numeric(12,2) not null check (amount > 0), payment_method text not null, reference_number text, notes text
);
create table public.expenses (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  expense_date date not null default current_date, category text not null, vehicle_id uuid references public.vehicles(id) on delete set null, amount numeric(12,2) not null check (amount >= 0), payment_method text, description text
);
create index trips_company_date_idx on public.trips(company_id, trip_date desc);
create index invoices_company_date_idx on public.invoices(company_id, invoice_date desc);
create index payments_company_date_idx on public.payments(company_id, payment_date desc);

create or replace function public.is_company_member(target_company uuid) returns boolean language sql security definer set search_path = public stable as $$ select exists (select 1 from public.company_members where company_id = target_company and user_id = auth.uid()); $$;
create or replace function public.is_company_admin(target_company uuid) returns boolean language sql security definer set search_path = public stable as $$ select exists (select 1 from public.company_members where company_id = target_company and user_id = auth.uid() and role in ('owner', 'admin')); $$;

create view public.vehicle_summary with (security_invoker = true) as select v.*, coalesce(d.name, 'Unassigned') as driver_name, count(t.id)::int as trip_count, coalesce(sum(t.trip_count * t.rate_per_trip), 0) as revenue, coalesce(sum(t.diesel_consumed), 0) as diesel_used from public.vehicles v left join public.drivers d on d.id = (select t2.driver_id from public.trips t2 where t2.vehicle_id = v.id order by t2.trip_date desc limit 1) left join public.trips t on t.vehicle_id = v.id group by v.id, d.name;
create view public.customer_summary with (security_invoker = true) as select c.*, coalesce(sum(i.grand_total), 0) as billing, coalesce(sum(i.amount_paid), 0) as paid from public.customers c left join public.invoices i on i.customer_id = c.id group by c.id;
create view public.invoice_summary with (security_invoker = true) as select i.*, c.company_name as customer_name from public.invoices i join public.customers c on c.id = i.customer_id;

alter table public.companies enable row level security;
alter table public.company_members enable row level security;
alter table public.drivers enable row level security;
alter table public.vehicles enable row level security;
alter table public.customers enable row level security;
alter table public.trips enable row level security;
alter table public.invoices enable row level security;
alter table public.payments enable row level security;
alter table public.expenses enable row level security;

do $$ declare table_name text; begin for table_name in select unnest(array['drivers','vehicles','customers','trips','invoices','payments','expenses']) loop execute format('create policy %I_select on public.%I for select using (public.is_company_member(company_id))', table_name, table_name, table_name); execute format('create policy %I_insert on public.%I for insert with check (public.is_company_member(company_id))', table_name, table_name, table_name); execute format('create policy %I_update on public.%I for update using (public.is_company_member(company_id)) with check (public.is_company_member(company_id))', table_name, table_name, table_name); execute format('create policy %I_delete on public.%I for delete using (public.is_company_admin(company_id))', table_name, table_name, table_name); end loop; end $$;
create policy companies_select on public.companies for select using (public.is_company_member(id));
create policy companies_update on public.companies for update using (public.is_company_admin(id)) with check (public.is_company_admin(id));
create policy members_select on public.company_members for select using (user_id = auth.uid() or public.is_company_admin(company_id));

insert into storage.buckets (id, name, public) values ('company-documents', 'company-documents', false) on conflict (id) do nothing;
create policy company_documents_select on storage.objects for select using (bucket_id = 'company-documents' and public.is_company_member((storage.foldername(name))[1]::uuid));
create policy company_documents_insert on storage.objects for insert with check (bucket_id = 'company-documents' and public.is_company_member((storage.foldername(name))[1]::uuid));
create policy company_documents_update on storage.objects for update using (bucket_id = 'company-documents' and public.is_company_admin((storage.foldername(name))[1]::uuid));
create policy company_documents_delete on storage.objects for delete using (bucket_id = 'company-documents' and public.is_company_admin((storage.foldername(name))[1]::uuid));
