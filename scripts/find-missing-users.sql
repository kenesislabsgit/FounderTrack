-- Find users from Firebase migration that haven't logged into Supabase yet

-- 1. Users in public.users but NOT in auth.users (orphaned profiles)
SELECT
  '1. Orphaned Profiles (in database but cannot log in)' as section,
  pu.email,
  pu.name,
  pu.role,
  pu.uid,
  (SELECT COUNT(*) FROM public.attendance WHERE uid = pu.uid) as attendance_count,
  (SELECT COUNT(*) FROM public.daily_reports WHERE uid = pu.uid) as report_count
FROM public.users pu
LEFT JOIN auth.users au ON au.email = pu.email
WHERE au.id IS NULL
ORDER BY pu.name;

-- 2. All current profiles in public.users
SELECT
  '2. All Profiles in Database' as section,
  email,
  name,
  role,
  uid,
  (SELECT COUNT(*) FROM public.attendance WHERE uid = public.users.uid) as attendance_count
FROM public.users
ORDER BY name;

-- 3. Count summary
SELECT
  '3. Summary' as section,
  COUNT(*) as total_profiles,
  COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM auth.users WHERE email = public.users.email)) as can_login,
  COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = public.users.email)) as orphaned
FROM public.users;
