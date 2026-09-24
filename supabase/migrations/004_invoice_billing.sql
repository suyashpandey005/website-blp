-- ============================================================
-- BLP CONSTRUCTION
-- Invoice & Billing Production Migration
-- Migration: 004_invoice_billing.sql
-- ============================================================

BEGIN;

-- ============================================================
-- 1. COMPANY / INVOICE SETTINGS
-- ============================================================

ALTER TABLE public.companies
    ADD COLUMN IF NOT EXISTS website text;

ALTER TABLE public.companies
    ADD COLUMN IF NOT EXISTS owner_name text;

ALTER TABLE public.companies
    ADD COLUMN IF NOT EXISTS stamp_path text;

ALTER TABLE public.companies
    ADD COLUMN IF NOT EXISTS signature_path text;

ALTER TABLE public.companies
    ADD COLUMN IF NOT EXISTS invoice_prefix text NOT NULL DEFAULT 'BLP';

ALTER TABLE public.companies
    ADD COLUMN IF NOT EXISTS payment_terms text NOT NULL DEFAULT 'Due on receipt';

ALTER TABLE public.companies
    ADD COLUMN IF NOT EXISTS bank_name text;

ALTER TABLE public.companies
    ADD COLUMN IF NOT EXISTS bank_account_number text;

ALTER TABLE public.companies
    ADD COLUMN IF NOT EXISTS bank_ifsc text;

ALTER TABLE public.companies
    ADD COLUMN IF NOT EXISTS bank_account_holder text;

ALTER TABLE public.companies
    ADD COLUMN IF NOT EXISTS upi_id text;

ALTER TABLE public.companies
    ADD COLUMN IF NOT EXISTS invoice_terms text;


-- ============================================================
-- 2. TRIP BILLING EXTENSIONS
-- ============================================================

ALTER TABLE public.trips
    ADD COLUMN IF NOT EXISTS loading_point text;

ALTER TABLE public.trips
    ADD COLUMN IF NOT EXISTS unloading_point text;

ALTER TABLE public.trips
    ADD COLUMN IF NOT EXISTS billing_mode text
    NOT NULL DEFAULT 'Per Trip';

-- Add validation for billing modes.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'trips_billing_mode_check'
    ) THEN
        ALTER TABLE public.trips
        ADD CONSTRAINT trips_billing_mode_check
        CHECK (
            billing_mode IN (
                'Per Trip',
                'Per Hour',
                'Per Minute',
                'Fixed Amount'
            )
        );
    END IF;
END $$;


-- ============================================================
-- 3. INVOICE ITEMS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.invoice_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    company_id uuid NOT NULL
        REFERENCES public.companies(id)
        ON DELETE CASCADE,

    invoice_id uuid NOT NULL
        REFERENCES public.invoices(id)
        ON DELETE CASCADE,

    description text NOT NULL,

    sac_code text,

    vehicle_equipment text,

    route_site text,

    quantity numeric(12,2) NOT NULL
        CHECK (quantity > 0),

    unit text NOT NULL DEFAULT 'Trips',

    rate numeric(12,2) NOT NULL
        CHECK (rate >= 0),

    taxable_amount numeric(12,2) NOT NULL
        CHECK (taxable_amount >= 0),

    tax_mode text NOT NULL DEFAULT 'GST'
        CHECK (tax_mode IN ('GST', 'NON-GST')),

    gst_rate numeric(5,2) NOT NULL DEFAULT 0
        CHECK (gst_rate BETWEEN 0 AND 100),

    created_at timestamptz NOT NULL DEFAULT now()
);


-- ============================================================
-- 4. INVOICE ITEM INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS invoice_items_company_idx
    ON public.invoice_items(company_id);

CREATE INDEX IF NOT EXISTS invoice_items_invoice_idx
    ON public.invoice_items(invoice_id);


-- ============================================================
-- 5. ENABLE RLS
-- ============================================================

ALTER TABLE public.invoice_items
    ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- 6. REMOVE OLD POLICIES
-- ============================================================

DROP POLICY IF EXISTS invoice_items_select
    ON public.invoice_items;

DROP POLICY IF EXISTS invoice_items_insert
    ON public.invoice_items;

