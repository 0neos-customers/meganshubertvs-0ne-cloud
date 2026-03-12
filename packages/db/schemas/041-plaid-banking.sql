-- Plaid Banking Integration
-- Phase 1: Foundation schema for bank account linking and transaction sync

-- Connected bank institutions
CREATE TABLE IF NOT EXISTS plaid_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id TEXT NOT NULL UNIQUE,
  access_token TEXT NOT NULL, -- encrypted with AES-256-CBC
  institution_id TEXT,
  institution_name TEXT,
  transaction_cursor TEXT, -- cursor for /transactions/sync pagination
  status TEXT DEFAULT 'active', -- active, error, login_required
  error_code TEXT,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_plaid_items_status ON plaid_items(status);

-- Individual accounts within an item
CREATE TABLE IF NOT EXISTS plaid_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES plaid_items(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  official_name TEXT,
  type TEXT, -- depository, credit, loan, investment
  subtype TEXT, -- checking, savings, credit card, etc.
  mask TEXT, -- last 4 digits
  current_balance DECIMAL(12,2),
  available_balance DECIMAL(12,2),
  credit_limit DECIMAL(12,2),
  iso_currency_code TEXT DEFAULT 'USD',
  is_hidden BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_plaid_accounts_item_id ON plaid_accounts(item_id);
CREATE INDEX idx_plaid_accounts_type ON plaid_accounts(type);

-- Synced transactions
CREATE TABLE IF NOT EXISTS plaid_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id TEXT NOT NULL UNIQUE,
  account_id UUID NOT NULL REFERENCES plaid_accounts(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL, -- positive = money out, negative = money in (Plaid convention)
  date DATE NOT NULL,
  name TEXT, -- merchant name
  merchant_name TEXT,
  category TEXT[], -- Plaid primary category array
  personal_finance_category_primary TEXT,
  personal_finance_category_detailed TEXT,
  mapped_category TEXT, -- mapped to personal expense category slug
  personal_expense_id UUID REFERENCES personal_expenses(id) ON DELETE SET NULL,
  is_excluded BOOLEAN DEFAULT false,
  is_pending BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_plaid_transactions_account_id ON plaid_transactions(account_id);
CREATE INDEX idx_plaid_transactions_date ON plaid_transactions(date);
CREATE INDEX idx_plaid_transactions_mapped_category ON plaid_transactions(mapped_category);
CREATE INDEX idx_plaid_transactions_excluded ON plaid_transactions(is_excluded);

-- User-editable category mappings (Plaid category -> personal expense category slug)
CREATE TABLE IF NOT EXISTS plaid_category_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plaid_primary TEXT NOT NULL,
  plaid_detailed TEXT, -- optional more specific match
  expense_category_slug TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(plaid_primary, plaid_detailed)
);

-- Seed default category mappings
INSERT INTO plaid_category_mappings (plaid_primary, plaid_detailed, expense_category_slug) VALUES
  ('RENT_AND_UTILITIES', NULL, 'housing'),
  ('FOOD_AND_DRINK', NULL, 'food'),
  ('TRANSPORTATION', NULL, 'transportation'),
  ('GENERAL_SERVICES', 'GENERAL_SERVICES_SUBSCRIPTION', 'subscriptions')
ON CONFLICT (plaid_primary, plaid_detailed) DO NOTHING;

-- RLS policies
ALTER TABLE plaid_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE plaid_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE plaid_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE plaid_category_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON plaid_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON plaid_accounts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON plaid_transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON plaid_category_mappings FOR ALL USING (true) WITH CHECK (true);
