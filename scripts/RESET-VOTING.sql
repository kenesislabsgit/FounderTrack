-- Reset voting - delete all old cycles

DELETE FROM public.review_cycles;

-- Or just change status to 'active'
-- UPDATE public.review_cycles SET status = 'active' WHERE status != 'active';
