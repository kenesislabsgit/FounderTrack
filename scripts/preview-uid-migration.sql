-- ============================================================
-- PREVIEW: UID Migration Status for All Users
-- Run this FIRST to see what will be migrated
-- ============================================================
--
-- This is a READ-ONLY query that shows:
-- - Which users have UID mismatches (need migration)
-- - Which users are already correct (will be skipped)
-- - Which users don't have profiles yet (will be created on first login)
--
-- SAFE TO RUN: This only reads data, doesn't change anything
-- ============================================================

-- 1. Show current state of all users
SELECT
  '1. Current State' as section,
  au.email,
  au.id as auth_uid,
  pu.uid as profile_uid,
  pu.name,
  pu.role,
  CASE
    WHEN pu.uid IS NULL THEN '⚠️ No profile yet (OK - will be created on first login)'
    WHEN au.id::text = pu.uid::text THEN '✅ UIDs match (no migration needed)'
    ELSE '❌ UID MISMATCH (NEEDS MIGRATION)'
  END as status
FROM auth.users au
LEFT JOIN public.users pu ON pu.email = au.email
ORDER BY
  CASE
    WHEN pu.uid IS NULL THEN 3
    WHEN au.id::text = pu.uid::text THEN 2
    ELSE 1
  END,
  au.email;

-- 2. Count users by migration status
SELECT
  '2. Migration Summary' as section,
  COUNT(*) FILTER (WHERE pu.uid IS NOT NULL AND au.id::text != pu.uid::text) as needs_migration,
  COUNT(*) FILTER (WHERE pu.uid IS NOT NULL AND au.id::text = pu.uid::text) as already_correct,
  COUNT(*) FILTER (WHERE pu.uid IS NULL) as no_profile_yet,
  COUNT(*) as total_auth_users
FROM auth.users au
LEFT JOIN public.users pu ON pu.email = au.email;

-- 3. Show users that WILL BE MIGRATED (detailed view)
SELECT
  '3. Users That Will Be Migrated' as section,
  au.email,
  pu.name,
  pu.role,
  pu.uid as old_uid,
  au.id as new_uid,
  (SELECT COUNT(*) FROM public.attendance WHERE uid = pu.uid) as attendance_records,
  (SELECT COUNT(*) FROM public.daily_reports WHERE uid = pu.uid) as report_records,
  (SELECT COUNT(*) FROM public.leave_requests WHERE uid = pu.uid) as leave_records,
  (SELECT COUNT(*) FROM public.brainstorm_ideas WHERE uid = pu.uid) as idea_records
FROM auth.users au
INNER JOIN public.users pu ON pu.email = au.email
WHERE au.id::text != pu.uid::text
ORDER BY pu.name;

-- 4. Show orphaned profiles (profiles without auth users)
SELECT
  '4. Orphaned Profiles (no matching auth user)' as section,
  pu.email,
  pu.name,
  pu.role,
  pu.uid,
  (SELECT COUNT(*) FROM public.attendance WHERE uid = pu.uid) as attendance_records,
  'These profiles cannot log in anymore' as warning
FROM public.users pu
LEFT JOIN auth.users au ON au.email = pu.email
WHERE au.id IS NULL
ORDER BY pu.name;
