-- ============================================================
-- UID Migration for kenesislabs@gmail.com
-- Run this in Supabase SQL Editor
-- ============================================================

-- Set the variables for this migration
DO $$
DECLARE
  old_uid TEXT := 'Yo7UpJNOBQh1BaJDqH4mjiWgu4w1';
  new_uid UUID := '9fda3591-38d9-405e-82f9-3f7e1cc89d9e';
  user_email TEXT := 'kenesislabs@gmail.com';
  old_profile RECORD;
  record_count INT;
BEGIN
  RAISE NOTICE '🔧 Starting UID migration for %', user_email;

  -- 1. Get old profile data
  SELECT * INTO old_profile FROM public.users WHERE uid::text = old_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION '❌ Old profile not found with UID: %', old_uid;
  END IF;

  RAISE NOTICE '✅ Found old profile: % (role: %)', old_profile.name, old_profile.role;

  -- 2. Ensure new profile exists with correct data
  INSERT INTO public.users (uid, name, email, role, photo_url, preferences)
  VALUES (
    new_uid,
    old_profile.name,
    old_profile.email,
    old_profile.role,
    old_profile.photo_url,
    old_profile.preferences
  )
  ON CONFLICT (uid) DO UPDATE SET
    name = EXCLUDED.name,
    role = EXCLUDED.role,
    photo_url = EXCLUDED.photo_url,
    preferences = EXCLUDED.preferences;

  RAISE NOTICE '✅ New profile created/updated with UID: %', new_uid;

  -- 3. Migrate attendance records
  UPDATE public.attendance
  SET uid = new_uid
  WHERE uid::text = old_uid;

  GET DIAGNOSTICS record_count = ROW_COUNT;
  RAISE NOTICE '✅ Migrated % attendance records', record_count;

  -- 4. Migrate daily_reports records
  UPDATE public.daily_reports
  SET uid = new_uid
  WHERE uid::text = old_uid;

  GET DIAGNOSTICS record_count = ROW_COUNT;
  RAISE NOTICE '✅ Migrated % daily report records', record_count;

  -- 5. Migrate leave_requests records
  UPDATE public.leave_requests
  SET uid = new_uid
  WHERE uid::text = old_uid;

  GET DIAGNOSTICS record_count = ROW_COUNT;
  RAISE NOTICE '✅ Migrated % leave request records', record_count;

  -- 6. Migrate brainstorm_ideas records
  UPDATE public.brainstorm_ideas
  SET uid = new_uid
  WHERE uid::text = old_uid;

  GET DIAGNOSTICS record_count = ROW_COUNT;
  RAISE NOTICE '✅ Migrated % brainstorm idea records', record_count;

  -- 7. Migrate ballots records (voter_uid)
  UPDATE public.ballots
  SET voter_uid = new_uid
  WHERE voter_uid::text = old_uid;

  GET DIAGNOSTICS record_count = ROW_COUNT;
  RAISE NOTICE '✅ Migrated % ballot records', record_count;

  -- 8. Migrate review_cycles records (underperformer_uid)
  UPDATE public.review_cycles
  SET underperformer_uid = new_uid
  WHERE underperformer_uid::text = old_uid;

  GET DIAGNOSTICS record_count = ROW_COUNT;
  RAISE NOTICE '✅ Migrated % review cycle underperformer records', record_count;

  -- 9. Migrate review_cycles records (tie_breaker_uid)
  UPDATE public.review_cycles
  SET tie_breaker_uid = new_uid
  WHERE tie_breaker_uid::text = old_uid;

  GET DIAGNOSTICS record_count = ROW_COUNT;
  RAISE NOTICE '✅ Migrated % review cycle tie breaker records', record_count;

  -- 10. Delete old profile (now that all FKs are migrated)
  DELETE FROM public.users WHERE uid::text = old_uid;
  RAISE NOTICE '✅ Deleted old profile';

  -- 11. Verify migration
  SELECT COUNT(*) INTO record_count FROM public.users WHERE email = user_email;

  IF record_count = 1 THEN
    RAISE NOTICE '🎉 Migration complete! Found exactly 1 profile for %', user_email;
  ELSIF record_count = 0 THEN
    RAISE EXCEPTION '❌ Migration failed: No profile found after migration';
  ELSE
    RAISE WARNING '⚠️  Found % profiles for % - there may be duplicates', record_count, user_email;
  END IF;

  -- Show final profile
  SELECT uid, name, email, role INTO old_profile FROM public.users WHERE email = user_email;
  RAISE NOTICE 'Final profile: UID=%, Name=%, Role=%', old_profile.uid, old_profile.name, old_profile.role;

END $$;

-- Commit the transaction
COMMIT;

-- Verification query
SELECT
  'Verification' as check_type,
  COUNT(*) as profile_count,
  STRING_AGG(uid::text, ', ') as uids
FROM public.users
WHERE email = 'kenesislabs@gmail.com';
