-- Add new columns to users table safely
alter table public.users 
add column if not exists investor_fund text,
add column if not exists investor_focus text,
add column if not exists investor_ticket_size text,
add column if not exists investor_preferred_stage text,
add column if not exists subscription_tier text,
add column if not exists subscription_status text,
add column if not exists subscription_period text,
add column if not exists stripe_customer_id text,
add column if not exists stripe_subscription_id text;
