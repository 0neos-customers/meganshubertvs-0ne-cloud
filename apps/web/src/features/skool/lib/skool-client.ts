/**
 * Skool API Client
 *
 * Server-side client for interacting with Skool's API.
 * Uses cookie-based authentication stored in SKOOL_COOKIES env var.
 */

import { SKOOL_API, SKOOL_ENDPOINTS, SYNC_CONFIG } from './config'
import { getSkoolCookiesForDefaultStaff } from '@/lib/skool-cookie-resolver'
import type {
  SkoolApiMember,
  SkoolApiChatChannel,
  SkoolApiMessage,
  SkoolApiGroup,
} from '../types'

// =============================================================================
// CLIENT CLASS
// =============================================================================

export class SkoolClient {
  private cookies: string
  private buildId: string | null = null

  constructor(cookies?: string) {
    this.cookies = cookies || process.env.SKOOL_COOKIES || ''
    if (!this.cookies) {
      throw new Error('SKOOL_COOKIES environment variable is not set')
    }
  }

  // ===========================================================================
  // PRIVATE HELPERS
  // ===========================================================================

  /**
   * Make authenticated request to Skool API
   */
  private async fetch<T>(
    url: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(url, {
      ...options,
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        cookie: this.cookies,
        origin: 'https://www.skool.com',
        referer: 'https://www.skool.com/',
        ...options.headers,
      },
    })

    if (!response.ok) {
      throw new Error(`Skool API error: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  /**
   * Get Next.js build ID from Skool group page (required for data routes)
   */
  private async getBuildId(groupSlug: string = 'fruitful'): Promise<string> {
    if (this.buildId) {
      return this.buildId
    }

    console.log(`[SkoolClient] Fetching buildId from /${groupSlug}...`)

    const response = await fetch(`${SKOOL_API.WEB_URL}/${groupSlug}`, {
      method: 'GET',
      headers: {
        accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        cookie: this.cookies,
        'user-agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch /${groupSlug}: ${response.status} ${response.statusText}`)
    }

