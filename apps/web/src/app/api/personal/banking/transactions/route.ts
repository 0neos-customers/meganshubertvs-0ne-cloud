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
      .select('*, plaid_accounts!inner(name, mask, type, item_id, plaid_items(institution_name))', { count: 'exact' })
      .order('date', { ascending: false })
      .range(offset, offset + limit - 1)

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
