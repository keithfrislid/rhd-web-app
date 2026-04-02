-- Due Diligence auto-archive setup
-- Run this in the Supabase SQL Editor.
--
-- What this does:
--   1. Immediately archives any active properties already past their DD date (catch-up run)
--   2. Schedules a daily pg_cron job at 6 AM UTC to do the same going forward
--
-- Rule: if a property is still active (not Under Contract, not Draft, not archived)
-- when its due_diligence_date passes, it gets archived as Closed Lost.
-- Properties that went Under Contract before DD expired are never touched.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Step 1: Immediate catch-up — archive anything already expired ─────────────

UPDATE public.properties
SET
  is_archived    = true,
  closed_outcome = 'lost',
  closed_at      = now(),
  closed_reason  = 'Due diligence expired'
WHERE
  is_archived          = false
  AND status           != 'Under Contract'
  AND status           != 'Draft'
  AND due_diligence_date IS NOT NULL
  AND due_diligence_date < CURRENT_DATE;


-- ── Step 2: Daily pg_cron job ─────────────────────────────────────────────────
-- Requires pg_cron extension. Enable it in Supabase:
--   Dashboard → Database → Extensions → search "pg_cron" → Enable
--
-- Runs at 6 AM UTC every day.

SELECT cron.schedule(
  'due-diligence-check',          -- job name (unique)
  '0 6 * * *',                    -- every day at 06:00 UTC
  $$
    UPDATE public.properties
    SET
      is_archived    = true,
      closed_outcome = 'lost',
      closed_at      = now(),
      closed_reason  = 'Due diligence expired'
    WHERE
      is_archived          = false
      AND status           != 'Under Contract'
      AND status           != 'Draft'
      AND due_diligence_date IS NOT NULL
      AND due_diligence_date < CURRENT_DATE;
  $$
);

-- To verify the job was created:
--   SELECT * FROM cron.job WHERE jobname = 'due-diligence-check';
--
-- To remove the job if needed:
--   SELECT cron.unschedule('due-diligence-check');
