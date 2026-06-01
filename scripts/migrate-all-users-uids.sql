-- ============================================================
-- UID Migration for ALL Users (Firebase → Supabase)
-- Run this in Supabase SQL Editor
-- ============================================================
--
-- This script:
-- 1. Finds all users in auth.users (Supabase Auth)
-- 2. Matches them to public.users by email
-- 3. Migrates any user with a UID mismatch
-- 4. Preserves all data (attendance, reports, etc.)
--
-- SAFE TO RUN: Only affects users with email matches between
-- auth.users and public.users where UIDs don't match.
-- ============================================================

-- Temporarily disable triggers and RLS for migration
SET session_replication_role = replica;

DO $$
DECLARE
  auth_user RECORD;
  old_profile RECORD;
  migration_count INT := 0;
  skip_count INT := 0;
  record_count INT;
BEGIN
  RAISE NOTICE '🚀 Starting bulk UID migration for all users...';
  RAISE NOTICE '================================================';

  -- Loop through all users in auth.users
  FOR auth_user IN
    SELECT id, email,
           raw_user_meta_data->>'full_name' as full_name,
           raw_user_meta_data->>'name' as name,
           raw_user_meta_data->>'avatar_url' as avatar_url,
           raw_user_meta_data->>'picture' as picture
    FROM auth.users
  LOOP
    -- Check if there's a profile in public.users with same email but different UID
    SELECT * INTO old_profile
    FROM public.users
    WHERE email = auth_user.email
    AND uid::text != auth_user.id::text;

    IF FOUND THEN
      -- Found a profile with mismatched UID - migrate it!
      RAISE NOTICE '';
      RAISE NOTICE '👤 Migrating user: % (%)', old_profile.name, auth_user.email;
      RAISE NOTICE '   Old UID: %', old_profile.uid;
      RAISE NOTICE '   New UID: %', auth_user.id;

      -- Step 1: Temporarily rename old profile's email to avoid unique constraint conflict
      UPDATE public.users
      SET email = email || '-old-' || old_profile.uid
      WHERE uid = old_profile.uid;

      -- Step 2: Create new profile with correct UID and email
      INSERT INTO public.users (uid, name, email, role, photo_url, preferences)
      VALUES (
        auth_user.id,
        old_profile.name,
        old_profile.email,
        old_profile.role,
        old_profile.photo_url,
        old_profile.preferences
      );

      -- Migrate attendance records
      UPDATE public.attendance
      SET uid = auth_user.id
      WHERE uid = old_profile.uid;
      GET DIAGNOSTICS record_count = ROW_COUNT;
      IF record_count > 0 THEN
        RAISE NOTICE '   ✅ Migrated % attendance records', record_count;
      END IF;

      -- Migrate daily_reports records
      UPDATE public.daily_reports
      SET uid = auth_user.id
      WHERE uid = old_profile.uid;
      GET DIAGNOSTICS record_count = ROW_COUNT;
      IF record_count > 0 THEN
        RAISE NOTICE '   ✅ Migrated % daily report records', record_count;
      END IF;

      -- Migrate leave_requests records
      UPDATE public.leave_requests
      SET uid = auth_user.id
      WHERE uid = old_profile.uid;
      GET DIAGNOSTICS record_count = ROW_COUNT;
      IF record_count > 0 THEN
        RAISE NOTICE '   ✅ Migrated % leave request records', record_count;
      END IF;

      -- Migrate brainstorm_ideas records
      UPDATE public.brainstorm_ideas
      SET uid = auth_user.id
      WHERE uid = old_profile.uid;
      GET DIAGNOSTICS record_count = ROW_COUNT;
      IF record_count > 0 THEN
        RAISE NOTICE '   ✅ Migrated % brainstorm idea records', record_count;
      END IF;

      -- Migrate ballots records (voter_uid)
      UPDATE public.ballots
      SET voter_uid = auth_user.id
      WHERE voter_uid = old_profile.uid;
      GET DIAGNOSTICS record_count = ROW_COUNT;
      IF record_count > 0 THEN
        RAISE NOTICE '   ✅ Migrated % ballot records', record_count;
      END IF;

      -- Migrate review_cycles records (underperformer_uid)
      UPDATE public.review_cycles
      SET underperformer_uid = auth_user.id
      WHERE underperformer_uid = old_profile.uid;
      GET DIAGNOSTICS record_count = ROW_COUNT;
      IF record_count > 0 THEN
        RAISE NOTICE '   ✅ Migrated % review cycle (underperformer) records', record_count;
      END IF;

      -- Migrate review_cycles records (tie_breaker_uid)
      UPDATE public.review_cycles
      SET tie_breaker_uid = auth_user.id
      WHERE tie_breaker_uid = old_profile.uid;
      GET DIAGNOSTICS record_count = ROW_COUNT;
      IF record_count > 0 THEN
        RAISE NOTICE '   ✅ Migrated % review cycle (tie breaker) records', record_count;
      END IF;

      -- Step 3: Delete old profile (now has renamed email)
      DELETE FROM public.users WHERE uid = old_profile.uid;
      RAISE NOTICE '   ✅ Deleted old profile';

      migration_count := migration_count + 1;
    ELSE
      -- Check if user already has correct UID (no migration needed)
      SELECT * INTO old_profile
      FROM public.users
      WHERE email = auth_user.email
      AND uid::text = auth_user.id::text;

      IF FOUND THEN
        -- UID already matches - skip
        skip_count := skip_count + 1;
      ELSE
        -- User doesn't exist in public.users yet - they'll be created on first login
        NULL;
      END IF;
    END IF;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '================================================';
  RAISE NOTICE '🎉 Migration complete!';
  RAISE NOTICE '   ✅ Migrated: % users', migration_count;
  RAISE NOTICE '   ⏭  Skipped (already correct): % users', skip_count;
  RAISE NOTICE '================================================';

END $$;

-- Re-enable triggers and RLS
SET session_replication_role = DEFAULT;

-- Commit the transaction
COMMIT;

-- Verification: Show all users and their UID status
SELECT
  'Verification Report' as report_type,
  au.email,
  au.id as auth_uid,
  pu.uid as profile_uid,
  CASE
    WHEN pu.uid IS NULL THEN '⚠️ No profile yet'
    WHEN au.id::text = pu.uid::text THEN '✅ Match'
    ELSE '❌ Mismatch'
  END as status,
  pu.name,
  pu.role
FROM auth.users au
LEFT JOIN public.users pu ON pu.email = au.email
ORDER BY au.email;
