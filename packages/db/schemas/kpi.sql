-- ============================================
-- KPI Dashboard Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- CONTACTS (Current state of each person)
-- ============================================
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ghl_contact_id TEXT UNIQUE,
  skool_user_id TEXT,

  -- Current funnel position (see config.ts FUNNEL_STAGE_ORDER)
  -- Stages: member → hand_raiser → [qualified_premium | qualified_vip] → offer_made → offer_seen → [premium | vip]
  current_stage TEXT DEFAULT 'member',

  -- ALL stages this contact has tags for (contacts accumulate tags as they progress)
  -- Used for accurate counts since contacts can be in multiple stages simultaneously
  stages TEXT[] DEFAULT '{}',
  credit_status TEXT DEFAULT 'unknown', -- 'good', 'bad', 'unknown'

  -- Age tracking (mirrors GHL)
  lead_age INTEGER DEFAULT 0,
  client_age INTEGER DEFAULT 0,

  -- Attribution
  source TEXT, -- 'meta_ads', 'youtube', 'organic', 'referral'
  campaign TEXT, -- 'workshop_jan_2026', 'evergreen'
  hand_raiser_type TEXT, -- 'workshop', 'help', 'general'

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Funnel timestamps (for velocity calculations)
  became_member_at TIMESTAMPTZ,
  became_hand_raiser_at TIMESTAMPTZ,
  became_qualified_at TIMESTAMPTZ, -- Either path: qualified_vip or qualified_premium
  became_offer_made_at TIMESTAMPTZ,
  became_offer_seen_at TIMESTAMPTZ,
  became_client_at TIMESTAMPTZ -- Either path: vip or premium
);

CREATE INDEX idx_contacts_stage ON contacts(current_stage);
CREATE INDEX idx_contacts_stages ON contacts USING GIN(stages); -- Array index for "contains" queries
CREATE INDEX idx_contacts_source ON contacts(source);
CREATE INDEX idx_contacts_campaign ON contacts(campaign);

-- ============================================
-- EVENTS (Immutable event log - time series)
-- ============================================
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,

  event_type TEXT NOT NULL, -- 'tag_added', 'stage_changed', 'payment', 'funded'
  event_data JSONB, -- Flexible payload

  -- Attribution (denormalized for query speed)
  source TEXT,
  campaign TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_events_contact ON events(contact_id);
CREATE INDEX idx_events_type ON events(event_type);
CREATE INDEX idx_events_created ON events(created_at);
CREATE INDEX idx_events_campaign ON events(campaign);

-- ============================================
-- COHORT_SNAPSHOTS (EPL, LTV at Day N)
-- ============================================
CREATE TABLE cohort_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,

  snapshot_type TEXT NOT NULL, -- 'epl', 'ltv', 'revenue'
  snapshot_day INTEGER NOT NULL, -- 1, 7, 14, 35, 65, 95, 185, 370
  value DECIMAL(10,2),

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(contact_id, snapshot_type, snapshot_day)
);

CREATE INDEX idx_cohort_contact ON cohort_snapshots(contact_id);
CREATE INDEX idx_cohort_type_day ON cohort_snapshots(snapshot_type, snapshot_day);

-- ============================================
-- CAMPAIGNS (Workshop, evergreen, etc.)
-- ============================================
CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, -- 'My Workshop Jan 2026'
  slug TEXT UNIQUE NOT NULL, -- 'workshop_jan_2026'
  type TEXT, -- 'workshop', 'evergreen', 'challenge'

  start_date DATE,
  end_date DATE,

  -- Budget/targets
  ad_budget DECIMAL(10,2),
  revenue_target DECIMAL(10,2),

  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- AD_METRICS (Daily ad performance)
