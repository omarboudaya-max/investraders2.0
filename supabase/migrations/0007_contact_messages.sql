CREATE TABLE IF NOT EXISTS public.contact_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert contact messages"
    ON public.contact_messages
    FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Only admins can view contact messages"
    ON public.contact_messages
    FOR SELECT
    USING (auth.jwt() ->> 'email' IN ('omarboudaya1@gmail.com', 'dr.maherkhedher@wisdomnets.com', 'mohammedkhedher222@gmail.com'));
