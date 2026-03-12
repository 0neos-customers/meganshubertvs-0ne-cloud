import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@0ne/db/server'
import { removeItem } from '@/lib/plaid-client'
import { decryptAccessToken } from '@/lib/plaid-encryption'

export const dynamic = 'force-dynamic'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { itemId } = await params
    const supabase = createServerClient()

    // Get the item to find the access token
    const { data: item, error: fetchError } = await supabase
      .from('plaid_items')
      .select('id, access_token')
      .eq('id', itemId)
      .single()

    if (fetchError || !item) {
      return NextResponse.json(
        { error: 'Item not found' },
        { status: 404 }
      )
    }

    // Remove from Plaid
    try {
      const accessToken = decryptAccessToken(item.access_token)
      await removeItem(accessToken)
    } catch (plaidError) {
      console.error('Plaid item remove error (continuing with local delete):', plaidError)
      // Continue with local deletion even if Plaid API call fails
    }

    // Delete from database (cascades to accounts and transactions via FK)
    const { error: deleteError } = await supabase
      .from('plaid_items')
      .delete()
      .eq('id', itemId)

    if (deleteError) {
      console.error('Delete plaid item error:', deleteError)
      return NextResponse.json(
        { error: 'Failed to unlink account', details: deleteError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Unlink item error:', error)
    return NextResponse.json(
      { error: 'Failed to unlink account', details: String(error) },
      { status: 500 }
    )
  }
}
