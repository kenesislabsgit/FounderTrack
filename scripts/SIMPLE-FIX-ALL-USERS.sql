-- ============================================================
-- SIMPLE ONE-TIME FIX FOR ALL USERS
-- Run this ONCE in Supabase SQL Editor, then everyone can log in
-- ============================================================

-- Step 1: Allow users to have duplicate emails temporarily
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_email_key;

-- Step 2: For each logged-in user, migrate their old Firebase data
DO $$
DECLARE
  auth_rec RECORD;
  old_rec RECORD;
BEGIN
  FOR auth_rec IN SELECT id, email FROM auth.users LOOP
    -- Find old Firebase profile
    SELECT * INTO old_rec FROM public.users
    WHERE email = auth_rec.email AND uid != auth_rec.id
    LIMIT 1;

    IF FOUND THEN
      RAISE NOTICE 'Migrating: % (% → %)', auth_rec.email, old_rec.uid, auth_rec.id;

      -- Migrate attendance
      UPDATE public.attendance SET uid = auth_rec.id WHERE uid = old_rec.uid;
      -- Migrate reports
      UPDATE public.daily_reports SET uid = auth_rec.id WHERE uid = old_rec.uid;
      -- Migrate leaves
      UPDATE public.leave_requests SET uid = auth_rec.id WHERE uid = old_rec.uid;
      -- Migrate ideas
      UPDATE public.brainstorm_ideas SET uid = auth_rec.id WHERE uid = old_rec.uid;
      -- Migrate ballots
      UPDATE public.ballots SET voter_uid = auth_rec.id WHERE voter_uid = old_rec.uid;

      -- Update profile UID
      UPDATE public.users SET uid = auth_rec.id WHERE uid = old_rec.uid;
    END IF;
  END LOOP;
END $$;

-- Step 3: Clean up any duplicate profiles (keep the one with auth UID)
DELETE FROM public.users
WHERE uid NOT IN (SELECT id FROM auth.users)
AND email IN (SELECT email FROM public.users GROUP BY email HAVING COUNT(*) > 1);

-- Step 4: Re-add unique email constraint
ALTER TABLE public.users ADD CONSTRAINT users_email_key UNIQUE (email);

-- Step 5: Remove duplicate leave requests
WITH duplicates AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY uid, start_date, end_date, reason, type ORDER BY id
  ) as rn FROM public.leave_requests
)
DELETE FROM public.leave_requests WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Done!
SELECT
  'SUCCESS' as status,
  au.email,
  pu.name,
  pu.role,
  CASE WHEN au.id = pu.uid THEN '✅' ELSE '❌' END as migrated
FROM auth.users au
LEFT JOIN public.users pu ON pu.email = au.email;