DROP POLICY IF EXISTS invoice_items_update
    ON public.invoice_items;

DROP POLICY IF EXISTS invoice_items_delete
    ON public.invoice_items;


-- ============================================================
-- 7. SELECT POLICY
-- ============================================================

CREATE POLICY invoice_items_select
ON public.invoice_items
FOR SELECT
TO authenticated
USING (
    public.is_company_member(company_id)
);


-- ============================================================
-- 8. INSERT POLICY
-- ============================================================
-- Important:
-- The invoice item company must match the invoice company.

CREATE POLICY invoice_items_insert
ON public.invoice_items
FOR INSERT
TO authenticated
WITH CHECK (
    public.is_company_member(company_id)
    AND EXISTS (
        SELECT 1
        FROM public.invoices i
        WHERE i.id = invoice_id
          AND i.company_id = invoice_items.company_id
    )
);


-- ============================================================
-- 9. UPDATE POLICY
-- ============================================================

CREATE POLICY invoice_items_update
ON public.invoice_items
FOR UPDATE
TO authenticated
USING (
    public.is_company_admin(company_id)
)
WITH CHECK (
    public.is_company_admin(company_id)
);


-- ============================================================
-- 10. DELETE POLICY
-- ============================================================

CREATE POLICY invoice_items_delete
ON public.invoice_items
FOR DELETE
TO authenticated
USING (
    public.is_company_admin(company_id)
);


-- ============================================================
-- 11. PROFESSIONAL INVOICE NUMBER GENERATOR
-- ============================================================
--
-- Format:
--
-- BLP/2026-27/0001
-- BLP/2026-27/0002
-- BLP/2026-27/0003
--
-- Financial year starts in April.
--
-- IMPORTANT:
-- Extract only the final 4-digit sequence.
-- Do NOT extract every number from the invoice number.
--

CREATE OR REPLACE FUNCTION public.next_invoice_number(
    target_company uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$

DECLARE
    prefix text;
    financial_year text;
    sequence_number integer;

BEGIN

    -- --------------------------------------------------------
    -- Security check
    -- --------------------------------------------------------

    IF NOT public.is_company_admin(target_company) THEN
        RAISE EXCEPTION 'not authorized';
    END IF;


    -- --------------------------------------------------------
    -- Get company invoice prefix
    -- --------------------------------------------------------

    SELECT COALESCE(invoice_prefix, 'BLP')
    INTO prefix
    FROM public.companies
    WHERE id = target_company;


    -- --------------------------------------------------------
    -- Calculate Indian financial year
    -- April → March
    -- --------------------------------------------------------

    financial_year :=
        CASE
            WHEN EXTRACT(MONTH FROM CURRENT_DATE) >= 4
            THEN
                TO_CHAR(CURRENT_DATE, 'YYYY')
                || '-'
                || TO_CHAR(
                    CURRENT_DATE + INTERVAL '1 year',
                    'YY'
                )

            ELSE
                TO_CHAR(
                    CURRENT_DATE - INTERVAL '1 year',
                    'YYYY'
                )
                || '-'
                || TO_CHAR(CURRENT_DATE, 'YY')
        END;


    -- --------------------------------------------------------
    -- Find the latest 4-digit invoice sequence
    -- --------------------------------------------------------

    SELECT
        COALESCE(
            MAX(
                (
                    SUBSTRING(
                        invoice_number
                        FROM '/([0-9]{4})$'
                    )
                )::integer
            ),
            0
        ) + 1

    INTO sequence_number

    FROM public.invoices

    WHERE company_id = target_company

      AND invoice_number LIKE
          prefix || '/' || financial_year || '/%';


    -- --------------------------------------------------------
    -- Return invoice number
    -- --------------------------------------------------------

    RETURN
        prefix
        || '/'
        || financial_year
        || '/'
        || LPAD(
            sequence_number::text,
            4,
            '0'
        );

END;

$$;


-- ============================================================
-- 12. FUNCTION SECURITY
-- ============================================================

REVOKE ALL
ON FUNCTION public.next_invoice_number(uuid)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.next_invoice_number(uuid)
TO authenticated;


-- ============================================================
-- 13. COMMIT
-- ============================================================

COMMIT;
