-- Track unique visitors, visit counts, and last visit time per user.

CREATE TABLE IF NOT EXISTS public.user_activity (
  user_id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  visit_count     INTEGER     NOT NULL DEFAULT 1,
  first_visited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_visited_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_activity ENABLE ROW LEVEL SECURITY;

-- Each user can read/write their own row (needed for the upsert RPC)
CREATE POLICY "users can manage own activity"
  ON public.user_activity
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admins can read all rows for the analytics panel
CREATE POLICY "admins can read all activity"
  ON public.user_activity
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
        AND (profiles.is_admin = true OR profiles.role = 'admin')
    )
  );

-- Atomic upsert: increments visit_count and updates last_visited_at
CREATE OR REPLACE FUNCTION public.record_visit()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_activity (user_id, visit_count, first_visited_at, last_visited_at)
  VALUES (auth.uid(), 1, NOW(), NOW())
  ON CONFLICT (user_id)
  DO UPDATE SET
    visit_count      = public.user_activity.visit_count + 1,
    last_visited_at  = NOW();
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_visit() TO authenticated;
