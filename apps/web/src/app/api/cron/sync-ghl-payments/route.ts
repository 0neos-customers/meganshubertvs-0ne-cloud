/**
 * GHL Payments Sync Cron Job
 *
 * Syncs payment transactions from GoHighLevel to our database.
 * Used for tracking one-time revenue (setup fees, success fees, etc.)
 *
 * Usage:
 * - Daily sync: curl -H "Authorization: Bearer $CRON_SECRET" "http://localhost:3000/api/cron/sync-ghl-payments"
 * - Full sync: curl -H "Authorization: Bearer $CRON_SECRET" "http://localhost:3000/api/cron/sync-ghl-payments?full=true"
 * - Stats only: curl -H "Authorization: Bearer $CRON_SECRET" "http://localhost:3000/api/cron/sync-ghl-payments?stats=true"
 */

import { NextResponse } from 'next/server'
import { createServerClient } from '@0ne/db/server'
import { GHLClient, type GHLTransaction } from '@/features/kpi/lib/ghl-client'
import { SyncLogger } from '@/lib/sync-log'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes for full sync

// Verify cron secret
function verifyCronSecret(request: Request): boolean {
  const authHeader = request.headers.get('Authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    console.warn('[sync-ghl-payments] CRON_SECRET not set')
    return false
  }

  return authHeader === `Bearer ${cronSecret}`
}

export async function GET(request: Request) {
  // Verify authorization
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const fullSync = searchParams.get('full') === 'true'
  const statsOnly = searchParams.get('stats') === 'true'

  const supabase = createServerClient()

  try {
    // If stats only, return current data summary
    if (statsOnly) {
      const stats = await getTransactionStats(supabase)
      return NextResponse.json({
        message: 'GHL payment sync stats',
        stats,
      })
    }

    // Initialize GHL client
    const ghl = new GHLClient()

    // Determine date range
    let startDate: string | undefined
    let endDate: string | undefined

    if (fullSync) {
      // Full sync: get all transactions from 2024 onwards
      startDate = '2024-01-01'
      console.log('[sync-ghl-payments] Starting FULL sync from 2024-01-01')
    } else {
      // Incremental sync: last 7 days
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      startDate = weekAgo.toISOString().split('T')[0]
      console.log(`[sync-ghl-payments] Starting incremental sync from ${startDate}`)
    }

    // Start sync logging (unified sync_activity_log)
    const syncLogger = new SyncLogger('ghl_payments')
    await syncLogger.start({ mode: fullSync ? 'full' : 'incremental', startDate })

    // Fetch transactions from GHL
    console.log('[sync-ghl-payments] Fetching transactions from GHL...')
    const transactions = await ghl.getAllTransactions({
      startDate,
      endDate,
      status: 'succeeded', // Only sync successful payments
    })

    console.log(`[sync-ghl-payments] Found ${transactions.length} transactions`)

    // Upsert transactions to database
    let synced = 0
    let skipped = 0
    const errors: string[] = []

    for (const txn of transactions) {
      try {
        const record = mapTransactionToRecord(txn)

        const { error } = await supabase
          .from('ghl_transactions')
          .upsert(record, {
            onConflict: 'ghl_transaction_id',
            ignoreDuplicates: false,
          })

        if (error) {
          console.error(`[sync-ghl-payments] Error upserting ${txn._id}:`, error)
          errors.push(`${txn._id}: ${error.message}`)
          skipped++
        } else {
          synced++
        }
      } catch (err) {
        console.error(`[sync-ghl-payments] Error processing ${txn._id}:`, err)
        errors.push(`${txn._id}: ${String(err)}`)
        skipped++
      }
    }

    console.log(`[sync-ghl-payments] Synced ${synced} transactions, skipped ${skipped}`)

    // Complete sync logging
    await syncLogger.complete(synced, { skipped, errors: errors.length })

    // Get updated stats
    const stats = await getTransactionStats(supabase)

    return NextResponse.json({
      message: 'GHL payment sync completed',
      synced,
      skipped,
      errors: errors.length > 0 ? errors.slice(0, 5) : undefined,
      stats,
    })
  } catch (error) {
    console.error('[sync-ghl-payments] Sync failed:', error)
    // Note: syncLogger is only defined after statsOnly check, so we check if it exists
    // In the catch block we don't have access to syncLogger if error happened before it was created
    return NextResponse.json(
      { error: 'Sync failed', details: String(error) },
      { status: 500 }
    )
  }
}

/**
 * Map GHL transaction to database record
 */
function mapTransactionToRecord(txn: GHLTransaction) {
  return {
    ghl_transaction_id: txn._id,
    ghl_contact_id: txn.contactId || null,
    ghl_invoice_id: txn.meta?.invoiceId || null,
    ghl_subscription_id: txn.subscriptionId || null,
    contact_name: txn.contactName || null,
    contact_email: txn.contactEmail || null,
    amount: txn.amount, // GHL stores in dollars (not cents)
    currency: txn.currency || 'USD',
    status: txn.status,
    entity_type: txn.entityType || null,
    entity_source_type: txn.entitySourceType || null,
    entity_source_name: txn.entitySourceName || null,
    payment_method: txn.meta?.paymentMethod || null,
    invoice_number: txn.meta?.invoiceNumber || null,
    is_live_mode: txn.liveMode,
    transaction_date: txn.createdAt,
    updated_at: new Date().toISOString(),
    synced_at: new Date().toISOString(),
  }
}

/**
 * Get transaction stats from database
 */
async function getTransactionStats(supabase: ReturnType<typeof createServerClient>) {
  // Total transactions
  const { count: totalCount } = await supabase
    .from('ghl_transactions')
    .select('*', { count: 'exact', head: true })

  // Total revenue (succeeded only)
  const { data: revenueData } = await supabase
    .from('ghl_transactions')
    .select('amount')
    .eq('status', 'succeeded')

  const totalRevenue = revenueData?.reduce((sum, r) => sum + Number(r.amount), 0) || 0

  // This month
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const { data: thisMonthData } = await supabase
    .from('ghl_transactions')
    .select('amount')
    .eq('status', 'succeeded')
    .gte('transaction_date', startOfMonth.toISOString())

  const thisMonthRevenue = thisMonthData?.reduce((sum, r) => sum + Number(r.amount), 0) || 0

  // Last sync (from unified sync_activity_log)
  const { data: lastSync } = await supabase
    .from('sync_activity_log')
    .select('completed_at, records_synced')
    .eq('sync_type', 'ghl_payments')
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(1)
    .single()

  return {
    totalTransactions: totalCount || 0,
    totalRevenue,
    thisMonthRevenue,
    lastSync: lastSync?.completed_at || null,
    lastSyncRecords: lastSync?.records_synced || 0,
  }
}
