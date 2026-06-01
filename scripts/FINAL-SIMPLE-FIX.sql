-- ============================================================
-- FINAL SIMPLE FIX - Handles EVERYTHING
-- ============================================================
-- Run this ONCE and all problems are solved:
-- 1. Allows new users to register
-- 2. Migrates old Firebase users automatically
-- 3. Fixes RLS policies
-- ============================================================

-- STEP 1: Fix RLS policies for settings table
DROP POLICY IF EXISTS "Allow read access to settings for authenticated" ON public.settings;
DROP POLICY IF EXISTS "Allow insert of admin sentinel or admin write access" ON public.settings;
DROP POLICY IF EXISTS "Allow update of settings for admins only" ON public.settings;

CREATE POLICY "Allow read settings" ON public.settings
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow insert settings" ON public.settings
  FOR INSERT WITH CHECK (
    id = 'admin-assigned' OR
    EXISTS (SELECT 1 FROM public.users WHERE uid::text = auth.uid()::text AND role IN ('admin', 'founder'))
  );

CREATE POLICY "Allow update settings" ON public.settings
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users WHERE uid::text = auth.uid()::text AND role IN ('admin', 'founder'))
  );

-- STEP 2: Temporarily drop email unique constraint
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_email_key;

-- STEP 3: For logged-in users, migrate from Firebase UID to Supabase UID
DO $$
DECLARE
  auth_rec RECORD;
  old_rec RECORD;
  rec_count INT;
BEGIN
  RAISE NOTICE 'Starting migration...';

  FOR auth_rec IN SELECT id::text as id, email FROM auth.users LOOP
    -- Find old Firebase profile with same email
    SELECT * INTO old_rec FROM public.users
    WHERE email = auth_rec.email AND uid != auth_rec.id;

    IF FOUND THEN
      RAISE NOTICE 'Migrating: % (% → %)', auth_rec.email, old_rec.uid, auth_rec.id;

      -- Check if new UID profile already exists
      SELECT COUNT(*) INTO rec_count FROM public.users WHERE uid = auth_rec.id;

      IF rec_count = 0 THEN
        -- Create new profile with Supabase UID
        INSERT INTO public.users (uid, name, email, role, photo_url, preferences)
        VALUES (auth_rec.id, old_rec.name, old_rec.email, old_rec.role, old_rec.photo_url, old_rec.preferences);
      END IF;

      -- Migrate all data
      UPDATE public.attendance SET uid = auth_rec.id WHERE uid = old_rec.uid;
      UPDATE public.daily_reports SET uid = auth_rec.id WHERE uid = old_rec.uid;
      UPDATE public.leave_requests SET uid = auth_rec.id WHERE uid = old_rec.uid;
      UPDATE public.brainstorm_ideas SET uid = auth_rec.id WHERE uid = old_rec.uid;
      UPDATE public.ballots SET voter_uid = auth_rec.id WHERE voter_uid = old_rec.uid;
      UPDATE public.review_cycles SET underperformer_uid = auth_rec.id WHERE underperformer_uid = old_rec.uid;
      UPDATE public.review_cycles SET tie_breaker_uid = auth_rec.id WHERE tie_breaker_uid = old_rec.uid;

      -- Delete old Firebase profile
      DELETE FROM public.users WHERE uid = old_rec.uid;
      RAISE NOTICE '✅ Migrated successfully';
    END IF;
  END LOOP;
END $$;

-- STEP 4: Delete any remaining duplicate profiles
DELETE FROM public.users a
WHERE EXISTS (
  SELECT 1 FROM public.users b
  WHERE a.email = b.email AND a.uid != b.uid AND a.uid NOT IN (SELECT id::text FROM auth.users)
);

-- STEP 5: Restore email unique constraint
ALTER TABLE public.users ADD CONSTRAINT users_email_key UNIQUE (email);

-- STEP 6: Clean up duplicate leave requests
WITH duplicates AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY uid, start_date, end_date, reason, type ORDER BY id
  ) as rn FROM public.leave_requests
)
DELETE FROM public.leave_requests WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- STEP 7: Update RLS policies to handle TEXT uid type
DROP POLICY IF EXISTS "Allow insert access to users for own profile or admins" ON public.users;
DROP POLICY IF EXISTS "Allow update access to users for own profile or admins" ON public.users;

CREATE POLICY "Allow insert users" ON public.users
  FOR INSERT WITH CHECK (
    auth.uid()::text = uid OR
    EXISTS (SELECT 1 FROM public.users WHERE uid::text = auth.uid()::text AND role IN ('admin', 'founder'))
  );

CREATE POLICY "Allow update users" ON public.users
  FOR UPDATE USING (
    auth.uid()::text = uid OR
    EXISTS (SELECT 1 FROM public.users WHERE uid::text = auth.uid()::text AND role IN ('admin', 'founder'))
  );

-- DONE! Show final status
SELECT
  '✅ MIGRATION COMPLETE' as status,
  au.email,
  pu.name,
  pu.role,
  CASE
    WHEN au.id::text = pu.uid THEN '✅ Migrated'
    WHEN pu.uid IS NULL THEN '⏳ Will create on first login'
    ELSE '❌ Mismatch'
  END as migration_status
FROM auth.users au
LEFT JOIN public.users pu ON pu.email = au.email
ORDER BY au.email;
