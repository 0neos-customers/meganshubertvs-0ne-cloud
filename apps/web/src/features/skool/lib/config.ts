/**
 * Skool Integration Configuration
 *
 * Central configuration for Skool sync and integration.
 */

// =============================================================================
// API CONFIGURATION
// =============================================================================

/**
 * Skool API base URLs
 */
export const SKOOL_API = {
  /** Backend API for DMs, groups, etc. */
  BASE_URL: 'https://api2.skool.com',

  /** Frontend for Next.js data routes (member lists) */
  WEB_URL: 'https://www.skool.com',

  /** Static assets (profile images) */
  ASSETS_URL: 'https://assets.skool.com',
} as const

/**
 * API endpoints (relative to BASE_URL or WEB_URL)
 */
export const SKOOL_ENDPOINTS = {
  // Self endpoints (current user)
  SELF_GROUPS: '/self/groups',
  SELF_CHAT_CHANNELS: '/self/chat-channels',

  // Channel endpoints (DMs)
  CHANNEL_MESSAGES: (channelId: string) => `/channels/${channelId}/messages`,

  // Group endpoints
  GROUP_MEMBERS: (groupId: string) => `/groups/${groupId}/members`,

  // Analytics endpoints (for MRR, revenue, metrics)
  ANALYTICS_OVERVIEW: (groupId: string) => `/groups/${groupId}/analytics-overview`,
  ANALYTICS_CHART: (groupId: string, chart: string) => `/groups/${groupId}/analytics?chart=${chart}`,
  ADMIN_METRICS: (groupId: string, amt: string, range: string = '30d') =>
    `/groups/${groupId}/admin-metrics?range=${range}&amt=${amt}`,

  // Next.js data routes (require buildId)
  MEMBERS_DATA: (buildId: string, groupSlug: string) =>
    `/_next/data/${buildId}/${groupSlug}/-/members.json`,

  // User profile data route (for getting individual member details including email)
  USER_PROFILE_DATA: (buildId: string, username: string) =>
    `/_next/data/${buildId}/@${username}.json`,
} as const

// =============================================================================
// GROUP CONFIGURATION
// =============================================================================

/**
 * Configuration for each Skool group to sync
 */
export interface SkoolGroupConfig {
  /** Unique identifier for the group */
  slug: string

  /** Display name for UI */
  name: string

  /** Whether to sync this group's members */
  syncMembers: boolean

  /** Whether to sync DMs for this group */
  syncDMs: boolean

  /** Whether to run hand-raiser automation */
  enableHandRaiser: boolean
}

/**
 * Configured Skool groups
 *
 * Configure your community here - add more groups as needed.
 */
export const SKOOL_GROUPS: SkoolGroupConfig[] = [
  {
    slug: 'my-community',
    name: 'My Community',
    syncMembers: true,
    syncDMs: true,
    enableHandRaiser: true,
  },
]

/**
 * Get config for a specific group
 */
export function getGroupConfig(slug: string): SkoolGroupConfig | undefined {
  return SKOOL_GROUPS.find((g) => g.slug === slug)
}

/**
 * Default group for operations (first configured group)
 */
export const DEFAULT_GROUP = SKOOL_GROUPS[0]!

// =============================================================================
// SYNC CONFIGURATION
// =============================================================================

/**
 * Sync timing configuration
 */
export const SYNC_CONFIG = {
  /** How many members to fetch per page */
  MEMBERS_PAGE_SIZE: 100,

  /** Maximum pages to fetch (safety limit) - Skool returns 30 per page */
  MEMBERS_MAX_PAGES: 100, // Supports up to 3,000 members

  /** How many DM channels to fetch per request */
  DM_CHANNELS_LIMIT: 20,

  /** Delay between API requests (ms) - respect rate limits */
  REQUEST_DELAY_MS: 200,

  /** How often to sync members (cron schedule) */
  MEMBER_SYNC_SCHEDULE: '0 3 * * *', // Daily at 3 AM

  /** How often to sync DMs (cron schedule) */
  DM_SYNC_SCHEDULE: '0 * * * *', // Every hour
} as const

// =============================================================================
// MATCHING CONFIGURATION
// =============================================================================

/**
 * Configuration for matching Skool members to GHL contacts
 */
export const MATCHING_CONFIG = {
  /** Minimum similarity score for name matching (0-1) */
  NAME_MATCH_THRESHOLD: 0.8,

  /** Fields to use for matching (in priority order) */
  MATCH_FIELDS: ['email', 'name'] as const,
} as const

// =============================================================================
// STAFF SKOOL USER ID
// =============================================================================

/**
 * Staff Skool user ID (set via NEXT_PUBLIC_STAFF_SKOOL_ID env var)
 * Used to determine outbound vs inbound messages
 */
export const STAFF_SKOOL_USER_ID = process.env.NEXT_PUBLIC_STAFF_SKOOL_ID || ''
