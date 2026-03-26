import { NextRequest, NextResponse } from 'next/server'
import { safeErrorResponse } from '@/lib/security'
import { requireAuth, AuthError } from '@/lib/auth-helpers'
import { db, eq } from '@0ne/db/server'
import { skoolGroupSettings } from '@0ne/db/server'
import type { EmailBlastStatus } from '@0ne/db'

export const dynamic = 'force-dynamic'

const COOLDOWN_HOURS = 72

/**
 * GET /api/skool/group-settings
 * Get group settings including email blast status
 *
 * Query params:
 * - group_slug: The group to get settings for (default: 'my-community')
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth()
    const { searchParams } = new URL(request.url)
    const groupSlug = searchParams.get('groupSlug') || searchParams.get('group_slug') || 'my-community'

    const [data] = await db
      .select()
      .from(skoolGroupSettings)
      .where(eq(skoolGroupSettings.groupSlug, groupSlug))

    // Calculate email blast status
    const lastBlastAt = data?.lastEmailBlastAt ? new Date(data.lastEmailBlastAt) : null
    let available = true
    let hoursUntilAvailable = 0

    if (lastBlastAt) {
      const cooldownEnd = new Date(lastBlastAt.getTime() + COOLDOWN_HOURS * 60 * 60 * 1000)
      const now = new Date()

      if (now < cooldownEnd) {
        available = false
        hoursUntilAvailable = Math.ceil((cooldownEnd.getTime() - now.getTime()) / (60 * 60 * 1000))
      }
    }

    const emailBlastStatus: EmailBlastStatus = {
      available,
      hoursUntilAvailable,
      lastBlastAt: data?.lastEmailBlastAt?.toISOString() || null,
    }

    return NextResponse.json({
      settings: data || { groupSlug, lastEmailBlastAt: null },
      emailBlastStatus,
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('[Group Settings API] GET exception:', error)
    return safeErrorResponse('Failed to fetch group settings', error)
  }
}

/**
 * POST /api/skool/group-settings/record-blast
 * Record that an email blast was sent
 */
export async function POST(request: NextRequest) {
  try {
    await requireAuth()
    const body = await request.json()
    const groupSlug = body.groupSlug || body.group_slug || 'my-community'

    const now = new Date()

    // Upsert the group settings with the new blast time
    const [upserted] = await db
      .insert(skoolGroupSettings)
      .values({
        groupSlug,
        lastEmailBlastAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: skoolGroupSettings.groupSlug,
        set: {
          lastEmailBlastAt: now,
          updatedAt: now,
        },
      })
      .returning()

    return NextResponse.json({ settings: upserted })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('[Group Settings API] POST exception:', error)
    return safeErrorResponse('Failed to record email blast', error)
  }
}
