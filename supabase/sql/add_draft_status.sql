-- Add "Draft" status support
-- Draft properties are admin-staging only — invisible to all buyers regardless of visibility.
--
-- Two changes:
--   1. Drop and recreate the buyer SELECT policy to exclude Draft rows.
--   2. (Optional) If your status column is an enum rather than text, alter it here.
--      If it is already a text column, skip the ALTER TYPE block.
--
-- Run this in the Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

-- If status is a PostgreSQL enum, add "Draft" to it:
-- (Skip this block if status is a plain text column — check with:
--  SELECT data_type FROM information_schema.columns
--  WHERE table_name='properties' AND column_name='status';)
--
-- DO $$
-- BEGIN
--   IF NOT EXISTS (
--     SELECT 1 FROM pg_enum
--     WHERE enumtypid = 'property_status'::regtype AND enumlabel = 'Draft'
--   ) THEN
--     ALTER TYPE property_status ADD VALUE 'Draft';
--   END IF;
-- END
-- $$;

-- ── Buyer SELECT policy — block Draft from buyers ─────────────────────────────

DROP POLICY IF EXISTS "buyer_select_properties" ON public.properties;
DROP POLICY IF EXISTS "properties_select_visibility" ON public.properties;

CREATE POLICY "buyer_select_properties"
  ON public.properties
  FOR SELECT
  TO authenticated
  USING (
    is_archived = false

    AND (

      -- ── Admins always see everything (including Drafts) ───────────────────
      public.is_admin()

      OR (
        -- Non-admins never see Drafts
        status != 'Draft'

        AND (

          -- ── Effectively PUBLIC ─────────────────────────────────────────────

          -- Explicit public visibility
          visibility = 'public'

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

          -- ── VIP-tier buyers during an active VIP window ───────────────────

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

          -- ── Exclusive buyer sees their own deal ───────────────────────────
          OR (
            visibility = 'exclusive'
            AND exclusive_user_id = auth.uid()
          )

        )
      )

    )
  );
