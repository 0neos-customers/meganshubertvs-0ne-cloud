-- Skool Revenue Schema
-- Created: 2026-02-06
-- Purpose: Store MRR and revenue metrics from Skool Settings > Dashboard
--
-- Run via: psql "$DATABASE_URL" -f packages/db/schemas/skool-revenue.sql
-- Or copy/paste into Supabase SQL Editor

-- =============================================================================
-- Daily Revenue Snapshots
-- =============================================================================
-- Stores daily snapshots of revenue metrics for the KPI dashboard
-- One row per group per day (like skool_metrics)

CREATE TABLE IF NOT EXISTS skool_revenue_daily (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_slug TEXT NOT NULL,
    snapshot_date DATE NOT NULL,

    -- Core revenue metrics
    mrr DECIMAL(10,2),                -- Monthly Recurring Revenue
    retention_rate DECIMAL(5,2),      -- Retention percentage (e.g., 100.0)
    paying_members INTEGER,           -- Count of paying subscribers
    churn_count INTEGER,              -- Members churned this period

    -- Calculated metrics (if available from API)
    ltv DECIMAL(10,2),                -- Lifetime Value
    epl DECIMAL(10,2),                -- Earnings Per Lead
    arpu DECIMAL(10,2),               -- Average Revenue Per User

    -- Metadata
    source TEXT DEFAULT 'skool_api',  -- Where data came from
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_revenue_daily UNIQUE(group_slug, snapshot_date)
);

-- Index for efficient date range queries
CREATE INDEX IF NOT EXISTS idx_skool_revenue_daily_date
    ON skool_revenue_daily(group_slug, snapshot_date DESC);

-- =============================================================================
-- Monthly Revenue History (for MRR trend charts)
-- =============================================================================
-- Stores monthly MRR history for trend visualization
-- May be backfilled from historical chart data

CREATE TABLE IF NOT EXISTS skool_revenue_monthly (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_slug TEXT NOT NULL,
    month DATE NOT NULL,              -- First day of month (2026-01-01, 2026-02-01, etc.)

    -- Revenue metrics
    mrr DECIMAL(10,2),                -- MRR for this month
    paying_members INTEGER,           -- Paying members at end of month
    churn_count INTEGER,              -- Members churned during month
    new_subscribers INTEGER,          -- New paying members during month

    -- Calculated
    mrr_change DECIMAL(10,2),         -- Change from previous month
    churn_rate DECIMAL(5,2),          -- Churn rate for the month

    -- Metadata
    source TEXT DEFAULT 'skool_api',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_revenue_monthly UNIQUE(group_slug, month)
);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_skool_revenue_monthly_month
    ON skool_revenue_monthly(group_slug, month DESC);

-- =============================================================================
-- Subscription Events (Optional - if we want granular tracking)
-- =============================================================================
-- Individual subscription events for detailed cohort analysis
-- Only create if the API provides this level of detail

CREATE TABLE IF NOT EXISTS skool_subscription_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_slug TEXT NOT NULL,
    skool_user_id TEXT NOT NULL,      -- The member's Skool ID
    event_type TEXT NOT NULL,         -- 'subscribe', 'cancel', 'resubscribe', 'churn'
    event_date DATE NOT NULL,

    -- Financial data
    amount DECIMAL(10,2),             -- Subscription amount
    currency TEXT DEFAULT 'USD',
    subscription_tier TEXT,           -- 'premium', 'vip', etc.

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_subscription_event UNIQUE(group_slug, skool_user_id, event_type, event_date)
);

-- Indexes for subscription events
CREATE INDEX IF NOT EXISTS idx_subscription_events_date
    ON skool_subscription_events(group_slug, event_date DESC);
CREATE INDEX IF NOT EXISTS idx_subscription_events_user
    ON skool_subscription_events(skool_user_id);

-- =============================================================================
-- Helper Functions
-- =============================================================================

-- Function to get MRR for a specific date
CREATE OR REPLACE FUNCTION get_mrr_for_date(
    p_group_slug TEXT,
    p_date DATE DEFAULT CURRENT_DATE
) RETURNS DECIMAL(10,2) AS $$
DECLARE
    v_mrr DECIMAL(10,2);
BEGIN
    SELECT mrr INTO v_mrr
    FROM skool_revenue_daily
    WHERE group_slug = p_group_slug
      AND snapshot_date <= p_date
    ORDER BY snapshot_date DESC
    LIMIT 1;

    RETURN COALESCE(v_mrr, 0);
END;
$$ LANGUAGE plpgsql;

-- Function to calculate MRR change between two dates
CREATE OR REPLACE FUNCTION get_mrr_change(
    p_group_slug TEXT,
    p_start_date DATE,
    p_end_date DATE
) RETURNS TABLE(
    start_mrr DECIMAL(10,2),
    end_mrr DECIMAL(10,2),
    change_amount DECIMAL(10,2),
    change_percent DECIMAL(5,2)
) AS $$
DECLARE
    v_start_mrr DECIMAL(10,2);
    v_end_mrr DECIMAL(10,2);
BEGIN
    -- Get MRR at start of period
    SELECT mrr INTO v_start_mrr
    FROM skool_revenue_daily
    WHERE group_slug = p_group_slug
      AND snapshot_date <= p_start_date
    ORDER BY snapshot_date DESC
    LIMIT 1;

    -- Get MRR at end of period
    SELECT mrr INTO v_end_mrr
    FROM skool_revenue_daily
    WHERE group_slug = p_group_slug
      AND snapshot_date <= p_end_date
    ORDER BY snapshot_date DESC
    LIMIT 1;

    v_start_mrr := COALESCE(v_start_mrr, 0);
    v_end_mrr := COALESCE(v_end_mrr, 0);

    RETURN QUERY SELECT
        v_start_mrr,
        v_end_mrr,
        v_end_mrr - v_start_mrr,
        CASE
            WHEN v_start_mrr > 0 THEN ((v_end_mrr - v_start_mrr) / v_start_mrr * 100)::DECIMAL(5,2)
            ELSE NULL
        END;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- Initial Data (Optional - seed with current snapshot)
-- =============================================================================
-- Uncomment and update with current data if you want to seed

-- INSERT INTO skool_revenue_daily (group_slug, snapshot_date, mrr, retention_rate, paying_members)
-- VALUES ('my-community', CURRENT_DATE, 503.00, 100.0, 5)
-- ON CONFLICT (group_slug, snapshot_date) DO NOTHING;

-- =============================================================================
-- Verification
-- =============================================================================
-- Check tables were created

SELECT 'skool_revenue_daily' AS table_name, COUNT(*) AS rows FROM skool_revenue_daily
UNION ALL
SELECT 'skool_revenue_monthly', COUNT(*) FROM skool_revenue_monthly
UNION ALL
SELECT 'skool_subscription_events', COUNT(*) FROM skool_subscription_events;

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE skool_revenue_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE skool_revenue_monthly ENABLE ROW LEVEL SECURITY;
ALTER TABLE skool_subscription_events ENABLE ROW LEVEL SECURITY;

-- Allow all for service role (auth handled via Clerk)
CREATE POLICY "Service role full access" ON skool_revenue_daily FOR ALL USING (true);
CREATE POLICY "Service role full access" ON skool_revenue_monthly FOR ALL USING (true);
CREATE POLICY "Service role full access" ON skool_subscription_events FOR ALL USING (true);