    const html = await response.text()
    const match = html.match(/"buildId":"([^"]+)"/)

    if (!match?.[1]) {
      throw new Error(`Could not extract Skool buildId from /${groupSlug} page`)
    }

    this.buildId = match[1]
    console.log(`[SkoolClient] Got buildId: ${this.buildId}`)
    return this.buildId
  }

  /**
   * Delay between requests to respect rate limits
   */
  private async delay(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, SYNC_CONFIG.REQUEST_DELAY_MS))
  }

  // ===========================================================================
  // GROUPS
  // ===========================================================================

  /**
   * Get all groups the user is a member of
   */
  async getGroups(): Promise<SkoolApiGroup[]> {
    const response = await this.fetch<{ groups: SkoolApiGroup[] }>(
      `${SKOOL_API.BASE_URL}${SKOOL_ENDPOINTS.SELF_GROUPS}`
    )
    return response.groups
  }

  // ===========================================================================
  // MEMBERS
  // ===========================================================================

  /**
   * Get all members of a group
   *
   * Uses Next.js data route which requires buildId.
   * Handles pagination automatically.
   */
  async getMembers(
    groupSlug: string,
    options: { tab?: 'active' | 'cancelling' | 'churned' | 'banned' } = {}
  ): Promise<SkoolApiMember[]> {
    const { tab = 'active' } = options
    const buildId = await this.getBuildId(groupSlug)
    const allMembers: SkoolApiMember[] = []
    let page = 1

    while (page <= SYNC_CONFIG.MEMBERS_MAX_PAGES) {
      const url = new URL(
        `${SKOOL_API.WEB_URL}${SKOOL_ENDPOINTS.MEMBERS_DATA(buildId, groupSlug)}`
      )
      url.searchParams.set('t', tab)
      url.searchParams.set('p', String(page)) // Skool uses 'p' for page, not 'page'
      url.searchParams.set('group', groupSlug)

      console.log(`[SkoolClient] Fetching members page ${page}: ${url.toString()}`)

      const response = await this.fetch<{
        pageProps: {
          // Members can be in renderData.members or directly in pageProps.members
          renderData?: {
            members?: SkoolApiMember[]
            totalFilteredMembers?: number
          }
          members?: SkoolApiMember[]
          itemsPerPage?: number
          pagination?: {
            total: number
            page: number
            pageSize: number
          }
        }
      }>(url.toString())

      // Get members from renderData (newer API) or pageProps (older API)
      const members = response.pageProps.renderData?.members || response.pageProps.members || []
      allMembers.push(...members)

      // Check if we've fetched all members
      const totalMembers = response.pageProps.renderData?.totalFilteredMembers
      const itemsPerPage = response.pageProps.itemsPerPage || 30 // Skool default is 30 per page

      // Log progress
      console.log(
        `[SkoolClient] Page ${page}: ${members.length} members (total so far: ${allMembers.length}/${totalMembers || '?'})`
      )

      // Stop if we got fewer than expected (last page) or we've got all
      if (members.length === 0 || members.length < itemsPerPage) {
        break
      }
      if (totalMembers && allMembers.length >= totalMembers) {
        break
      }

      page++
      await this.delay()
    }

    return allMembers
  }

  /**
   * Get member count by tab without fetching all data
   */
  async getMemberCounts(groupSlug: string): Promise<{
    active: number
    cancelling: number
    churned: number
    banned: number
  }> {
    const buildId = await this.getBuildId(groupSlug)

    // Fetch first page of each tab to get totals
    const tabs = ['active', 'cancelling', 'churned', 'banned'] as const
    const counts: Record<string, number> = {}

    for (const tab of tabs) {
      const url = new URL(
        `${SKOOL_API.WEB_URL}${SKOOL_ENDPOINTS.MEMBERS_DATA(buildId, groupSlug)}`
      )
      url.searchParams.set('t', tab)
      url.searchParams.set('p', '1')
      url.searchParams.set('group', groupSlug)

      try {
        const response = await this.fetch<{
          pageProps: {
            pagination?: { total: number }
          }
        }>(url.toString())

        counts[tab] = response.pageProps.pagination?.total || 0
      } catch {
        counts[tab] = 0
      }

      await this.delay()
    }

    return {
      active: counts.active || 0,
      cancelling: counts.cancelling || 0,
      churned: counts.churned || 0,
      banned: counts.banned || 0,
    }
  }

  /**
   * Get a single member's profile by username
   * Useful for getting admin-invited member emails (not in survey)
   */
  async getMemberProfile(
    username: string,
    groupSlug: string = 'fruitful'
  ): Promise<SkoolApiMember | null> {
    const buildId = await this.getBuildId(groupSlug)

    // Remove @ prefix if present
    const cleanUsername = username.replace(/^@/, '')

    const url = `${SKOOL_API.WEB_URL}${SKOOL_ENDPOINTS.USER_PROFILE_DATA(buildId, cleanUsername)}`
    console.log(`[SkoolClient] Fetching profile: ${url}`)

    try {
      const response = await this.fetch<{
        pageProps: {
          user?: SkoolApiMember
          // Sometimes the data is nested differently
          renderData?: {
            user?: SkoolApiMember
          }
        }
      }>(url)

      const user = response.pageProps.user || response.pageProps.renderData?.user
      if (user) {
        console.log(`[SkoolClient] Got profile for ${cleanUsername}`)
        return user
      }

      console.log(`[SkoolClient] No user found in profile response`)
      return null
    } catch (error) {
      console.error(`[SkoolClient] Error fetching profile for ${cleanUsername}:`, error)
      return null
    }
  }

  /**
   * Get admin count for a group
   * Uses ?admin=true filter to fetch admin-only members
   */
  async getAdminCount(groupSlug: string): Promise<number> {
    const buildId = await this.getBuildId(groupSlug)

    const url = new URL(
      `${SKOOL_API.WEB_URL}${SKOOL_ENDPOINTS.MEMBERS_DATA(buildId, groupSlug)}`
    )
    url.searchParams.set('admin', 'true')
    url.searchParams.set('p', '1')
    url.searchParams.set('group', groupSlug)

    console.log(`[SkoolClient] Fetching admin count: ${url.toString()}`)

    try {
      const response = await this.fetch<{
        pageProps: {
          renderData?: {
            totalFilteredMembers?: number
            members?: SkoolApiMember[]
          }
          pagination?: { total: number }
        }
      }>(url.toString())

      // Get total from pagination or count members on first page
      const total =
        response.pageProps.pagination?.total ||
        response.pageProps.renderData?.totalFilteredMembers ||
        response.pageProps.renderData?.members?.length ||
        0

      console.log(`[SkoolClient] Admin count: ${total}`)
      return total
    } catch (error) {
      console.error(`[SkoolClient] Error fetching admin count:`, error)
      return 0
    }
  }

  // ===========================================================================
  // CHAT / DMS
  // ===========================================================================

  /**
   * Get all DM chat channels
   */
  async getChatChannels(options: {
    limit?: number
    offset?: number
    unreadOnly?: boolean
  } = {}): Promise<SkoolApiChatChannel[]> {
    const { limit = SYNC_CONFIG.DM_CHANNELS_LIMIT, offset = 0, unreadOnly = false } = options

    const url = new URL(`${SKOOL_API.BASE_URL}${SKOOL_ENDPOINTS.SELF_CHAT_CHANNELS}`)
    url.searchParams.set('limit', String(limit))
    url.searchParams.set('offset', String(offset))
    url.searchParams.set('last', 'true')
    url.searchParams.set('unread-only', String(unreadOnly))

    const response = await this.fetch<{ channels: SkoolApiChatChannel[] }>(url.toString())
    return response.channels
  }

  /**
   * Get all DM channels with pagination
   */
  async getAllChatChannels(): Promise<SkoolApiChatChannel[]> {
    const allChannels: SkoolApiChatChannel[] = []
    let offset = 0

    while (true) {
      const channels = await this.getChatChannels({
        limit: SYNC_CONFIG.DM_CHANNELS_LIMIT,
        offset,
      })

      allChannels.push(...channels)

      if (channels.length < SYNC_CONFIG.DM_CHANNELS_LIMIT) {
        break
      }

      offset += SYNC_CONFIG.DM_CHANNELS_LIMIT
      await this.delay()
    }

    return allChannels
  }

  /**
   * Get messages in a DM channel
   */
  async getMessages(
    channelId: string,
    options: { afterMessageId?: string } = {}
  ): Promise<SkoolApiMessage[]> {
    const { afterMessageId = '1' } = options

    const url = new URL(
      `${SKOOL_API.BASE_URL}${SKOOL_ENDPOINTS.CHANNEL_MESSAGES(channelId)}`
    )
    url.searchParams.set('after', afterMessageId)

    const response = await this.fetch<{ messages: SkoolApiMessage[] }>(url.toString())
    return response.messages
  }

  /**
   * Send a DM message
   */
  async sendMessage(channelId: string, content: string): Promise<SkoolApiMessage> {
    const response = await this.fetch<{ message: SkoolApiMessage }>(
      `${SKOOL_API.BASE_URL}${SKOOL_ENDPOINTS.CHANNEL_MESSAGES(channelId)}`,
      {
        method: 'POST',
        body: JSON.stringify({ content }),
      }
    )
    return response.message
  }

  // ===========================================================================
  // ANALYTICS & REVENUE
  // ===========================================================================

  /**
   * Get analytics overview including MRR, members, conversion, retention
   * This is the primary endpoint for revenue data
   *
   * Returns:
   * - num_members: Total members
   * - mrr: Monthly Recurring Revenue in CENTS (divide by 100 for dollars)
   * - conversion: About page conversion rate (0-1)
   * - retention: Member retention rate (0-1, where 1 = 100%)
   */
  async getAnalyticsOverview(groupId: string): Promise<{
    numMembers: number
    mrrCents: number
    conversion: number
    retention: number
  }> {
    const url = `${SKOOL_API.BASE_URL}${SKOOL_ENDPOINTS.ANALYTICS_OVERVIEW(groupId)}`
    console.log(`[SkoolClient] Fetching analytics overview: ${url}`)

    const response = await this.fetch<{
      num_members?: number
      mrr?: number
      conversion?: number
      retention?: number
    }>(url)

    return {
      numMembers: response.num_members || 0,
      mrrCents: response.mrr || 0, // API returns cents
      conversion: response.conversion || 0,
      retention: response.retention || 0,
    }
  }

  /**
   * Get membership products and free member count
   * Useful for calculating paid vs free members
   */
  async getMembershipProducts(groupId: string): Promise<{
    freeMembers: number
    products: unknown[] | null
  }> {
    const url = `${SKOOL_API.BASE_URL}/groups/${groupId}/membership-products?model=subscription`
    console.log(`[SkoolClient] Fetching membership products: ${url}`)

    const response = await this.fetch<{
      free_members?: number
      membership_products?: unknown[] | null
    }>(url)

    return {
      freeMembers: response.free_members || 0,
      products: response.membership_products || null,
    }
  }

  /**
   * Get MRR chart data (monthly breakdown)
   * Returns: churn, downgrade, existing, new, reactivation, upgrade, mrr
   */
  async getMrrChart(groupId: string): Promise<
    Array<{
      month: string
      churn: number
      downgrade: number
      existing: number
      new: number
      reactivation: number
      upgrade: number
      mrr: number
    }>
  > {
    const url = `${SKOOL_API.BASE_URL}${SKOOL_ENDPOINTS.ANALYTICS_CHART(groupId, 'mrr')}`
    console.log(`[SkoolClient] Fetching MRR chart: ${url}`)

    const response = await this.fetch<{
      data?: Array<{
        month: string
        churn: number
        downgrade: number
        existing: number
        new: number
        reactivation: number
        upgrade: number
        mrr: number
      }>
    }>(url)

    return response.data || []
  }

  // ===========================================================================
  // RAW API ACCESS
  // ===========================================================================

  /**
   * Make authenticated fetch request and return raw Response
   * Use this for admin/analytics endpoints that need custom handling
   */
  async fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
    return fetch(url, {
      ...options,
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        cookie: this.cookies,
        origin: 'https://www.skool.com',
        referer: 'https://www.skool.com/',
        ...options.headers,
      },
    })
  }

  // ===========================================================================
  // UTILITY METHODS
  // ===========================================================================

  /**
   * Test the connection and authentication
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      await this.getGroups()
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Clear cached buildId (call if pages change)
   */
  clearCache(): void {
    this.buildId = null
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let clientInstance: SkoolClient | null = null

/**
 * Get the shared Skool client instance (sync - uses env var only)
 */
export function getSkoolClient(): SkoolClient {
  if (!clientInstance) {
    clientInstance = new SkoolClient()
  }
  return clientInstance
}

/**
 * Get a Skool client with cookies resolved from DB first, then env var fallback.
 * Preferred over getSkoolClient() since it doesn't require redeploys for fresh cookies.
 */
export async function getSkoolClientAsync(): Promise<SkoolClient> {
  const cookies = await getSkoolCookiesForDefaultStaff()
  if (cookies) {
    return new SkoolClient(cookies)
  }
  return getSkoolClient()
}

/**
 * Create a new Skool client with specific cookies
 */
export function createSkoolClient(cookies: string): SkoolClient {
  return new SkoolClient(cookies)
}
