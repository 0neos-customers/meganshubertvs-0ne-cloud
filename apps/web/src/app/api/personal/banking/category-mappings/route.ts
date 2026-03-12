import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@0ne/db/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createServerClient()

    const { data: mappings, error } = await supabase
      .from('plaid_category_mappings')
      .select('*')
      .order('plaid_primary')

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch mappings', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ mappings: mappings || [] })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch mappings', details: String(error) },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { plaid_primary, plaid_detailed, expense_category_slug } = body

    if (!plaid_primary || !expense_category_slug) {
      return NextResponse.json(
        { error: 'Missing required fields: plaid_primary, expense_category_slug' },
        { status: 400 }
      )
    }

    const supabase = createServerClient()

    const { data, error } = await supabase
      .from('plaid_category_mappings')
      .upsert({
        plaid_primary,
        plaid_detailed: plaid_detailed || null,
        expense_category_slug,
      }, { onConflict: 'plaid_primary,plaid_detailed' })
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: 'Failed to save mapping', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, mapping: data })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to save mapping', details: String(error) },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Missing required query parameter: id' },
        { status: 400 }
      )
    }

    const supabase = createServerClient()

    const { error } = await supabase
      .from('plaid_category_mappings')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json(
        { error: 'Failed to delete mapping', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete mapping', details: String(error) },
      { status: 500 }
    )
  }
}
