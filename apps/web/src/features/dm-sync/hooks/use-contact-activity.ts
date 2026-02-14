'use client'

import useSWR from 'swr'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

/**
 * Contact activity data returned from the API
 */
export interface ContactActivity {
  id: string
  skool_user_id: string
  skool_username: string | null
  skool_display_name: string | null
  ghl_contact_id: string
  match_method: 'skool_id' | 'email' | 'name' | 'synthetic' | null
  created_at: string
  stats: {
    inbound_count: number
    outbound_count: number
    synced_count: number
    pending_count: number
    failed_count: number
    last_activity_at: string | null
  }
  ghl_location_id: string
  skool_community_slug: string
}

/**
 * Summary statistics for contacts
 */
export interface ContactActivitySummary {
  total_contacts: number
  total_messages: number
  contacts_with_pending: number
  contacts_with_failed: number
}

/**
 * Options for the useContactActivity hook
 */
export interface UseContactActivityOptions {
  search?: string
  matchMethod?: string
  status?: string
  limit?: number
  offset?: number
}

/**
 * Return type for the useContactActivity hook
 */
export interface UseContactActivityReturn {
  contacts: ContactActivity[]
  summary: ContactActivitySummary
  isLoading: boolean
  error: Error | undefined
  refresh: () => void
}

/**
 * Hook for fetching contact sync activity
 */
export function useContactActivity(
  options: UseContactActivityOptions = {}
): UseContactActivityReturn {
  const params = new URLSearchParams()

  if (options.search) params.set('search', options.search)
  if (options.matchMethod && options.matchMethod !== 'all') {
    params.set('match_method', options.matchMethod)
  }
  if (options.status && options.status !== 'all') {
    params.set('status', options.status)
  }
  if (options.limit) params.set('limit', String(options.limit))
  if (options.offset) params.set('offset', String(options.offset))

  const url = `/api/dm-sync/contacts${params.toString() ? '?' + params.toString() : ''}`

  const { data, error, mutate } = useSWR<{
    contacts: ContactActivity[]
    summary: ContactActivitySummary
  }>(url, fetcher, {
    refreshInterval: 30000, // Auto-refresh every 30 seconds
  })

  return {
    contacts: data?.contacts || [],
    summary: data?.summary || {
      total_contacts: 0,
      total_messages: 0,
      contacts_with_pending: 0,
      contacts_with_failed: 0,
    },
    isLoading: !error && !data,
    error,
    refresh: mutate,
  }
}
