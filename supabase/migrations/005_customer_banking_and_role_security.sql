-- BLP COMMAND: customer banking + secure role management
-- Safe to run after 003_security_hardening.sql.
BEGIN;

ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS bank_name text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS bank_account_holder text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS bank_account_number text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS bank_ifsc text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS bank_upi_id text;

CREATE OR REPLACE FUNCTION public.set_company_user_role(
  target_user uuid,
  target_role text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  caller_company uuid;
  target_company uuid;
BEGIN
  IF target_role NOT IN ('admin', 'staff') THEN
    RAISE EXCEPTION 'invalid role';
  END IF;

  SELECT company_id
  INTO caller_company
  FROM public.company_members
  WHERE user_id = auth.uid()
    AND role IN ('owner', 'admin')
  ORDER BY CASE WHEN role = 'owner' THEN 0 ELSE 1 END
  LIMIT 1;

  IF caller_company IS NULL THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT company_id
  INTO target_company
  FROM public.company_members
  WHERE user_id = target_user
    AND company_id = caller_company
  LIMIT 1;

  IF target_company IS NULL THEN
    RAISE EXCEPTION 'user is not a member of your company';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.company_members
    WHERE company_id = caller_company
      AND user_id = target_user
      AND role = 'owner'
  ) THEN
    RAISE EXCEPTION 'the company owner role cannot be changed here';
  END IF;

  UPDATE public.company_members
  SET role = CASE WHEN target_role = 'admin' THEN 'admin' ELSE 'member' END
  WHERE company_id = caller_company
    AND user_id = target_user;

  UPDATE public.user_profiles
  SET role = target_role,
      updated_at = now()
  WHERE user_id = target_user;
END;
$$;

REVOKE ALL ON FUNCTION public.set_company_user_role(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_company_user_role(uuid, text) TO authenticated;

COMMIT;
