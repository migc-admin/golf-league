-- Add stripe_customer_id to organizations for subscription management
alter table public.organizations
  add column if not exists stripe_customer_id text unique;

create index if not exists idx_organizations_stripe_customer
  on public.organizations(stripe_customer_id);
