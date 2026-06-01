-- Check what review cycles exist

SELECT
  id,
  start_date,
  end_date,
  status,
  underperformer_uid,
  is_tie
FROM public.review_cycles
ORDER BY start_date DESC
LIMIT 5;

-- If you see cycles with status 'voting' or 'completed',
-- you can reset to 'active' or delete them:

-- Option 1: Change status to 'active'
-- UPDATE public.review_cycles SET status = 'active' WHERE status = 'voting';

-- Option 2: Delete all cycles
-- DELETE FROM public.review_cycles;
