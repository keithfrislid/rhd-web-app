-- Fix multi-admin support: update is_admin() to accept role='admin' OR is_admin=true
-- Run this in the Supabase SQL editor.

-- 1. Replace the is_admin() helper function used by RLS policies
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1 from public.profiles
    where user_id = auth.uid()
      and (is_admin = true or role = 'admin')
  );
$$;

-- 2. Ensure properties table has admin INSERT/UPDATE/DELETE policies
--    (Safe to run: uses CREATE POLICY IF NOT EXISTS pattern via drop+create)

-- INSERT
drop policy if exists "admin_insert_properties" on public.properties;
create policy "admin_insert_properties"
  on public.properties
  for insert
  to authenticated
  with check (public.is_admin());

-- UPDATE
drop policy if exists "admin_update_properties" on public.properties;
create policy "admin_update_properties"
  on public.properties
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- DELETE
drop policy if exists "admin_delete_properties" on public.properties;
create policy "admin_delete_properties"
  on public.properties
  for delete
  to authenticated
  using (public.is_admin());

-- SELECT (admins see all, including archived)
drop policy if exists "admin_select_all_properties" on public.properties;
create policy "admin_select_all_properties"
  on public.properties
  for select
  to authenticated
  using (public.is_admin());

-- 3. Ensure offers table has admin UPDATE policy (for accept/reject)

-- UPDATE
drop policy if exists "admin_update_offers" on public.offers;
create policy "admin_update_offers"
  on public.offers
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- SELECT (admins see all offers)
drop policy if exists "admin_select_all_offers" on public.offers;
create policy "admin_select_all_offers"
  on public.offers
  for select
  to authenticated
  using (public.is_admin());
