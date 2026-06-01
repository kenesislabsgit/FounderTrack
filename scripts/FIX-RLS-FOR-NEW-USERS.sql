-- Fix RLS to allow new user registration

-- 1. Allow any authenticated user to try claiming admin
DROP POLICY IF EXISTS "Allow insert of admin sentinel or admin write access" ON public.settings;
CREATE POLICY "Allow insert settings" ON public.settings
  FOR INSERT WITH CHECK (
    id = 'admin-assigned'
  );

-- 2. Allow new users to insert themselves
DROP POLICY IF EXISTS "Allow insert access to users for own profile or admins" ON public.users;
CREATE POLICY "Allow insert users" ON public.users
  FOR INSERT WITH CHECK (
    auth.uid()::text = uid::text
  );
