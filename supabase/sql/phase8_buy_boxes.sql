-- Phase 8B — Buy Box MVP (counties only)
-- Run this in Supabase SQL Editor.

-- 1) Table
create table if not exists public.buyer_buy_boxes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  counties text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz null
);

-- 2) RLS
alter table public.buyer_buy_boxes enable row level security;

-- Buyers can read their own row
drop policy if exists "buyer_buy_boxes_select_own" on public.buyer_buy_boxes;
create policy "buyer_buy_boxes_select_own"
on public.buyer_buy_boxes
for select
to authenticated
using (auth.uid() = user_id);

-- Buyers can insert their own row
drop policy if exists "buyer_buy_boxes_insert_own" on public.buyer_buy_boxes;
create policy "buyer_buy_boxes_insert_own"
on public.buyer_buy_boxes
for insert
to authenticated
with check (auth.uid() = user_id);

-- Buyers can update their own row
drop policy if exists "buyer_buy_boxes_update_own" on public.buyer_buy_boxes;
create policy "buyer_buy_boxes_update_own"
on public.buyer_buy_boxes
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Admin can read all (uses your existing helper)
-- If you do NOT have public.is_admin(), replace this with your admin check.
drop policy if exists "buyer_buy_boxes_admin_select_all" on public.buyer_buy_boxes;
create policy "buyer_buy_boxes_admin_select_all"
on public.buyer_buy_boxes
for select
to authenticated
using (public.is_admin());
