/**
 * KPI Dashboard Configuration
 *
 * Customize the funnel stages and tag mappings below for your business.
 *
 * Funnel (8 stages, 2 paths):
 * Member → Hand Raiser → [Qualified Premium | Qualified VIP] → Offer Made → Offer Seen → [Premium | VIP]
 */

// =============================================================================
// FUNNEL STAGES
// =============================================================================

/**
 * Defines the order of funnel stages from highest value to lowest.
 * Used when determining a contact's current stage (highest wins).
 *
 * Note: qualified_vip and qualified_premium are mutually exclusive paths
 * based on credit status self-qualification.
 */
export const FUNNEL_STAGE_ORDER = [
  'premium',
  'vip',
  'offer_seen',
  'offer_made_vip',
  'offer_made_premium',
  'qualified_vip',
  'qualified_premium',
  'hand_raiser',
  'member',
] as const

export type FunnelStage = (typeof FUNNEL_STAGE_ORDER)[number]

// =============================================================================
// TAG MAPPINGS - CONFIRMED 2026-02-05
// =============================================================================

/**
 * Maps GHL tags to funnel stages.
 * Tags are case-insensitive when matching.
 * Contact is assigned to their HIGHEST funnel stage.
 */
export const TAG_MAPPINGS: Record<FunnelStage, string[]> = {
  // Premium tier clients (paid - needs credit repair path)
  premium: ['skool - premium tier'],

  // VIP tier clients (paid - good credit path)
  vip: ['skool - vip tier'],

  // Viewed offer doc (tracked with GHL trigger links)
  offer_seen: ['skool - offer viewed'],

  // Sent VIP offer doc
  offer_made_vip: ['skool - vip offer made'],

  // Sent Premium offer doc
  offer_made_premium: ['skool - premium offer made'],

  // Self-qualified via form - good credit (VIP path)
  qualified_vip: ['skool - vip qualified'],

  // Self-qualified via form - needs credit repair (Premium path)
  qualified_premium: ['skool - vip not qualified'],

  // Raised hand / showed interest
  hand_raiser: ['skool - hand raised'],

  // Base entry point - Skool registration
  member: ['skool - completed registration'],
}

/**
 * Tags indicating credit status
 * Note: These map to the qualified stages
 */
export const CREDIT_STATUS_TAGS = {
  good: ['skool - vip qualified'],
  bad: ['skool - vip not qualified'],
}

/**
 * Tags to EXCLUDE from reporting (churned, lost, refunded)
 */
export const EXCLUDE_TAGS = [
  'business funding - not interested',
  'business funding - refunded',
  'skool - fully churned',
  'skool - churned',
]

// =============================================================================
// CUSTOM FIELD KEYS
// =============================================================================

/**
 * GHL custom field keys for contact-level metrics.
 * These should match your GHL custom field configurations.
 */
export const CUSTOM_FIELD_KEYS = {
  // Age/Duration fields
  leadAge: 'contact.lead_age',
  clientAge: 'contact.days_as_client',
  daysToFunding: 'contact.days_to_funding_client',

  // EPL (Earnings Per Lead) by cohort day
  eplDay1: 'contact.lead_value_day_1',
  eplDay7: 'contact.lead_value_day_7',
  eplDay14: 'contact.lead_value_day_14',
  eplDay35: 'contact.lead_value_day_35',
  eplDay65: 'contact.lead_value_day_65',
  eplDay95: 'contact.lead_value_day_95',
  eplDay185: 'contact.lead_value_day_185',
  eplDay370: 'contact.lead_value_day_370',

  // LTV (Lifetime Value) by cohort day
  ltvDay1: 'contact.client_value_day_1',
  ltvDay7: 'contact.client_value_day_7',
  ltvDay14: 'contact.client_value_day_14',
  ltvDay35: 'contact.client_value_day_35',
  ltvDay65: 'contact.client_value_day_65',
  ltvDay95: 'contact.client_value_day_95',
  ltvDay185: 'contact.client_value_day_185',
  ltvDay370: 'contact.client_value_day_370',
  ltvTotal: 'contact.client_value',
}

// =============================================================================
// COMPANY-LEVEL KPI KEYS (Location Custom Values)
// =============================================================================

