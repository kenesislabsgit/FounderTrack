-- ============================================================
-- ULTIMATE SIMPLE FIX - Just make everything TEXT and start fresh
-- ============================================================
-- This stops fighting the migration and just works with what we have
-- ============================================================

-- 1. Disable the trigger that's blocking updates
DROP TRIGGER IF EXISTS check_brainstorm_idea_update_trigger ON public.brainstorm_ideas;

-- 2. Temporarily disable RLS
SET session_replication_role = replica;

-- 3. Drop email unique constraint temporarily
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_email_key;

-- 4. For each logged-in user, update their data
DO $$
DECLARE
  auth_rec RECORD;
  old_rec RECORD;
BEGIN
  FOR auth_rec IN SELECT id::text as id, email FROM auth.users LOOP
    SELECT * INTO old_rec FROM public.users
    WHERE email = auth_rec.email AND uid != auth_rec.id;

    IF FOUND THEN
      RAISE NOTICE 'Migrating: %', auth_rec.email;

      -- Update all references
      UPDATE public.attendance SET uid = auth_rec.id WHERE uid = old_rec.uid;
      UPDATE public.daily_reports SET uid = auth_rec.id WHERE uid = old_rec.uid;
      UPDATE public.leave_requests SET uid = auth_rec.id WHERE uid = old_rec.uid;
      UPDATE public.brainstorm_ideas SET uid = auth_rec.id WHERE uid = old_rec.uid;
      UPDATE public.ballots SET voter_uid = auth_rec.id WHERE voter_uid = old_rec.uid;

      -- Update user profile UID
      UPDATE public.users SET uid = auth_rec.id WHERE uid = old_rec.uid;
    END IF;
  END LOOP;
END $$;

-- 5. Re-enable RLS
SET session_replication_role = DEFAULT;

-- 6. Restore email unique constraint
ALTER TABLE public.users ADD CONSTRAINT users_email_key UNIQUE (email);

-- 7. Restore the trigger
CREATE TRIGGER check_brainstorm_idea_update_trigger
BEFORE UPDATE ON public.brainstorm_ideas
FOR EACH ROW EXECUTE FUNCTION public.check_brainstorm_idea_update();

-- 8. Fix RLS policies with proper TEXT casting
DROP POLICY IF EXISTS "Allow insert settings" ON public.settings;
CREATE POLICY "Allow insert settings" ON public.settings
  FOR INSERT WITH CHECK (id = 'admin-assigned');

DROP POLICY IF EXISTS "Allow insert users" ON public.users;
CREATE POLICY "Allow insert users" ON public.users
  FOR INSERT WITH CHECK (auth.uid()::text = uid);

DROP POLICY IF EXISTS "Allow update users" ON public.users;
CREATE POLICY "Allow update users" ON public.users
  FOR UPDATE USING (auth.uid()::text = uid);

-- Done
SELECT 'DONE' as status, email, uid FROM public.users;
