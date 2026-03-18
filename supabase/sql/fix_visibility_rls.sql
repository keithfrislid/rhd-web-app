-- Fix buyer SELECT policy so that VIP/Exclusive properties become visible to ALL users
-- once their release timers have expired — mirroring the effectiveVisibility() logic in
-- lib/properties.ts.
--
-- The old policy only checked the raw `visibility` column, so a property stuck on
-- visibility='vip' with public_release_at in the past was still invisible to regular buyers.
--
-- Run this in the Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop the existing buyer SELECT policy.
drop policy if exists "properties_select_visibility" on public.properties;

-- Create the new timer-aware buyer SELECT policy.
--
-- Effective visibility logic (mirrors TypeScript effectiveVisibility()):
--
--  visibility = 'public'
--    → everyone can see it
--
--  visibility = 'vip'
--    → if public_release_at is set AND in the future: only VIP-tier buyers
--    → otherwise (past or NULL):                      everyone (effectively public)
--
--  visibility = 'exclusive'
--    → if vip_release_at is NULL:                     only exclusive_user_id (permanent exclusive)
--    → if vip_release_at is in the future:            only exclusive_user_id
--    → if vip_release_at has passed AND public_release_at is in the future:
--                                                     VIP-tier buyers
--    → if vip_release_at has passed AND public_release_at is NULL or past:
--                                                     everyone (effectively public)

create policy "buyer_select_properties"
  on public.properties
  for select
  to authenticated
  using (
    is_archived = false
    AND (

      -- ── Admins always see everything ──────────────────────────────────────
      public.is_admin()

      -- ── Effectively PUBLIC: no restriction ───────────────────────────────

      -- Explicit public visibility
      OR visibility = 'public'

      -- VIP window has ended (or was never set) → public
      OR (
        visibility = 'vip'
        AND (public_release_at IS NULL OR public_release_at <= now())
      )

      -- Exclusive → VIP transition happened AND VIP window also ended → public
      OR (
        visibility = 'exclusive'
        AND vip_release_at IS NOT NULL
        AND vip_release_at <= now()
        AND (public_release_at IS NULL OR public_release_at <= now())
      )

      -- ── VIP-tier buyers during an active VIP window ───────────────────────

      -- VIP property still within its VIP window
      OR (
        visibility = 'vip'
        AND public_release_at > now()
        AND EXISTS (
          SELECT 1 FROM public.profiles
          WHERE user_id = auth.uid()
            AND buyer_tier = 'vip'
        )
      )

      -- Exclusive → VIP transition happened, still within VIP window
      OR (
        visibility = 'exclusive'
        AND vip_release_at IS NOT NULL
        AND vip_release_at <= now()
        AND public_release_at IS NOT NULL
        AND public_release_at > now()
        AND EXISTS (
          SELECT 1 FROM public.profiles
          WHERE user_id = auth.uid()
            AND buyer_tier = 'vip'
        )
      )

      -- ── Exclusive buyer sees their own deal ───────────────────────────────
      OR (
        visibility = 'exclusive'
        AND exclusive_user_id = auth.uid()
      )

    )
  );
