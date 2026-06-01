-- Fix RLS policies to allow new users to complete registration
-- Run this in the Supabase SQL Editor

-- 1. Drop the old settings policies that require checking is_admin before user exists
DROP POLICY IF EXISTS "Allow read access to settings for authenticated" ON public.settings;
DROP POLICY IF EXISTS "Allow insert of admin sentinel or admin write access" ON public.settings;
DROP POLICY IF EXISTS "Allow update of settings for admins only" ON public.settings;

-- 2. Create new permissive policies for settings table
-- Allow all authenticated users to read settings (needed to check admin-assigned sentinel)
CREATE POLICY "Allow read access to settings for all authenticated users"
  ON public.settings
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Allow any authenticated user to INSERT the admin-assigned sentinel (first-user flow)
-- Also allow existing admins to insert other settings
CREATE POLICY "Allow insert admin sentinel for authenticated"
  ON public.settings
  FOR INSERT
  WITH CHECK (
    -- Anyone can insert admin-assigned (needed for first-user flow)
    id = 'admin-assigned'
    OR
    -- Existing admins can insert anything
    EXISTS (
      SELECT 1 FROM public.users
      WHERE uid = auth.uid()
      AND (role = 'admin' OR role = 'founder')
    )
  );

-- Allow admins to update settings
CREATE POLICY "Allow update of settings for admins"
  ON public.settings
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE uid = auth.uid()
      AND (role = 'admin' OR role = 'founder')
    )
  );

-- Allow admins to delete settings
CREATE POLICY "Allow delete of settings for admins"
  ON public.settings
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE uid = auth.uid()
      AND (role = 'admin' OR role = 'founder')
    )
  );

-- 3. Also add a policy to allow users to delete their own stale profiles
-- This is needed for the cleanup logic in useAuth.ts
DROP POLICY IF EXISTS "Allow delete access to users for admins only" ON public.users;

CREATE POLICY "Allow delete of users for admins or self-cleanup"
  ON public.users
  FOR DELETE
  USING (
    -- Admins can delete anyone
    EXISTS (
      SELECT 1 FROM public.users
      WHERE uid = auth.uid()
      AND (role = 'admin' OR role = 'founder')
    )
    OR
    -- Users can delete records with their own email (for UID migration)
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Commit the changes
COMMIT;

-- Verification queries (run these to check):
-- SELECT * FROM pg_policies WHERE tablename = 'settings';
-- SELECT * FROM pg_policies WHERE tablename = 'users' AND policyname LIKE '%delete%';
