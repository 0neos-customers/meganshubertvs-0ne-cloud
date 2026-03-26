-- =============================================================================
-- SKOOL POST SCHEDULER
-- Automated scheduling and posting system for Skool communities
-- Run: psql "$DATABASE_URL" -f packages/db/schemas/skool-scheduler.sql
-- =============================================================================

-- =============================================================================
-- TABLE 1: SKOOL_SCHEDULED_POSTS
-- =============================================================================
-- Schedule slots (day/time combinations for auto-posting)

CREATE TABLE IF NOT EXISTS skool_scheduled_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Target group
  group_slug TEXT NOT NULL DEFAULT 'my-community',

  -- Category targeting
  category TEXT NOT NULL,           -- e.g., "The Money Room"
  category_id TEXT,                 -- Skool's internal label ID (fetched later)

  -- Schedule timing
  day_of_week INTEGER NOT NULL,     -- 0=Sunday, 1=Monday, etc.
  time TEXT NOT NULL,               -- "HH:MM" format (24hr)

  -- Status
  is_active BOOLEAN DEFAULT true,
  last_run_at TIMESTAMPTZ,          -- Prevents duplicate runs

  -- Admin note
  note TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- TABLE 2: SKOOL_POST_LIBRARY
-- =============================================================================
-- Content variations for rotation

CREATE TABLE IF NOT EXISTS skool_post_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Targeting (must match scheduler)
  category TEXT NOT NULL,
  day_of_week INTEGER NOT NULL,
  time TEXT NOT NULL,

  -- Content
  title TEXT NOT NULL,
  body TEXT NOT NULL,               -- Full post body (markdown)
  image_url TEXT,                   -- Optional image URL
  video_url TEXT,                   -- Optional video URL

  -- Status
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMPTZ,         -- For oldest-first selection
  use_count INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- TABLE 3: SKOOL_POST_EXECUTION_LOG
-- =============================================================================
-- Audit trail of all posts made

CREATE TABLE IF NOT EXISTS skool_post_execution_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  scheduler_id UUID REFERENCES skool_scheduled_posts(id),
  post_library_id UUID REFERENCES skool_post_library(id),

  -- Execution details
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL,             -- 'success', 'failed', 'skipped'

  -- Skool response
  skool_post_id TEXT,               -- Returned post ID from Skool
  skool_post_url TEXT,              -- Link to the post

  -- Error handling
  error_message TEXT
);

-- =============================================================================
-- INDEXES
-- =============================================================================

-- skool_scheduled_posts indexes
CREATE INDEX IF NOT EXISTS idx_skool_scheduled_posts_category
  ON skool_scheduled_posts(category);

CREATE INDEX IF NOT EXISTS idx_skool_scheduled_posts_day_time
  ON skool_scheduled_posts(day_of_week, time);

CREATE INDEX IF NOT EXISTS idx_skool_scheduled_posts_active
  ON skool_scheduled_posts(is_active)
  WHERE is_active = true;

-- skool_post_library indexes
CREATE INDEX IF NOT EXISTS idx_skool_post_library_category
  ON skool_post_library(category);

CREATE INDEX IF NOT EXISTS idx_skool_post_library_day_time
  ON skool_post_library(day_of_week, time);

CREATE INDEX IF NOT EXISTS idx_skool_post_library_targeting
  ON skool_post_library(category, day_of_week, time);

CREATE INDEX IF NOT EXISTS idx_skool_post_library_last_used
  ON skool_post_library(last_used_at NULLS FIRST);

CREATE INDEX IF NOT EXISTS idx_skool_post_library_active
  ON skool_post_library(is_active)
  WHERE is_active = true;

-- skool_post_execution_log indexes
CREATE INDEX IF NOT EXISTS idx_skool_post_execution_log_executed_at
  ON skool_post_execution_log(executed_at DESC);

CREATE INDEX IF NOT EXISTS idx_skool_post_execution_log_scheduler_id
  ON skool_post_execution_log(scheduler_id);

CREATE INDEX IF NOT EXISTS idx_skool_post_execution_log_status
  ON skool_post_execution_log(status);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE skool_scheduled_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE skool_post_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE skool_post_execution_log ENABLE ROW LEVEL SECURITY;

-- Allow all for service role (auth handled via Clerk)
CREATE POLICY "Service role full access" ON skool_scheduled_posts FOR ALL USING (true);
CREATE POLICY "Service role full access" ON skool_post_library FOR ALL USING (true);
CREATE POLICY "Service role full access" ON skool_post_execution_log FOR ALL USING (true);

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Get the next post content for a given schedule slot
-- Returns the oldest-used active post matching the targeting criteria
CREATE OR REPLACE FUNCTION get_next_post_for_schedule(
  p_category TEXT,
  p_day_of_week INTEGER,
  p_time TEXT
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  body TEXT,
  image_url TEXT,
  video_url TEXT,
  use_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pl.id,
    pl.title,
    pl.body,
    pl.image_url,
    pl.video_url,
    pl.use_count
  FROM skool_post_library pl
  WHERE pl.category = p_category
    AND pl.day_of_week = p_day_of_week
    AND pl.time = p_time
    AND pl.is_active = true
  ORDER BY pl.last_used_at NULLS FIRST, pl.use_count ASC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Mark a post as used (update last_used_at and increment use_count)
CREATE OR REPLACE FUNCTION mark_post_used(p_post_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE skool_post_library
  SET
    last_used_at = NOW(),
    use_count = use_count + 1,
    updated_at = NOW()
  WHERE id = p_post_id;
END;
$$ LANGUAGE plpgsql;

-- Get scheduled posts due to run
-- Returns active schedules for a given day/time that haven't run recently
CREATE OR REPLACE FUNCTION get_due_schedules(
  p_day_of_week INTEGER,
  p_time TEXT,
  p_min_interval_hours INTEGER DEFAULT 23
)
RETURNS TABLE (
  id UUID,
  group_slug TEXT,
  category TEXT,
  category_id TEXT,
  note TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sp.id,
    sp.group_slug,
    sp.category,
    sp.category_id,
    sp.note
  FROM skool_scheduled_posts sp
  WHERE sp.day_of_week = p_day_of_week
    AND sp.time = p_time
    AND sp.is_active = true
    AND (
      sp.last_run_at IS NULL
      OR sp.last_run_at < NOW() - (p_min_interval_hours || ' hours')::INTERVAL
    );
END;
$$ LANGUAGE plpgsql;

-- Get execution stats for a scheduler
CREATE OR REPLACE FUNCTION get_scheduler_stats(p_scheduler_id UUID, p_days INTEGER DEFAULT 30)
RETURNS TABLE (
  total_executions INTEGER,
  successful_executions INTEGER,
  failed_executions INTEGER,
  skipped_executions INTEGER,
  last_execution_at TIMESTAMPTZ,
  last_status TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::INTEGER as total_executions,
    COUNT(*) FILTER (WHERE status = 'success')::INTEGER as successful_executions,
    COUNT(*) FILTER (WHERE status = 'failed')::INTEGER as failed_executions,
    COUNT(*) FILTER (WHERE status = 'skipped')::INTEGER as skipped_executions,
    MAX(executed_at) as last_execution_at,
    (SELECT el.status FROM skool_post_execution_log el
     WHERE el.scheduler_id = p_scheduler_id
     ORDER BY el.executed_at DESC LIMIT 1) as last_status
  FROM skool_post_execution_log
  WHERE scheduler_id = p_scheduler_id
    AND executed_at >= NOW() - (p_days || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql;
