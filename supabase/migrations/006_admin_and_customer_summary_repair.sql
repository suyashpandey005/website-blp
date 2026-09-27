-- ============================================================
-- BLP CONSTRUCTION
-- Admin panel + customer_summary schema repair
-- Migration: 006_admin_and_customer_summary_repair.sql
--
-- Fixes three gaps found while testing against the live database
-- (the app code already assumes all three exist):
--
-- 1. company_members has no timestamp column, so the admin Users
--    list (which orders by "created_at") fails outright.
-- 2. customer_summary was created before customer_date/gstin/bank_*
--    columns were added to customers, so it never returned them —
--    those fields silently render blank everywhere in the app even
--    though the real data exists in the customers table.
-- 3. audit_log does not exist, so the admin Activity Log fails
--    outright.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. COMPANY_MEMBERS TIMESTAMP
-- ============================================================

ALTER TABLE public.company_members
    ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- ============================================================
-- 2. RECREATE customer_summary WITH ALL CURRENT CUSTOMER COLUMNS
-- ============================================================
-- CREATE OR REPLACE VIEW requires the existing output columns to
-- stay in the same order; selecting customers.* again just adds the
-- columns added since this view was first created (customer_date,
-- gstin, bank_name, bank_account_holder, bank_account_number,
-- bank_ifsc, bank_upi_id) to the end of the list.

CREATE OR REPLACE VIEW public.customer_summary
WITH (security_invoker = true) AS
SELECT
    c.*,
    coalesce(sum(i.grand_total), 0) AS billing,
    coalesce(sum(i.amount_paid), 0) AS paid
FROM public.customers c
LEFT JOIN public.invoices i ON i.customer_id = c.id
GROUP BY c.id;

-- ============================================================
-- 3. AUDIT LOG TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.audit_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    action text NOT NULL,
    entity_type text,
    entity_id text,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_log_company_created_idx
    ON public.audit_log(company_id, created_at DESC);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_log_select ON public.audit_log;
CREATE POLICY audit_log_select
ON public.audit_log
FOR SELECT
TO authenticated
USING (public.is_company_member(company_id));

DROP POLICY IF EXISTS audit_log_insert ON public.audit_log;
CREATE POLICY audit_log_insert
ON public.audit_log
FOR INSERT
TO authenticated
WITH CHECK (public.is_company_member(company_id));

COMMIT;
