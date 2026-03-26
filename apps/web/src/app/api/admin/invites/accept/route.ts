import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { db, eq, and } from '@0ne/db/server'
import { invites } from '@0ne/db/server'
import { safeErrorResponse } from '@/lib/security'

export async function POST(request: NextRequest) {
  const { userId } = await auth.protect()

  // Verify user has admin role
  const client = await clerkClient()
  const user = await client.users.getUser(userId)
  const role = user.publicMetadata?.role as string | undefined
  if (role !== 'admin' && role !== 'owner') {
    return NextResponse.json({ error: 'Forbidden — admin role required' }, { status: 403 })
  }

  const body = await request.json()
  const { invite_token } = body

  if (!invite_token) {
    return NextResponse.json({ error: 'invite_token required' }, { status: 400 })
  }

  try {
    await db
      .update(invites)
      .set({
        status: 'accepted',
        clerkUserId: userId,
        acceptedAt: new Date(),
      })
      .where(and(eq(invites.inviteToken, invite_token), eq(invites.status, 'pending')))

    return NextResponse.json({ success: true })
  } catch (error) {
    return safeErrorResponse('Failed to accept invite', error)
  }
}
