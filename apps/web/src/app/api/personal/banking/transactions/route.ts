import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@0ne/db/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const accountId = searchParams.get('accountId')
    const scope = searchParams.get('scope')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const category = searchParams.get('category')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    const supabase = createServerClient()

    let query = supabase
      .from('plaid_transactions')
      .select('*, plaid_accounts!inner(name, mask, type, scope, item_id, plaid_items(institution_name))', { count: 'exact' })
      .order('date', { ascending: false })
      .range(offset, offset + limit - 1)

    if (scope) {
      query = query.eq('plaid_accounts.scope', scope)
    }
    if (accountId) {
      query = query.eq('account_id', accountId)
    }
    if (startDate) {
      query = query.gte('date', startDate)
    }
    if (endDate) {
      query = query.lte('date', endDate)
    }
    if (category) {
      query = query.eq('mapped_category', category)
    }
    if (search) {
      query = query.or(`name.ilike.%${search}%,merchant_name.ilike.%${search}%`)
    }

    const { data: transactions, count, error } = await query

    if (error) {
      console.error('Fetch transactions error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch transactions', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      transactions: transactions || [],
      total: count || 0,
      page,
      limit,
    })
  } catch (error) {
    console.error('Transactions GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch transactions', details: String(error) },
      { status: 500 }
    )
  }
}

/**
 * POST /api/personal/banking/transactions
 * Promote a bank transaction to a tracked personal expense
 */
export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { transaction_id } = body

    if (!transaction_id) {
      return NextResponse.json(
        { error: 'Missing required field: transaction_id' },
        { status: 400 }
      )
    }

    const supabase = createServerClient()

    // Fetch the transaction
    const { data: txn, error: txnError } = await supabase
      .from('plaid_transactions')
      .select('id, transaction_id, amount, date, name, merchant_name, mapped_category, personal_expense_id')
      .eq('id', transaction_id)
      .single()

    if (txnError || !txn) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      )
    }

    // Already promoted
    if (txn.personal_expense_id) {
      return NextResponse.json(
        { error: 'Transaction already added to expenses' },
        { status: 409 }
      )
    }

    // Create the personal expense
    const { data: expense, error: expenseError } = await supabase
      .from('personal_expenses')
      .insert({
        name: txn.merchant_name || txn.name || 'Unknown',
        category: txn.mapped_category || 'other',
        amount: Math.abs(txn.amount),
        expense_date: txn.date,
        frequency: 'one_time',
        is_active: true,
        notes: `From bank transaction (${txn.transaction_id})`,
      })
      .select('id')
      .single()

    if (expenseError || !expense) {
      console.error('Promote transaction error:', expenseError)
      return NextResponse.json(
        { error: 'Failed to create expense', details: expenseError?.message },
        { status: 500 }
      )
    }

    // Link transaction back to the expense
    await supabase
      .from('plaid_transactions')
      .update({ personal_expense_id: expense.id })
      .eq('id', txn.id)

    return NextResponse.json({ success: true, expense_id: expense.id })
  } catch (error) {
    console.error('Promote transaction error:', error)
    return NextResponse.json(
      { error: 'Failed to promote transaction', details: String(error) },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { id, is_excluded, mapped_category } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Missing required field: id' },
        { status: 400 }
      )
    }

    const supabase = createServerClient()
    const updateData: Record<string, unknown> = {}

    if (typeof is_excluded === 'boolean') {
      updateData.is_excluded = is_excluded
    }
    if (mapped_category !== undefined) {
      updateData.mapped_category = mapped_category
    }

    const { data, error } = await supabase
      .from('plaid_transactions')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error || !data) {
      const status = error?.code === 'PGRST116' ? 404 : 500
      return NextResponse.json(
        { error: status === 404 ? 'Transaction not found' : 'Failed to update', details: error?.message },
        { status }
      )
    }

    return NextResponse.json({ success: true, transaction: data })
  } catch (error) {
    console.error('Transaction PATCH error:', error)
    return NextResponse.json(
      { error: 'Failed to update transaction', details: String(error) },
      { status: 500 }
    )
  }
}
