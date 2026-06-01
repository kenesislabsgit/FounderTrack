-- Show ALL Firebase users and their migration status

SELECT
  '1. All Users from Firebase Migration' as section,
  pu.email,
  pu.name,
  pu.role,
  pu.uid as firebase_uid,
  au.id as supabase_auth_uid,
  CASE
    WHEN au.id IS NULL THEN '⏳ NOT LOGGED INTO SUPABASE YET'
    WHEN au.id::text = pu.uid::text THEN '✅ MIGRATED (UIDs match)'
    ELSE '❌ UID MISMATCH (needs migration)'
  END as status,
  (SELECT COUNT(*) FROM public.attendance WHERE uid = pu.uid) as attendance_count,
  (SELECT COUNT(*) FROM public.daily_reports WHERE uid = pu.uid) as report_count,
  (SELECT COUNT(*) FROM public.leave_requests WHERE uid = pu.uid) as leave_request_count
FROM public.users pu
LEFT JOIN auth.users au ON au.email = pu.email
ORDER BY
  CASE
    WHEN au.id IS NULL THEN 1  -- Not logged in yet (priority 1)
    WHEN au.id::text != pu.uid::text THEN 2  -- Needs migration (priority 2)
    ELSE 3  -- Already migrated (priority 3)
  END,
  pu.name;

-- Summary counts
SELECT
  '2. Migration Summary' as section,
  COUNT(*) as total_firebase_users,
  COUNT(*) FILTER (WHERE au.id IS NULL) as waiting_for_first_login,
  COUNT(*) FILTER (WHERE au.id IS NOT NULL AND au.id::text != pu.uid::text) as needs_migration,
  COUNT(*) FILTER (WHERE au.id IS NOT NULL AND au.id::text = pu.uid::text) as already_migrated
FROM public.users pu
LEFT JOIN auth.users au ON au.email = pu.email;
