-- =============================================
-- SKOOL INTEGRATION TABLES (Cloud-First)
-- =============================================
-- All data synced from Skool API to Supabase
-- No extension needed - runs on server with SKOOL_COOKIES
-- Run this in Supabase SQL Editor after kpi.sql

-- =============================================
-- SKOOL MEMBERS
-- Primary source of truth for Skool member data
-- =============================================
CREATE TABLE IF NOT EXISTS skool_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Skool identifiers
  skool_user_id TEXT UNIQUE NOT NULL,
  skool_username TEXT,

  -- Profile data
  display_name TEXT,
  email TEXT,
  bio TEXT,
  location TEXT,
  profile_image TEXT,
  social_links JSONB DEFAULT '{}',

  -- Group membership
  group_slug TEXT NOT NULL DEFAULT 'my-community',
  member_since TIMESTAMPTZ,
  last_online TIMESTAMPTZ,
  attribution_source TEXT,
  level INTEGER DEFAULT 1,
  points INTEGER DEFAULT 0,

  -- GHL matching
  ghl_contact_id TEXT,
  matched_at TIMESTAMPTZ,
  match_method TEXT,  -- 'email', 'phone', 'name', 'manual'

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- SKOOL CONVERSATIONS (DMs)
-- Synced from Skool chat-channels API
-- =============================================
CREATE TABLE IF NOT EXISTS skool_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skool_channel_id TEXT UNIQUE NOT NULL,

  -- Participant (the other person)
  participant_skool_id TEXT,
  participant_name TEXT,
  participant_username TEXT,
  participant_image TEXT,

  -- Status
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  unread_count INTEGER DEFAULT 0,
  is_archived BOOLEAN DEFAULT FALSE,

  -- GHL sync status
  ghl_conversation_id TEXT,
  ghl_synced_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- SKOOL MESSAGES
-- Synced from Skool messages API
-- =============================================
CREATE TABLE IF NOT EXISTS skool_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES skool_conversations(id) ON DELETE CASCADE,
  skool_message_id TEXT UNIQUE NOT NULL,

  -- Message content
  sender_skool_id TEXT NOT NULL,
  content TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL,

  -- Direction
  is_outbound BOOLEAN NOT NULL,  -- true = Jimmy sent it

  -- Sync status
  ghl_synced_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- HAND-RAISER CAMPAIGNS
-- Auto-DM on post comments
-- =============================================
CREATE TABLE IF NOT EXISTS skool_hand_raiser_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Target
  post_url TEXT NOT NULL,
  skool_post_id TEXT,

  -- Trigger
  keyword_filter TEXT,  -- NULL = any comment triggers

  -- Action
  dm_template TEXT NOT NULL,
  ghl_tag TEXT,  -- Tag to apply in GHL

  -- Status
  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- HAND-RAISER SENT LOG
-- Track who we've already DM'd (prevent duplicates)
-- =============================================
CREATE TABLE IF NOT EXISTS skool_hand_raiser_sent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES skool_hand_raiser_campaigns(id) ON DELETE CASCADE,
  skool_user_id TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(campaign_id, skool_user_id)
);

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX IF NOT EXISTS idx_skool_members_username ON skool_members(skool_username);
CREATE INDEX IF NOT EXISTS idx_skool_members_ghl ON skool_members(ghl_contact_id);
CREATE INDEX IF NOT EXISTS idx_skool_members_email ON skool_members(email);
CREATE INDEX IF NOT EXISTS idx_skool_members_group ON skool_members(group_slug);
CREATE INDEX IF NOT EXISTS idx_skool_conversations_channel ON skool_conversations(skool_channel_id);
CREATE INDEX IF NOT EXISTS idx_skool_conversations_last ON skool_conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_skool_messages_conversation ON skool_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_skool_messages_sent ON skool_messages(sent_at DESC);

-- =============================================
-- ADD SKOOL REFERENCE TO CONTACTS TABLE
-- Light touch - just the link for matching
-- =============================================
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS skool_user_id TEXT;
CREATE INDEX IF NOT EXISTS idx_contacts_skool ON contacts(skool_user_id);

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================
ALTER TABLE skool_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE skool_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE skool_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE skool_hand_raiser_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE skool_hand_raiser_sent ENABLE ROW LEVEL SECURITY;

-- Allow full access (we handle auth via Clerk)
CREATE POLICY "Service role full access" ON skool_members FOR ALL USING (true);
CREATE POLICY "Service role full access" ON skool_conversations FOR ALL USING (true);
CREATE POLICY "Service role full access" ON skool_messages FOR ALL USING (true);
CREATE POLICY "Service role full access" ON skool_hand_raiser_campaigns FOR ALL USING (true);
CREATE POLICY "Service role full access" ON skool_hand_raiser_sent FOR ALL USING (true);

-- =============================================
-- UPDATED_AT TRIGGERS
-- =============================================
CREATE TRIGGER update_skool_members_updated_at
  BEFORE UPDATE ON skool_members
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_skool_conversations_updated_at
  BEFORE UPDATE ON skool_conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_skool_hand_raiser_campaigns_updated_at
  BEFORE UPDATE ON skool_hand_raiser_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