/**
 * GHL location-level custom values for aggregate KPIs.
 * These are pulled from the location settings, not individual contacts.
 *
 * Note: We're calculating EPL/LTV fresh from transactions instead of using
 * these pre-computed values. This enables time-range filtering and offer versioning.
 * Keeping these for reference/comparison.
 */
export const COMPANY_KPI_KEYS = {
  // Totals
  totalLeads: 'custom_values.total_leads',
  totalClients: 'custom_values.total_clients',
  totalFundingClients: 'custom_values.total_funding_clients',
  totalRevenue: 'custom_values.total_revenue',
  totalLeadRevenue: 'custom_values.total_lead_revenue',
  totalTransactions: 'custom_values.total_transactions',
  totalReferrals: 'custom_values.total_referrals',
  totalReferralRevenue: 'custom_values.total_referral_revenue',

  // EPL by cohort day (company averages - for reference only)
  eplDay1: 'custom_values.earnings_per_lead_day_001',
  eplDay7: 'custom_values.earnings_per_lead_day_007',
  eplDay14: 'custom_values.earnings_per_lead_day_014',
  eplDay35: 'custom_values.earnings_per_lead_day_035',
  eplDay65: 'custom_values.earnings_per_lead_day_065',
  eplDay95: 'custom_values.earnings_per_lead_day_095',
  eplDay185: 'custom_values.earnings_per_lead_day_185',
  eplDay370: 'custom_values.earnings_per_lead_day_370',
  eplLifetime: 'custom_values.earnings_per_lead',

  // Total leads by cohort day
  leadsDay1: 'custom_values.total_leads_day_001',
  leadsDay7: 'custom_values.total_leads_day_007',
  leadsDay14: 'custom_values.total_leads_day_014',
  leadsDay35: 'custom_values.total_leads_day_035',
  leadsDay65: 'custom_values.total_leads_day_065',
  leadsDay95: 'custom_values.total_leads_day_095',
  leadsDay185: 'custom_values.total_leads_day_185',
  leadsDay370: 'custom_values.total_leads_day_370',
}

// =============================================================================
// COHORT CONFIGURATION
// =============================================================================

/**
 * Cohort day milestones for EPL/LTV tracking
 */
export const COHORT_DAYS = [1, 7, 14, 35, 65, 95, 185, 370] as const

export type CohortDay = (typeof COHORT_DAYS)[number]

// =============================================================================
// DISPLAY LABELS
// =============================================================================

export const STAGE_LABELS: Record<FunnelStage, string> = {
  member: 'Member',
  hand_raiser: 'Hand Raiser',
  qualified_premium: 'Qualified (Premium)',
  qualified_vip: 'Qualified (VIP)',
  offer_made_premium: 'Offer Made (Premium)',
  offer_made_vip: 'Offer Made (VIP)',
  offer_seen: 'Offer Seen',
  vip: 'VIP',
  premium: 'Premium',
}

export const STAGE_COLORS: Record<FunnelStage, string> = {
  member: '#94a3b8', // slate-400
  hand_raiser: '#60a5fa', // blue-400
  qualified_premium: '#f472b6', // pink-400 (credit repair path)
  qualified_vip: '#a78bfa', // violet-400 (good credit path)
  offer_made_premium: '#ec4899', // pink-500 (Premium path)
  offer_made_vip: '#8b5cf6', // violet-500 (VIP path)
  offer_seen: '#fb923c', // orange-400
  vip: '#FF692D', // primary orange (top of VIP path)
  premium: '#22c55e', // green-500 (top of Premium path)
}

// =============================================================================
// FUNNEL VISUALIZATION HELPERS
// =============================================================================

/**
 * Groups stages for funnel visualization
 * Shows the two credit paths side-by-side after qualification
 */
export const FUNNEL_GROUPS = {
  acquisition: ['member', 'hand_raiser'],
  qualification: ['qualified_premium', 'qualified_vip'],
  offer: ['offer_made_premium', 'offer_made_vip', 'offer_seen'],
  client: ['premium', 'vip'],
} as const

/**
 * Path mapping - which stages lead to which outcomes
 */
export const FUNNEL_PATHS = {
  vip_path: ['member', 'hand_raiser', 'qualified_vip', 'offer_made_vip', 'offer_seen', 'vip'],
  premium_path: ['member', 'hand_raiser', 'qualified_premium', 'offer_made_premium', 'offer_seen', 'premium'],
} as const
