ALTER TABLE public.course_enrollments DROP CONSTRAINT IF EXISTS course_enrollments_payment_provider_check;
ALTER TABLE public.course_enrollments ADD CONSTRAINT course_enrollments_payment_provider_check CHECK (payment_provider IN ('stripe', 'paypal', 'manual'));

ALTER TABLE public.course_enrollments ADD COLUMN IF NOT EXISTS proof_url text;
