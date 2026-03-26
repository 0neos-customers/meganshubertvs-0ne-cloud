-- =============================================================================
-- SKOOL ONE-OFF POSTS & CAMPAIGNS
-- Date-specific scheduled posts for Offer Cycle campaigns
-- Run: psql "$DATABASE_URL" -f packages/db/schemas/skool-oneoff.sql
-- =============================================================================

-- =============================================================================
-- TABLE: SKOOL_CAMPAIGNS
-- =============================================================================
-- Campaign grouping for organizing one-off posts

CREATE TABLE IF NOT EXISTS skool_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  name TEXT NOT NULL,                    -- e.g., "February 2026 Offer Cycle"
  description TEXT,

  -- Date range (optional, for display/filtering)
  start_date DATE,
  end_date DATE,

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- TABLE: SKOOL_ONEOFF_POSTS
-- =============================================================================
-- One-time scheduled posts (not recurring)

CREATE TABLE IF NOT EXISTS skool_oneoff_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Target group
  group_slug TEXT NOT NULL DEFAULT 'my-community',

  -- Category targeting
  category TEXT NOT NULL,                -- e.g., "The Money Room"
  category_id TEXT,                      -- Skool's internal label ID

  -- Scheduling (specific date/time)
  scheduled_at TIMESTAMPTZ NOT NULL,     -- When to post
  timezone TEXT NOT NULL DEFAULT 'America/New_York',

  -- Content (inline, not from library)
  title TEXT NOT NULL,
  body TEXT NOT NULL,                    -- Full post body (markdown)
  image_url TEXT,                        -- Optional image URL
  video_url TEXT,                        -- Optional video URL

  -- Campaign grouping (optional)
  campaign_id UUID REFERENCES skool_campaigns(id) ON DELETE SET NULL,

  -- Email blast
  send_email_blast BOOLEAN DEFAULT false,

  -- Status: pending, draft, published, posted_manually, failed, cancelled
  status TEXT NOT NULL DEFAULT 'pending',
  published_at TIMESTAMPTZ,              -- When actually posted
  skool_post_id TEXT,                    -- Returned post ID from Skool
  skool_post_url TEXT,                   -- Link to the post
  error_message TEXT,                    -- Error if failed

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- TABLE: SKOOL_GROUP_SETTINGS
-- =============================================================================
-- Group-level settings including email blast tracking

CREATE TABLE IF NOT EXISTS skool_group_settings (
  group_slug TEXT PRIMARY KEY,

  -- Email blast tracking (72-hour cooldown)
  last_email_blast_at TIMESTAMPTZ,

  -- Timestamps
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Initialize default group settings
INSERT INTO skool_group_settings (group_slug)
VALUES ('my-community')
ON CONFLICT (group_slug) DO NOTHING;

-- =============================================================================
-- ADD EMAIL BLAST TRACKING TO EXECUTION LOG
-- =============================================================================

ALTER TABLE skool_post_execution_log
ADD COLUMN IF NOT EXISTS email_blast_sent BOOLEAN DEFAULT false;

-- =============================================================================
-- INDEXES
-- =============================================================================

-- Campaigns
CREATE INDEX IF NOT EXISTS idx_skool_campaigns_active
  ON skool_campaigns(is_active)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_skool_campaigns_dates
  ON skool_campaigns(start_date, end_date);

-- One-off posts
CREATE INDEX IF NOT EXISTS idx_skool_oneoff_posts_due
  ON skool_oneoff_posts(scheduled_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_skool_oneoff_posts_campaign
  ON skool_oneoff_posts(campaign_id);

CREATE INDEX IF NOT EXISTS idx_skool_oneoff_posts_status
  ON skool_oneoff_posts(status);

CREATE INDEX IF NOT EXISTS idx_skool_oneoff_posts_scheduled
  ON skool_oneoff_posts(scheduled_at DESC);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE skool_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE skool_oneoff_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE skool_group_settings ENABLE ROW LEVEL SECURITY;

-- Allow all for service role (auth handled via Clerk)
CREATE POLICY "Service role full access" ON skool_campaigns FOR ALL USING (true);
CREATE POLICY "Service role full access" ON skool_oneoff_posts FOR ALL USING (true);
CREATE POLICY "Service role full access" ON skool_group_settings FOR ALL USING (true);

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Get due one-off posts
CREATE OR REPLACE FUNCTION get_due_oneoff_posts()
RETURNS TABLE (
  id UUID,
  group_slug TEXT,
  category TEXT,
  category_id TEXT,
  title TEXT,
  body TEXT,
  image_url TEXT,
  video_url TEXT,
  send_email_blast BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    op.id,
    op.group_slug,
    op.category,
    op.category_id,
    op.title,
    op.body,
    op.image_url,
    op.video_url,
    op.send_email_blast
  FROM skool_oneoff_posts op
  WHERE op.status = 'pending'
    AND op.scheduled_at <= NOW();
END;
$$ LANGUAGE plpgsql;

-- Check if email blast is available (72-hour cooldown)
CREATE OR REPLACE FUNCTION is_email_blast_available(
  p_group_slug TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  last_blast TIMESTAMPTZ;
BEGIN
  SELECT last_email_blast_at INTO last_blast
  FROM skool_group_settings
  WHERE group_slug = p_group_slug;

  IF last_blast IS NULL THEN
    RETURN true;
  END IF;

  RETURN (NOW() - last_blast) > INTERVAL '72 hours';
END;
$$ LANGUAGE plpgsql;

-- Get hours until next email blast available
CREATE OR REPLACE FUNCTION hours_until_email_blast_available(
  p_group_slug TEXT
)
RETURNS NUMERIC AS $$
DECLARE
  last_blast TIMESTAMPTZ;
  cooldown_end TIMESTAMPTZ;
BEGIN
  SELECT last_email_blast_at INTO last_blast
  FROM skool_group_settings
  WHERE group_slug = p_group_slug;

  IF last_blast IS NULL THEN
    RETURN 0;
  END IF;

  cooldown_end := last_blast + INTERVAL '72 hours';

  IF NOW() >= cooldown_end THEN
    RETURN 0;
  END IF;

  RETURN EXTRACT(EPOCH FROM (cooldown_end - NOW())) / 3600;
END;
$$ LANGUAGE plpgsql;

-- Record email blast usage
CREATE OR REPLACE FUNCTION record_email_blast(
  p_group_slug TEXT
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO skool_group_settings (group_slug, last_email_blast_at, updated_at)
  VALUES (p_group_slug, NOW(), NOW())
  ON CONFLICT (group_slug) DO UPDATE
  SET last_email_blast_at = NOW(), updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Get campaign stats
CREATE OR REPLACE FUNCTION get_campaign_stats(p_campaign_id UUID)
RETURNS TABLE (
  total_posts INTEGER,
  pending_posts INTEGER,
  published_posts INTEGER,
  failed_posts INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::INTEGER as total_posts,
    COUNT(*) FILTER (WHERE status = 'pending')::INTEGER as pending_posts,
    COUNT(*) FILTER (WHERE status = 'published' OR status = 'posted_manually')::INTEGER as published_posts,
    COUNT(*) FILTER (WHERE status = 'failed')::INTEGER as failed_posts
  FROM skool_oneoff_posts
  WHERE campaign_id = p_campaign_id;
END;
$$ LANGUAGE plpgsql;
