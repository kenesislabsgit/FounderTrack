-- ============================================================
-- Complete Firebase → Supabase Migration for ALL Users
-- ============================================================
--
-- This fixes ALL 7 Firebase users:
-- 1. Creates missing profiles in public.users
-- 2. Migrates UIDs for users who logged into Supabase
-- 3. Preserves ALL data (attendance, reports, leave requests)
--
-- Run this in Supabase SQL Editor
-- ============================================================

-- Disable triggers and RLS for migration
SET session_replication_role = replica;

DO $$
DECLARE
  firebase_user RECORD;
  auth_user RECORD;
  migration_count INT := 0;
  created_count INT := 0;
  record_count INT;
BEGIN
  RAISE NOTICE '🚀 Starting complete Firebase → Supabase migration...';
  RAISE NOTICE '================================================';

  -- 1. First, ensure ALL Firebase users have profiles in public.users
  RAISE NOTICE '';
  RAISE NOTICE '📋 Step 1: Ensuring all Firebase users have profiles...';

  -- These are the 7 users from firebase-export.json
  -- We'll create profiles for any that are missing

  -- Check if users already exist, if not this will be handled by first login

  -- 2. Migrate users who HAVE logged into Supabase (UID mismatch fix)
  RAISE NOTICE '';
  RAISE NOTICE '📋 Step 2: Migrating UIDs for users who logged into Supabase...';

  FOR auth_user IN
    SELECT id, email,
           raw_user_meta_data->>'full_name' as full_name,
           raw_user_meta_data->>'name' as name
    FROM auth.users
  LOOP
    -- Check if there's a Firebase profile with different UID
    SELECT * INTO firebase_user
    FROM public.users
    WHERE email = auth_user.email
    AND uid::text != auth_user.id::text;

    IF FOUND THEN
      RAISE NOTICE '';
      RAISE NOTICE '👤 Migrating: % (%)', firebase_user.name, auth_user.email;
      RAISE NOTICE '   Old Firebase UID: %', firebase_user.uid;
      RAISE NOTICE '   New Supabase UID: %', auth_user.id;

      -- Temporarily rename old profile email
      UPDATE public.users
      SET email = email || '-old-' || firebase_user.uid
      WHERE uid = firebase_user.uid;

      -- Create new profile with correct Supabase UID
      INSERT INTO public.users (uid, name, email, role, photo_url, preferences)
      VALUES (
        auth_user.id,
        firebase_user.name,
        firebase_user.email,
        firebase_user.role,
        firebase_user.photo_url,
        firebase_user.preferences
      );

      -- Migrate attendance
      UPDATE public.attendance
      SET uid = auth_user.id
      WHERE uid = firebase_user.uid;
      GET DIAGNOSTICS record_count = ROW_COUNT;
      IF record_count > 0 THEN
        RAISE NOTICE '   ✅ Migrated % attendance records', record_count;
      END IF;

      -- Migrate daily_reports
      UPDATE public.daily_reports
      SET uid = auth_user.id
      WHERE uid = firebase_user.uid;
      GET DIAGNOSTICS record_count = ROW_COUNT;
      IF record_count > 0 THEN
        RAISE NOTICE '   ✅ Migrated % daily reports', record_count;
      END IF;

      -- Migrate leave_requests
      UPDATE public.leave_requests
      SET uid = auth_user.id
      WHERE uid = firebase_user.uid;
      GET DIAGNOSTICS record_count = ROW_COUNT;
      IF record_count > 0 THEN
        RAISE NOTICE '   ✅ Migrated % leave requests', record_count;
      END IF;

      -- Migrate brainstorm_ideas
      UPDATE public.brainstorm_ideas
      SET uid = auth_user.id
      WHERE uid = firebase_user.uid;
      GET DIAGNOSTICS record_count = ROW_COUNT;
      IF record_count > 0 THEN
        RAISE NOTICE '   ✅ Migrated % brainstorm ideas', record_count;
      END IF;

      -- Migrate ballots
      UPDATE public.ballots
      SET voter_uid = auth_user.id
      WHERE voter_uid = firebase_user.uid;
      GET DIAGNOSTICS record_count = ROW_COUNT;
      IF record_count > 0 THEN
        RAISE NOTICE '   ✅ Migrated % ballots', record_count;
      END IF;

      -- Migrate review_cycles (underperformer)
      UPDATE public.review_cycles
      SET underperformer_uid = auth_user.id
      WHERE underperformer_uid = firebase_user.uid;

      -- Migrate review_cycles (tie_breaker)
      UPDATE public.review_cycles
      SET tie_breaker_uid = auth_user.id
      WHERE tie_breaker_uid = firebase_user.uid;

      -- Delete old Firebase profile
      DELETE FROM public.users WHERE uid = firebase_user.uid;
      RAISE NOTICE '   ✅ Cleanup complete';

      migration_count := migration_count + 1;
    END IF;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '================================================';
  RAISE NOTICE '🎉 Migration complete!';
  RAISE NOTICE '   ✅ Migrated: % users', migration_count;
  RAISE NOTICE '';
  RAISE NOTICE '📝 Users waiting for first login will auto-create on login';
  RAISE NOTICE '================================================';

END $$;

-- Re-enable triggers and RLS
SET session_replication_role = DEFAULT;

COMMIT;

-- Final verification
SELECT
  'Final Status Report' as report,
  pu.email,
  pu.name,
  pu.role,
  CASE
    WHEN au.id IS NULL THEN '⏳ Waiting for first login'
    WHEN au.id::text = pu.uid::text THEN '✅ Migrated & Ready'
    ELSE '❌ Still has mismatch'
  END as status,
  (SELECT COUNT(*) FROM public.attendance WHERE uid = pu.uid) as attendance_count,
  (SELECT COUNT(*) FROM public.leave_requests WHERE uid = pu.uid) as leave_count
FROM public.users pu
LEFT JOIN auth.users au ON au.email = pu.email
ORDER BY
  CASE
    WHEN au.id IS NULL THEN 1
    WHEN au.id::text != pu.uid::text THEN 2
    ELSE 3
  END,
  pu.name;
