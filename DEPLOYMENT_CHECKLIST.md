# BLP COMMAND production checklist

## Before GitHub

- Do not commit `.env.local`.
- The browser may use only the Supabase publishable key.
- Never put `SUPABASE_SERVICE_ROLE_KEY` in `VITE_*` variables.
- Keep `node_modules` and `dist` out of Git.
- Apply all migrations in order, including `005_customer_banking_and_role_security.sql`.
- Verify RLS with `supabase/inspect-production-schema.sql`.
- Verify the active owner/company membership with `supabase/verify-production.sql`.

## Owner account

Create the owner user in Supabase Authentication. Set the password there, not in the React source.

Then replace `OWNER_EMAIL_HERE` in `supabase/setup-owner.sql` and run it in the Supabase SQL Editor.

The application authorizes the owner from `company_members.role = 'owner'`.

## Forgot password

Supabase Dashboard -> Authentication -> URL Configuration:

Add these redirect URLs:

- Local: `http://localhost:5173/change-password`
- Production: `https://YOUR-VERCEL-DOMAIN/change-password`

The login screen sends the recovery email through Supabase Auth. The `/change-password` page accepts the recovery session and lets the user set a new password.

## Vercel

Set these Environment Variables:

`VITE_SUPABASE_URL`
`VITE_SUPABASE_ANON_KEY`

Use the publishable key only.

After changing environment variables, redeploy.

## Functional smoke test

Test with real records:

1. Login
2. Forgot password
3. Customer create/delete
4. Vehicle create/delete
5. Driver create/delete
6. Trip create/delete
7. Daily Register display/delete
8. Routes display/delete
9. Invoice create/delete
10. Payment create/delete and invoice balance
11. Expense create/delete
12. Fuel create/delete
13. Maintenance create/delete
14. Settings save
15. Admin role change
16. Sign out
17. Login again
18. Verify another company cannot read this company's records

If a record has dependent foreign-key data, PostgreSQL may correctly refuse a hard delete. The UI now shows the database error instead of pretending the delete succeeded.
