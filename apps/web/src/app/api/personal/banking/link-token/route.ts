import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createLinkToken } from '@/lib/plaid-client'

export const dynamic = 'force-dynamic'

export async function POST() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const linkToken = await createLinkToken(userId)
    return NextResponse.json({ link_token: linkToken })
  } catch (error) {
    console.error('Create link token error:', error)
    return NextResponse.json(
      { error: 'Failed to create link token', details: String(error) },
      { status: 500 }
    )
  }
}
