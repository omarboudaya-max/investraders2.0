-- Drop the existing overly-restrictive select policies
DROP POLICY IF EXISTS "users_select" ON public.users;
DROP POLICY IF EXISTS "startups_select" ON public.startups;

-- Allow any authenticated user to view the users directory
CREATE POLICY "users_select" ON public.users FOR SELECT USING (auth.role() = 'authenticated');

-- Allow any authenticated user to view startups
CREATE POLICY "startups_select" ON public.startups FOR SELECT USING (auth.role() = 'authenticated');
