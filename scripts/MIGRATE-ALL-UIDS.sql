-- ============================================================
-- MIGRATE ALL UIDs FROM FIREBASE TO SUPABASE
-- Run this ONCE to fix everything
-- ============================================================

-- Step 1: Disable triggers to avoid conflicts
DROP TRIGGER IF EXISTS check_brainstorm_idea_update_trigger ON public.brainstorm_ideas;

-- Step 2: Temporarily disable RLS
SET session_replication_role = replica;

-- Step 3: Migrate all users who have logged into Supabase
DO $$
DECLARE
  auth_rec RECORD;
  old_rec RECORD;
  att_count INT;
  rep_count INT;
  lv_count INT;
BEGIN
  RAISE NOTICE '🚀 Starting UID migration...';
  RAISE NOTICE '';

  -- Loop through each Supabase Auth user
  FOR auth_rec IN SELECT id::text as new_uid, email FROM auth.users LOOP

    -- Find their old Firebase profile by email
    SELECT * INTO old_rec FROM public.users
    WHERE email = auth_rec.email AND uid != auth_rec.new_uid;

    IF FOUND THEN
      RAISE NOTICE '👤 Migrating: %', auth_rec.email;
      RAISE NOTICE '   Old UID: %', old_rec.uid;
      RAISE NOTICE '   New UID: %', auth_rec.new_uid;

      -- Update attendance records
      UPDATE public.attendance
      SET uid = auth_rec.new_uid
      WHERE uid = old_rec.uid;
      GET DIAGNOSTICS att_count = ROW_COUNT;
      IF att_count > 0 THEN
        RAISE NOTICE '   ✅ Migrated % attendance records', att_count;
      END IF;

      -- Update daily_reports records
      UPDATE public.daily_reports
      SET uid = auth_rec.new_uid
      WHERE uid = old_rec.uid;
      GET DIAGNOSTICS rep_count = ROW_COUNT;
      IF rep_count > 0 THEN
        RAISE NOTICE '   ✅ Migrated % daily report records', rep_count;
      END IF;

      -- Update leave_requests records
      UPDATE public.leave_requests
      SET uid = auth_rec.new_uid
      WHERE uid = old_rec.uid;
      GET DIAGNOSTICS lv_count = ROW_COUNT;
      IF lv_count > 0 THEN
        RAISE NOTICE '   ✅ Migrated % leave request records', lv_count;
      END IF;

      -- Update brainstorm_ideas records
      UPDATE public.brainstorm_ideas
      SET uid = auth_rec.new_uid
      WHERE uid = old_rec.uid;

      -- Update ballots records
      UPDATE public.ballots
      SET voter_uid = auth_rec.new_uid
      WHERE voter_uid = old_rec.uid;

      -- Update review_cycles records
      UPDATE public.review_cycles
      SET underperformer_uid = auth_rec.new_uid
      WHERE underperformer_uid = old_rec.uid;

      UPDATE public.review_cycles
      SET tie_breaker_uid = auth_rec.new_uid
      WHERE tie_breaker_uid = old_rec.uid;

      -- Finally, update the users table UID
      UPDATE public.users
      SET uid = auth_rec.new_uid
      WHERE uid = old_rec.uid;

      RAISE NOTICE '   ✅ Migration complete';
      RAISE NOTICE '';
    END IF;
  END LOOP;

  RAISE NOTICE '🎉 All UIDs migrated successfully!';
END $$;

-- Step 4: Re-enable RLS
SET session_replication_role = DEFAULT;

-- Step 5: Restore trigger
CREATE TRIGGER check_brainstorm_idea_update_trigger
BEFORE UPDATE ON public.brainstorm_ideas
FOR EACH ROW EXECUTE FUNCTION public.check_brainstorm_idea_update();

-- Step 6: Show final status
SELECT
  '✅ MIGRATION COMPLETE' as status,
  au.email,
  pu.name,
  pu.role,
  pu.uid,
  (SELECT COUNT(*) FROM public.attendance WHERE uid = pu.uid) as attendance_count,
  (SELECT COUNT(*) FROM public.daily_reports WHERE uid = pu.uid) as report_count
FROM auth.users au
JOIN public.users pu ON pu.email = au.email
ORDER BY pu.name;
