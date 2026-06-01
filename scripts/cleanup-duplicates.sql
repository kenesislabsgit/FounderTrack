-- Remove duplicates from brainstorm_ideas and leave_requests

-- 1. Remove duplicate brainstorm ideas (keep oldest by ID)
WITH duplicates AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY uid, title, description, created_at
    ORDER BY id
  ) as rn
  FROM public.brainstorm_ideas
)
DELETE FROM public.brainstorm_ideas
WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);

-- 2. Remove duplicate leave requests (keep oldest by ID)
WITH duplicates AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY uid, start_date, end_date, reason, type
    ORDER BY id
  ) as rn
  FROM public.leave_requests
)
DELETE FROM public.leave_requests
WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);

-- Show summary
SELECT
  'brainstorm_ideas' as table_name,
  COUNT(*) as remaining_records
FROM public.brainstorm_ideas
UNION ALL
SELECT
  'leave_requests' as table_name,
  COUNT(*) as remaining_records
FROM public.leave_requests;
