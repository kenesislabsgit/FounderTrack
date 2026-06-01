-- Find orphaned UIDs (have leave requests but no user profile)

SELECT
  '1. Orphaned Leave Requests' as section,
  lr.uid,
  COUNT(*) as request_count,
  MIN(lr.start_date) as first_request,
  MAX(lr.start_date) as last_request,
  CASE
    WHEN EXISTS (SELECT 1 FROM public.users WHERE uid = lr.uid) THEN '✅ Has profile'
    ELSE '❌ No profile (orphaned)'
  END as profile_status
FROM public.leave_requests lr
GROUP BY lr.uid
ORDER BY request_count DESC;

-- Find which emails these orphaned UIDs belong to (from old Firebase export)
-- You'll need to manually check firebase-export.json for these UIDs
