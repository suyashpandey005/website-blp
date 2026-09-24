# BLP COMMAND Security Audit

Audit date: 2026-09-19
Scope: React/Vite frontend, Supabase client, local PostgreSQL migrations, Edge Function, dependencies.

## Findings

### High: Admin authorization used a global profile role
The `/admin` route and `admin-create-user` Edge Function previously trusted `user_profiles.role` without checking the tenant membership role. A profile role is not company-scoped and could grant administration outside the user's company. Fixed in `src/App.tsx`, `supabase/functions/admin-create-user/index.ts`, and `supabase/migrations/003_security_hardening.sql` by using `company_members.role` and scoping invited users to the caller's company.

### High: Business form mutations were local-only
The current record modal prepended records into React state; it did not call repository insert methods. Deletes also only changed React state. This can show a false success and lose data on refresh. Fixed in the current project: create/delete handlers call company-scoped repository methods and reload data after success; delete errors are surfaced instead of being silently ignored.

### High: Live Supabase schema cannot be verified locally
The repository contains production verification SQL. Live Supabase policies and records still need to be checked in the Supabase SQL editor before release. Run `supabase/inspect-production-schema.sql` in the Supabase SQL editor before applying database migrations.

### Medium: User email list is intentionally unavailable from the browser
`adminService.listUsers()` returns `Protected by Supabase Auth` because Auth users cannot be enumerated with the anon key. A server-side admin Edge Function is required to list Auth users without exposing a service-role key.

### Medium: Audit logging is not yet wired to all business mutations
The append-only table and insert policy exist, but create/update/delete operations do not consistently call `writeAudit`. Add server-side or repository-level audit writes for financial and identity events.

### Medium: Financial records are mutable
RLS currently allows company members to update business records. Financial records should be restricted to owner/admin updates or moved to an append-only/voided model after the business workflow is confirmed.

### Low: Theme preference uses localStorage
Only the non-sensitive UI theme is stored. No passwords, tokens, business records, or authorization decisions are stored there.

### Info: XSS primitives were not found in source
No application use of `dangerouslySetInnerHTML`, `innerHTML`, `eval`, or `Function` was found. Matches in `dist`/dependencies are generated library code.

### Info: Dependency audit clean
`npm audit --audit-level=moderate` reported zero vulnerabilities.

## Verification limits

No live Supabase session, production database, browser Network panel, or remote RLS policy result was available in this workspace. Those require running the inspection and isolation tests against the real project.


### Current release hardening

- Business table deletes remain owner/admin-only through RLS.
- Company-scoped queries use the authenticated company membership.
- Admin role changes use the `set_company_user_role` security-definer function so `company_members.role` and `user_profiles.role` stay aligned.
- Password reset now has a dedicated `/change-password` recovery screen.
- Customer banking fields are covered by migration 005.
- Frontend logs no longer print login email or user IDs.
- Dashboard date, owner greeting, utilization, and chart values are derived from live data rather than hardcoded demo values.
