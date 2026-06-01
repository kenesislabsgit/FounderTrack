-- Fix leave request permissions: only admins can approve/reject

DROP POLICY IF EXISTS "Allow update access to leave_requests for owner or admins" ON public.leave_requests;

-- Users can only update their OWN pending requests (edit reason/dates, NOT status)
-- Admins can update anything
CREATE POLICY "Allow update leave_requests" ON public.leave_requests
  FOR UPDATE USING (
    (auth.uid()::text = uid::text AND status = 'pending') OR
    (SELECT role IN ('admin', 'founder') FROM public.users WHERE uid::text = auth.uid()::text)
  )
  WITH CHECK (
    -- Users cannot change status field
    (auth.uid()::text = uid::text AND status = OLD.status) OR
    -- Admins can change anything
    (SELECT role IN ('admin', 'founder') FROM public.users WHERE uid::text = auth.uid()::text)
  );
