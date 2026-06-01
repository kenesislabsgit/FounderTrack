-- Fix RLS policies to allow new user registration

-- 1. Drop old restrictive policies on settings table
DROP POLICY IF EXISTS "Allow read access to settings for authenticated" ON public.settings;
DROP POLICY IF EXISTS "Allow insert of admin sentinel or admin write access" ON public.settings;
DROP POLICY IF EXISTS "Allow update of settings for admins only" ON public.settings;

-- 2. Allow any authenticated user to read settings
CREATE POLICY "Allow read settings" ON public.settings
  FOR SELECT USING (auth.role() = 'authenticated');

-- 3. Allow any authenticated user to INSERT admin-assigned (needed for first user flow)
CREATE POLICY "Allow insert settings" ON public.settings
  FOR INSERT WITH CHECK (
    id = 'admin-assigned' OR
    EXISTS (SELECT 1 FROM public.users WHERE uid = auth.uid() AND role IN ('admin', 'founder'))
  );

-- 4. Only admins can update settings
CREATE POLICY "Allow update settings" ON public.settings
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users WHERE uid = auth.uid() AND role IN ('admin', 'founder'))
  );

-- Done! Now test by logging in with a brand new Google account
