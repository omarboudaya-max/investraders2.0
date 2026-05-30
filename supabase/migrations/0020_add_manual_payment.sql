alter table public.course_enrollments add column if not exists proof_url text;
alter table public.course_enrollments drop constraint if exists course_enrollments_payment_provider_check;
alter table public.course_enrollments add constraint course_enrollments_payment_provider_check check (payment_provider in ('stripe', 'paypal', 'manual'));