-- BLP COMMAND owner setup
-- 1) Create the owner user in Supabase Dashboard -> Authentication -> Users.
-- 2) Set the owner's email and password there.
-- 3) Replace ONLY OWNER_EMAIL below and run this script in Supabase SQL Editor.
-- The password is never stored in this SQL file or the React application.

BEGIN;

DO $$
DECLARE
  owner_email text := 'OWNER_EMAIL_HERE';
  owner_user uuid;
  owner_company uuid;
BEGIN
  SELECT id INTO owner_user
  FROM auth.users
  WHERE lower(email) = lower(owner_email)
  LIMIT 1;

  IF owner_user IS NULL THEN
    RAISE EXCEPTION 'Owner user not found. Create the user in Supabase Authentication first.';
  END IF;

  SELECT id INTO owner_company
  FROM public.companies
  WHERE name = 'BLP Construction'
  ORDER BY created_at ASC
  LIMIT 1;

  IF owner_company IS NULL THEN
    INSERT INTO public.companies (name, address)
    VALUES ('BLP Construction', 'Belsari, Takhatpur, Bilaspur, Chhattisgarh - 495330')
    RETURNING id INTO owner_company;
  END IF;

  INSERT INTO public.company_members (company_id, user_id, role)
  VALUES (owner_company, owner_user, 'owner')
  ON CONFLICT (company_id, user_id)
  DO UPDATE SET role = 'owner';

  INSERT INTO public.user_profiles (user_id, display_name, role)
  VALUES (owner_user, 'Swapnil Pandey', 'admin')
  ON CONFLICT (user_id)
  DO UPDATE SET display_name = 'Swapnil Pandey', role = 'admin', updated_at = now();
END $$;

COMMIT;

SELECT
  u.id AS user_id,
  u.email,
  c.id AS company_id,
  c.name AS company_name,
  cm.role AS company_role,
  up.display_name,
  up.role AS profile_role
FROM auth.users u
JOIN public.company_members cm ON cm.user_id = u.id
JOIN public.companies c ON c.id = cm.company_id
LEFT JOIN public.user_profiles up ON up.user_id = u.id
WHERE lower(u.email) = lower('OWNER_EMAIL_HERE');
