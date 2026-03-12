import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@0ne/db/server'
import { syncTransactions } from '@/lib/plaid-client'
import { decryptAccessToken } from '@/lib/plaid-encryption'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const targetItemId = body.item_id || null

    const supabase = createServerClient()

    // Get items to sync
    let itemsQuery = supabase
      .from('plaid_items')
      .select('id, item_id, access_token, transaction_cursor')
      .eq('status', 'active')

    if (targetItemId) {
      itemsQuery = itemsQuery.eq('id', targetItemId)
    }

    const { data: items, error: itemsError } = await itemsQuery

    if (itemsError || !items || items.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active items to sync',
        synced: 0,
      })
    }

    // Get category mappings for auto-import
    const { data: mappings } = await supabase
      .from('plaid_category_mappings')
      .select('plaid_primary, plaid_detailed, expense_category_slug')

    const mappingLookup = new Map<string, string>()
    mappings?.forEach((m) => {
      // Detailed mapping takes priority (key: "PRIMARY:DETAILED")
      if (m.plaid_detailed) {
        mappingLookup.set(`${m.plaid_primary}:${m.plaid_detailed}`, m.expense_category_slug)
      }
      // Primary-only mapping (key: "PRIMARY")
      if (!mappingLookup.has(m.plaid_primary)) {
        mappingLookup.set(m.plaid_primary, m.expense_category_slug)
      }
    })

    let totalSynced = 0
    let totalImported = 0
    const errors: string[] = []

    for (const item of items) {
      try {
        const accessToken = decryptAccessToken(item.access_token)

        // Sync transactions from Plaid
        const { added, modified, removed, cursor } = await syncTransactions(
          accessToken,
          item.transaction_cursor
        )

        // Get account ID mapping (plaid account_id -> our UUID)
        const { data: accounts } = await supabase
          .from('plaid_accounts')
          .select('id, account_id')
          .eq('item_id', item.id)

        const accountMap = new Map<string, string>()
        accounts?.forEach((a) => accountMap.set(a.account_id, a.id))

        // Process added transactions
        for (const txn of added) {
          const ourAccountId = accountMap.get(txn.account_id)
          if (!ourAccountId) continue

          // Determine mapped category
          const primary = txn.personal_finance_category?.primary || null
          const detailed = txn.personal_finance_category?.detailed || null
          let mappedCategory: string | null = null

          if (primary && detailed) {
            mappedCategory = mappingLookup.get(`${primary}:${detailed}`) || null
          }
          if (!mappedCategory && primary) {
            mappedCategory = mappingLookup.get(primary) || null
          }

          // Upsert transaction
          const { data: txnRow, error: txnError } = await supabase
            .from('plaid_transactions')
            .upsert({
              transaction_id: txn.transaction_id,
              account_id: ourAccountId,
              amount: txn.amount,
              date: txn.date,
              name: txn.name || null,
              merchant_name: txn.merchant_name || null,
              category: txn.category || [],
              personal_finance_category_primary: primary,
              personal_finance_category_detailed: detailed,
              mapped_category: mappedCategory,
              is_pending: txn.pending || false,
            }, { onConflict: 'transaction_id' })
            .select('id, is_excluded, personal_expense_id')
            .single()

          if (txnError) {
            console.error('Upsert transaction error:', txnError)
            continue
          }

          totalSynced++

          // Auto-import to personal_expenses if mapped and not excluded
          if (mappedCategory && !txnRow.is_excluded && !txnRow.personal_expense_id && txn.amount > 0) {
            const { data: expense, error: expenseError } = await supabase
              .from('personal_expenses')
              .insert({
                name: txn.merchant_name || txn.name || 'Unknown',
                category: mappedCategory,
                amount: Math.abs(txn.amount),
                expense_date: txn.date,
                frequency: 'one_time',
                is_active: true,
                notes: `Auto-imported from Plaid (${txn.transaction_id})`,
              })
              .select('id')
              .single()

            if (!expenseError && expense) {
              // Link back to transaction
              await supabase
                .from('plaid_transactions')
                .update({ personal_expense_id: expense.id })
                .eq('id', txnRow.id)

              totalImported++
            }
          }
        }

        // Process modified transactions
        for (const txn of modified) {
          const ourAccountId = accountMap.get(txn.account_id)
          if (!ourAccountId) continue

          const primary = txn.personal_finance_category?.primary || null
          const detailed = txn.personal_finance_category?.detailed || null
          let mappedCategory: string | null = null

          if (primary && detailed) {
            mappedCategory = mappingLookup.get(`${primary}:${detailed}`) || null
          }
          if (!mappedCategory && primary) {
            mappedCategory = mappingLookup.get(primary) || null
          }

          await supabase
            .from('plaid_transactions')
            .update({
              amount: txn.amount,
              date: txn.date,
              name: txn.name || null,
              merchant_name: txn.merchant_name || null,
              category: txn.category || [],
              personal_finance_category_primary: primary,
              personal_finance_category_detailed: detailed,
              mapped_category: mappedCategory,
              is_pending: txn.pending || false,
            })
            .eq('transaction_id', txn.transaction_id)
        }

        // Process removed transactions
        for (const txn of removed) {
          await supabase
            .from('plaid_transactions')
            .delete()
            .eq('transaction_id', txn.transaction_id)
        }

        // Update cursor and last_synced_at on item
        await supabase
          .from('plaid_items')
          .update({
            transaction_cursor: cursor,
            last_synced_at: new Date().toISOString(),
          })
          .eq('id', item.id)

      } catch (itemError) {
        console.error(`Error syncing item ${item.id}:`, itemError)
        errors.push(`Item ${item.id}: ${String(itemError)}`)
      }
    }

    return NextResponse.json({
      success: true,
      synced: totalSynced,
      imported: totalImported,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Sync error:', error)
    return NextResponse.json(
      { error: 'Sync failed', details: String(error) },
      { status: 500 }
    )
  }
}
