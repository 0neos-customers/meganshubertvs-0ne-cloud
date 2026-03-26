-- =============================================
-- SKOOL ABOUT PAGE DAILY ANALYTICS
-- =============================================
-- Stores daily about page visitor and conversion data
-- Populated from Skool analytics API, backfilled historically

CREATE TABLE IF NOT EXISTS skool_about_page_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Which group
  group_slug TEXT NOT NULL DEFAULT 'my-community',

  -- Date of the data point
  date DATE NOT NULL,

  -- Metrics for this day
  visitors INTEGER NOT NULL DEFAULT 0,         -- Page visits that day
  conversion_rate DECIMAL(5,2),                -- Conversion rate % (0-100)

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- One record per group per day
  UNIQUE(group_slug, date)
);

-- Indexes for fast querying
CREATE INDEX IF NOT EXISTS idx_skool_about_daily_date ON skool_about_page_daily(date DESC);
CREATE INDEX IF NOT EXISTS idx_skool_about_daily_group ON skool_about_page_daily(group_slug);
CREATE INDEX IF NOT EXISTS idx_skool_about_daily_group_date ON skool_about_page_daily(group_slug, date DESC);

-- RLS
ALTER TABLE skool_about_page_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON skool_about_page_daily FOR ALL USING (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_skool_about_daily_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS skool_about_daily_updated_at ON skool_about_page_daily;
CREATE TRIGGER skool_about_daily_updated_at
  BEFORE UPDATE ON skool_about_page_daily
  FOR EACH ROW
  EXECUTE FUNCTION update_skool_about_daily_updated_at();
