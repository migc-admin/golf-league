-- Update handle_new_user to link invited users to the inviting org
-- When an admin invites a user via invite-admin Edge Function,
-- the org_id and role are passed as user_metadata so the profile
-- gets linked to the correct org on first sign-in.

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, role, full_name, org_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'admin'),
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    (new.raw_user_meta_data->>'org_id')::uuid
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
