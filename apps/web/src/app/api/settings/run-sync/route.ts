/**
 * Run Sync API
 *
 * Manually trigger a sync job from the browser.
 * This endpoint validates the request and triggers the appropriate cron endpoint.
 *
 * POST /api/settings/run-sync
 *   Body: { sync_type: string }
 *   - Validates sync_type against known crons
 *   - Triggers the cron endpoint in the background
 *   - Returns immediately with success status
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import type { SyncType } from '@/lib/sync-log'
import {
  CRON_REGISTRY,
  getCronBySyncType,
} from '@/features/settings/lib/cron-registry'

export const dynamic = 'force-dynamic'

// Valid sync types
const VALID_SYNC_TYPES: SyncType[] = CRON_REGISTRY.map((c) => c.syncType)

interface RunSyncRequest {
  sync_type: string
}

export async function POST(request: NextRequest) {
  try {
    // Check for user authentication (browser request)
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized - Please log in' },
        { status: 401 }
      )
    }

    // Parse request body
    let body: RunSyncRequest
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      )
    }

    const { sync_type } = body

    // Validate sync_type
    if (!sync_type) {
      return NextResponse.json(
        { error: 'sync_type is required' },
        { status: 400 }
      )
    }

    if (!VALID_SYNC_TYPES.includes(sync_type as SyncType)) {
      return NextResponse.json(
        {
          error: `Invalid sync_type: ${sync_type}`,
          validTypes: VALID_SYNC_TYPES,
        },
        { status: 400 }
      )
    }

    // Get the cron configuration
    const cron = getCronBySyncType(sync_type as SyncType)
    if (!cron) {
      return NextResponse.json(
        { error: `No cron configuration found for sync_type: ${sync_type}` },
        { status: 400 }
      )
    }

    // Build the full URL for the cron endpoint
    const baseUrl = getBaseUrl(request)
    const cronUrl = `${baseUrl}${cron.endpoint}`

    // Trigger the cron endpoint in the background
    // We use fetch with no-wait pattern by not awaiting the response
    // The cron will run and log to sync_activity_log independently
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret) {
      console.error('[run-sync] CRON_SECRET not configured')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    // Fire and forget - trigger the cron
    // We don't await this so the response returns immediately
    triggerCronInBackground(cronUrl, cronSecret)

    return NextResponse.json({
      success: true,
      message: `Sync ${cron.name} triggered`,
      syncType: sync_type,
      cronId: cron.id,
    })
  } catch (error) {
    console.error('[run-sync API] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    )
  }
}

/**
 * Get the base URL from the request
 */
function getBaseUrl(request: NextRequest): string {
  // Try to use the request URL first
  const url = new URL(request.url)

  // In production, use the host header
  const host = request.headers.get('host')
  if (host) {
    const protocol = request.headers.get('x-forwarded-proto') || 'https'
    return `${protocol}://${host}`
  }

  // Fallback to request URL origin
  return url.origin
}

/**
 * Trigger a cron endpoint in the background
 * This function intentionally does not await the fetch
 */
function triggerCronInBackground(cronUrl: string, cronSecret: string): void {
  // Using .catch to handle any errors silently (they'll be logged by the cron)
  fetch(cronUrl, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${cronSecret}`,
    },
  }).catch((error) => {
    console.error('[run-sync] Error triggering cron:', error)
  })
}
