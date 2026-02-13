/**
 * Send Pending DMs Cron Endpoint
 *
 * Sends pending outbound DMs via Skool API.
 * Runs every 5 minutes via Vercel Cron.
 *
 * Manual invocation:
 * curl -H "Authorization: Bearer $CRON_SECRET" "http://localhost:3000/api/cron/send-pending-dms"
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  sendPendingMessages,
  getEnabledSyncConfigs,
  type SendPendingResult,
} from '@/features/dm-sync'

export const maxDuration = 300 // 5 minutes max for send operations

/**
 * GET /api/cron/send-pending-dms
 *
 * Sends pending outbound DMs via Skool for all enabled users.
 *
 * Query params:
 * - user_id: Optional - process only for specific user
 */
export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const specificUserId = searchParams.get('user_id')

  const startTime = Date.now()
  console.log('[send-pending-dms] Starting outbound send')

  try {
    // Get enabled sync configs
    const configs = await getEnabledSyncConfigs()

    if (configs.length === 0) {
      console.log('[send-pending-dms] No enabled sync configs found')
      return NextResponse.json({
        success: true,
        message: 'No enabled sync configs',
        duration: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
      })
    }

    // Filter to specific user if requested
    const targetConfigs = specificUserId
      ? configs.filter((c) => c.user_id === specificUserId)
      : configs

    if (targetConfigs.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No matching sync configs',
        duration: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
      })
    }

    console.log(`[send-pending-dms] Processing ${targetConfigs.length} users`)

    // Process each user's pending messages
    const results: Array<{
      userId: string
      result: SendPendingResult
    }> = []

    for (const config of targetConfigs) {
      try {
        console.log(`[send-pending-dms] Processing user: ${config.user_id}`)
        const result = await sendPendingMessages(config.user_id)
        results.push({
          userId: config.user_id,
          result,
        })
      } catch (error) {
        console.error(
          `[send-pending-dms] Error processing user ${config.user_id}:`,
          error instanceof Error ? error.message : error
        )
        results.push({
          userId: config.user_id,
          result: {
            sent: 0,
            failed: 1,
            errorDetails: [
              {
                error: error instanceof Error ? error.message : String(error),
              },
            ],
          },
        })
      }
    }

    // Aggregate results
    const totals = results.reduce(
      (acc, r) => ({
        sent: acc.sent + r.result.sent,
        failed: acc.failed + r.result.failed,
      }),
      { sent: 0, failed: 0 }
    )

    const duration = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log(
      `[send-pending-dms] Completed in ${duration}s: sent=${totals.sent}, failed=${totals.failed}`
    )

    return NextResponse.json({
      success: totals.failed === 0,
      duration: `${duration}s`,
      totals,
      users: results.map((r) => ({
        userId: r.userId,
        sent: r.result.sent,
        failed: r.result.failed,
      })),
    })
  } catch (error) {
    console.error('[send-pending-dms] Fatal error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
      },
      { status: 500 }
    )
  }
}
