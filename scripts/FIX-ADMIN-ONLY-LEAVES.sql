-- Make only 'admin' role able to approve/reject leaves (not founders)

-- Update is_admin function to only check 'admin' role
CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE uid::text = user_id::text AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Or if you want to keep founders with admin powers elsewhere but not for leaves:
-- Create a separate function for leave approval
CREATE OR REPLACE FUNCTION public.can_approve_leaves(user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE uid::text = user_id::text AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update leave_requests policy to use new function
DROP POLICY IF EXISTS "Allow update leave_requests" ON public.leave_requests;
CREATE POLICY "Allow update leave_requests" ON public.leave_requests
  FOR UPDATE USING (
    can_approve_leaves(auth.uid())
  );