-- ============================================
CREATE TABLE ad_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  platform TEXT DEFAULT 'meta', -- 'meta', 'youtube', 'google'
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  campaign_meta_id TEXT,
  campaign_name TEXT,
  adset_id TEXT,
  adset_name TEXT,
  ad_id TEXT,
  ad_name TEXT,

  -- Spend
  spend DECIMAL(10,2),

  -- Volume
  impressions INTEGER,
  clicks INTEGER,
  reach INTEGER,
  frequency DECIMAL(10,4),
  unique_clicks INTEGER,
  link_clicks INTEGER,
  landing_page_views INTEGER,
  completed_registrations INTEGER,
  conversions INTEGER,
  cost_per_conversion DECIMAL(10,2),
  roas DECIMAL(10,4),

  -- Calculated (stored for speed)
  cpm DECIMAL(10,2), -- Cost per 1000 impressions
  cpc DECIMAL(10,2), -- Cost per click
  ctr DECIMAL(10,4), -- Click-through rate

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(date, platform, adset_id, ad_id)
);

CREATE INDEX idx_ad_metrics_date ON ad_metrics(date);
CREATE INDEX idx_ad_metrics_campaign ON ad_metrics(campaign_id);
CREATE INDEX idx_ad_metrics_campaign_meta ON ad_metrics(campaign_meta_id);
CREATE INDEX idx_ad_metrics_adset ON ad_metrics(adset_id);
CREATE INDEX idx_ad_metrics_ad ON ad_metrics(ad_id);

-- ============================================
-- META_ACCOUNT_DAILY (Non-additive metrics)
-- ============================================
CREATE TABLE meta_account_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  platform TEXT DEFAULT 'meta',

  -- Non-additive metrics (account-level)
  reach INTEGER,
  frequency DECIMAL(10,4),
  unique_clicks INTEGER,

  -- Supporting totals (account-level)
  impressions INTEGER,
  clicks INTEGER,
  spend DECIMAL(10,2),

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(date, platform)
);

CREATE INDEX idx_meta_account_daily_date ON meta_account_daily(date);

-- ============================================
-- EXPENSES (Manual + recurring)
-- ============================================
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, -- 'Video Editor', 'GHL Subscription'
  category TEXT, -- 'labor', 'software', 'marketing', 'operations'

  -- Amount
  amount DECIMAL(10,2) NOT NULL,
  frequency TEXT DEFAULT 'one_time', -- 'one_time', 'monthly', 'annual'

  -- Date range (for recurring)
  start_date DATE,
  end_date DATE, -- NULL = ongoing

  -- For one-time
  expense_date DATE,

  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- REVENUE (Income tracking)
-- ============================================
CREATE TABLE revenue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL, -- NULL if not tied to specific contact

  amount DECIMAL(10,2) NOT NULL,
  type TEXT, -- 'vip_setup', 'success_fee', 'premium', 'other'
  description TEXT,

  source TEXT DEFAULT 'ghl', -- 'ghl', 'stripe', 'relay', 'manual'
  transaction_date DATE NOT NULL,

  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_revenue_date ON revenue(transaction_date);
CREATE INDEX idx_revenue_type ON revenue(type);

-- ============================================
-- DAILY_AGGREGATES (Pre-computed for dashboard speed)
-- ============================================
CREATE TABLE daily_aggregates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL, -- NULL = all campaigns
  source TEXT, -- NULL = all sources

  -- Funnel counts (matches config.ts stages)
  new_members INTEGER DEFAULT 0,
  new_hand_raisers INTEGER DEFAULT 0,
  new_qualified_vip INTEGER DEFAULT 0,
  new_qualified_premium INTEGER DEFAULT 0,
  new_offer_made INTEGER DEFAULT 0,
  new_offer_seen INTEGER DEFAULT 0,
  new_vip INTEGER DEFAULT 0,
  new_premium INTEGER DEFAULT 0,

  -- Revenue
  total_revenue DECIMAL(10,2) DEFAULT 0,
  vip_revenue DECIMAL(10,2) DEFAULT 0,
  premium_revenue DECIMAL(10,2) DEFAULT 0,
  success_fee_revenue DECIMAL(10,2) DEFAULT 0,

  -- Costs
  ad_spend DECIMAL(10,2) DEFAULT 0,
  expenses DECIMAL(10,2) DEFAULT 0,

  -- Funding
  total_funded_amount DECIMAL(12,2) DEFAULT 0,
  funded_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(date, campaign_id, source)
);

CREATE INDEX idx_daily_agg_date ON daily_aggregates(date);

-- ============================================
-- VIEWS
-- ============================================

