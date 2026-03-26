-- =============================================
-- SKOOL METRICS TABLE (Time-series KPIs)
-- =============================================
-- Run this in Supabase SQL Editor after skool.sql
-- Stores daily snapshots of Skool group metrics

-- =============================================
-- ADD EMAIL TO CONTACTS (for GHL↔Skool matching)
-- =============================================
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_name TEXT;
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);

-- =============================================
-- SKOOL METRICS (Daily KPI snapshots)
-- =============================================
CREATE TABLE IF NOT EXISTS skool_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Which group
  group_slug TEXT NOT NULL DEFAULT 'my-community',

  -- Snapshot date (one record per day per group)
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Member metrics (from admin-metrics API)
  members_total INTEGER,
  members_active INTEGER,  -- Active in last 30 days
  community_activity DECIMAL(5,2),  -- Activity score 0-100

  -- Discovery metrics (from discovery API)
  category TEXT,  -- e.g., 'Real Estate Investing'
  category_rank INTEGER,  -- Rank within category

  -- Conversion metrics (from analytics API)
  about_page_visits INTEGER,  -- Daily about page visits
  conversion_rate DECIMAL(5,2),  -- About page → member conversion %

  -- Personal metrics (scraped from profile)
  personal_posts INTEGER,
  personal_comments INTEGER,
  personal_points INTEGER,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- One snapshot per group per day
  UNIQUE(group_slug, snapshot_date)
);

-- Indexes for querying
CREATE INDEX IF NOT EXISTS idx_skool_metrics_date ON skool_metrics(snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_skool_metrics_group ON skool_metrics(group_slug);

-- RLS
ALTER TABLE skool_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON skool_metrics FOR ALL USING (true);
