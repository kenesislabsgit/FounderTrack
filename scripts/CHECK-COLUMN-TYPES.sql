-- Check actual column types in database

SELECT
  column_name,
  data_type,
  udt_name
FROM information_schema.columns
WHERE table_name = 'users' AND table_schema = 'public';

-- Also show sample data
SELECT uid, email, pg_typeof(uid) as uid_type FROM public.users LIMIT 3;