-- Funnel conversion rates (configurable date range via query)
-- Note: SECURITY INVOKER ensures RLS policies are respected
DROP VIEW IF EXISTS funnel_conversions;
CREATE VIEW funnel_conversions
WITH (security_invoker = true) AS
SELECT
  campaign_id,
  SUM(new_members) as members,
  SUM(new_hand_raisers) as hand_raisers,
  SUM(new_qualified_vip) + SUM(new_qualified_premium) as qualified,
  SUM(new_qualified_vip) as qualified_vip,
  SUM(new_qualified_premium) as qualified_premium,
  SUM(new_offer_made) as offer_made,
  SUM(new_offer_seen) as offer_seen,
  SUM(new_vip) as vip,
  SUM(new_premium) as premium,
  SUM(new_vip) + SUM(new_premium) as clients,
  SUM(ad_spend) as total_spend,
  SUM(total_revenue) as total_revenue,

  -- Conversion rates
  CASE WHEN SUM(new_members) > 0
    THEN ROUND(SUM(new_hand_raisers)::numeric / SUM(new_members) * 100, 2)
    ELSE 0 END as member_to_hr_rate,
  CASE WHEN SUM(new_hand_raisers) > 0
    THEN ROUND((SUM(new_qualified_vip) + SUM(new_qualified_premium))::numeric / SUM(new_hand_raisers) * 100, 2)
    ELSE 0 END as hr_to_qualified_rate,
  CASE WHEN (SUM(new_qualified_vip) + SUM(new_qualified_premium)) > 0
    THEN ROUND(SUM(new_offer_made)::numeric / (SUM(new_qualified_vip) + SUM(new_qualified_premium)) * 100, 2)
    ELSE 0 END as qualified_to_offer_rate,
  CASE WHEN SUM(new_offer_made) > 0
    THEN ROUND((SUM(new_vip) + SUM(new_premium))::numeric / SUM(new_offer_made) * 100, 2)
    ELSE 0 END as offer_to_client_rate,

  -- Unit economics
  CASE WHEN SUM(new_members) > 0
    THEN ROUND(SUM(ad_spend) / SUM(new_members), 2)
    ELSE 0 END as cost_per_member,
  CASE WHEN SUM(new_hand_raisers) > 0
    THEN ROUND(SUM(ad_spend) / SUM(new_hand_raisers), 2)
    ELSE 0 END as cost_per_hand_raiser,
  CASE WHEN (SUM(new_vip) + SUM(new_premium)) > 0
    THEN ROUND(SUM(ad_spend) / (SUM(new_vip) + SUM(new_premium)), 2)
    ELSE 0 END as cac

FROM daily_aggregates
GROUP BY campaign_id;

-- Cohort EPL by day
-- Note: SECURITY INVOKER ensures RLS policies are respected
DROP VIEW IF EXISTS epl_by_cohort_day;
CREATE VIEW epl_by_cohort_day
WITH (security_invoker = true) AS
SELECT
  snapshot_day,
  AVG(value) as avg_epl,
  COUNT(*) as sample_size
FROM cohort_snapshots
WHERE snapshot_type = 'epl'
GROUP BY snapshot_day
ORDER BY snapshot_day;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Enable RLS on all tables
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE cohort_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_aggregates ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_account_daily ENABLE ROW LEVEL SECURITY;

-- Create policies (allow all for service role, we handle auth via Clerk)
CREATE POLICY "Service role full access" ON contacts FOR ALL USING (true);
CREATE POLICY "Service role full access" ON events FOR ALL USING (true);
CREATE POLICY "Service role full access" ON cohort_snapshots FOR ALL USING (true);
CREATE POLICY "Service role full access" ON campaigns FOR ALL USING (true);
CREATE POLICY "Service role full access" ON ad_metrics FOR ALL USING (true);
CREATE POLICY "Service role full access" ON expenses FOR ALL USING (true);
CREATE POLICY "Service role full access" ON revenue FOR ALL USING (true);
CREATE POLICY "Service role full access" ON daily_aggregates FOR ALL USING (true);
CREATE POLICY "Service role full access" ON meta_account_daily FOR ALL USING (true);

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
