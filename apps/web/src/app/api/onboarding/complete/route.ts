import { NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { safeErrorResponse } from '@/lib/security'

export async function POST() {
  const { userId } = await auth.protect()

  const client = await clerkClient()
  const user = await client.users.getUser(userId)

  // Already completed — idempotent success
  if (user.publicMetadata?.onboardingComplete === true) {
    return NextResponse.json({ success: true, alreadyComplete: true })
  }

  try {
    await client.users.updateUserMetadata(userId, {
      publicMetadata: { onboardingComplete: true },
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    return safeErrorResponse('Failed to complete onboarding', error)
  }
}
