# BLP COMMAND Supabase setup

## 1. Create the project

Create a Supabase project and copy its Project URL and anon public key into `.env.local`:

```bash
cp .env.example .env.local
```

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Never put a `service_role` key in the browser app.

## 2. Apply the database migration

In the Supabase SQL Editor, run:

```text
supabase/migrations/001_initial_schema.sql
```

This creates the relational schema, foreign keys, summary views, company membership helpers, RLS policies, and the private `company-documents` Storage bucket.

## 3. Create the first user and company

Create a user in Supabase Auth. Then run this once with that user's Auth UUID:

```sql
insert into public.companies (name, address)
values ('BLP Construction', 'Bilaspur, Chhattisgarh');

insert into public.company_members (company_id, user_id, role)
select id, 'AUTH_USER_UUID_HERE'::uuid, 'owner'
from public.companies
where name = 'BLP Construction';
```

## 4. Security model

- Every business table has a `company_id` foreign key.
- RLS requires membership in the referenced company.
- Inserts and updates require company membership.
- Deletes and company settings require admin or owner membership.
- Storage paths must begin with the company UUID, for example `company-uuid/logo.png`.
- The frontend only uses the anon key; Supabase Auth and RLS enforce access.

## 5. Application architecture

- `src/lib/supabase.ts`: one configured Supabase client.
- `src/services/authService.ts`: Auth session and sign-in boundary.
- `src/services/repository.ts`: company-scoped repository queries and Storage upload helper.
- `supabase/migrations/001_initial_schema.sql`: PostgreSQL schema, views, foreign keys, and RLS.

Business data is not stored in localStorage. Only the visual theme preference remains local to the browser.
