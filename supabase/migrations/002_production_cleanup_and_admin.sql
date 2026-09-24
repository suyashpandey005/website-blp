

BEGIN;



DELETE FROM public.payments;

DELETE FROM public.invoices;

DELETE FROM public.trips;

DELETE FROM public.expenses;

DELETE FROM public.vehicles;

DELETE FROM public.drivers;

DELETE FROM public.customers;




CREATE TABLE IF NOT EXISTS public.user_profiles (
    user_id UUID PRIMARY KEY
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    display_name TEXT NOT NULL DEFAULT '',

    role TEXT NOT NULL DEFAULT 'staff'
        CHECK (role IN ('admin', 'staff')),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);



CREATE TABLE IF NOT EXISTS public.audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    company_id UUID,

    actor_user_id UUID
        REFERENCES auth.users(id)
        ON DELETE SET NULL,

    action TEXT NOT NULL,

    entity_type TEXT,

    entity_id TEXT,

    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 4. INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS user_profiles_role_idx
ON public.user_profiles(role);

CREATE INDEX IF NOT EXISTS audit_log_actor_idx
ON public.audit_log(actor_user_id);

CREATE INDEX IF NOT EXISTS audit_log_created_idx
ON public.audit_log(created_at DESC);

CREATE INDEX IF NOT EXISTS audit_log_company_created_idx
ON public.audit_log(company_id, created_at DESC);


-- ============================================================
-- 5. ENABLE ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.user_profiles
ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.audit_log
ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- 6. ADMIN CHECK FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_profiles
        WHERE user_id = auth.uid()
          AND role = 'admin'
    );
$$;


-- ============================================================
-- 7. REMOVE OLD POLICIES
-- ============================================================

DROP POLICY IF EXISTS user_profiles_self_select
ON public.user_profiles;

DROP POLICY IF EXISTS user_profiles_admin_select
ON public.user_profiles;

DROP POLICY IF EXISTS user_profiles_admin_update
ON public.user_profiles;

DROP POLICY IF EXISTS user_profiles_admin_insert
ON public.user_profiles;

DROP POLICY IF EXISTS audit_log_admin_select
ON public.audit_log;

DROP POLICY IF EXISTS audit_log_authenticated_insert
ON public.audit_log;


-- ============================================================
-- 8. USER PROFILE POLICIES
-- ============================================================

-- Users can view their own profile.

CREATE POLICY user_profiles_self_select
ON public.user_profiles
FOR SELECT
TO authenticated
USING (
    user_id = auth.uid()
);


-- Admins can view all profiles.

CREATE POLICY user_profiles_admin_select
ON public.user_profiles
FOR SELECT
TO authenticated
USING (
    public.is_admin_user()
);


-- Admins can update profiles.

CREATE POLICY user_profiles_admin_update
ON public.user_profiles
FOR UPDATE
TO authenticated
USING (
    public.is_admin_user()
)
WITH CHECK (
    role IN ('admin', 'staff')
);


-- Admins can create profiles.

CREATE POLICY user_profiles_admin_insert
ON public.user_profiles
FOR INSERT
TO authenticated
WITH CHECK (
    public.is_admin_user()
);


-- ============================================================
-- 9. AUDIT LOG POLICIES
-- ============================================================

-- Only administrators can view audit logs.

CREATE POLICY audit_log_admin_select
ON public.audit_log
FOR SELECT
TO authenticated
USING (
    public.is_admin_user()
);


-- Authenticated users can create an audit record
-- only for themselves.

CREATE POLICY audit_log_authenticated_insert
ON public.audit_log
FOR INSERT
TO authenticated
WITH CHECK (
    actor_user_id = auth.uid()
);


-- ============================================================
-- 10. GRANT REQUIRED PERMISSIONS
-- ============================================================

GRANT USAGE ON SCHEMA public
TO authenticated;

GRANT SELECT, INSERT, UPDATE
ON public.user_profiles
TO authenticated;

GRANT SELECT, INSERT
ON public.audit_log
TO authenticated;


-- ============================================================
-- 11. COMMIT
-- ============================================================

COMMIT;