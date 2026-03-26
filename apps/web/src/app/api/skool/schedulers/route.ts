import { NextRequest, NextResponse } from 'next/server'
import { safeErrorResponse } from '@/lib/security'
import { requireAuth, AuthError } from '@/lib/auth-helpers'
import { db, eq, asc } from '@0ne/db/server'
import { skoolScheduledPosts, skoolVariationGroups } from '@0ne/db/server'
import type { SkoolScheduledPostInput } from '@0ne/db'

export const dynamic = 'force-dynamic'

/**
 * GET /api/skool/schedulers
 * List all scheduler slots, ordered by day and time
 * Includes variation group data if available
 */
export async function GET() {
  try {
    await requireAuth()
    const data = await db
      .select({
        scheduler: skoolScheduledPosts,
        variationGroup: {
          id: skoolVariationGroups.id,
          name: skoolVariationGroups.name,
          isActive: skoolVariationGroups.isActive,
        },
      })
      .from(skoolScheduledPosts)
      .leftJoin(skoolVariationGroups, eq(skoolScheduledPosts.variationGroupId, skoolVariationGroups.id))
      .orderBy(asc(skoolScheduledPosts.dayOfWeek), asc(skoolScheduledPosts.time))

    const schedulers = data.map((row) => ({
      ...row.scheduler,
      variationGroup: row.variationGroup?.id ? row.variationGroup : null,
    }))

    return NextResponse.json({ schedulers })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('[Schedulers API] GET exception:', error)
    return safeErrorResponse('Failed to fetch schedulers', error)
  }
}

/**
 * POST /api/skool/schedulers
 * Create a new scheduler slot
 */
export async function POST(request: NextRequest) {
  try {
    await requireAuth()
    const body: SkoolScheduledPostInput = await request.json()

    // Validate required fields
    if (!body.category || body.dayOfWeek === undefined || !body.time) {
      return NextResponse.json(
        { error: 'Missing required fields: category, dayOfWeek, time' },
        { status: 400 }
      )
    }

    // Validate dayOfWeek range (0-6)
    if (body.dayOfWeek < 0 || body.dayOfWeek > 6) {
      return NextResponse.json(
        { error: 'dayOfWeek must be between 0 (Sunday) and 6 (Saturday)' },
        { status: 400 }
      )
    }

    // Validate time format (HH:MM)
    if (!/^\d{2}:\d{2}$/.test(body.time)) {
      return NextResponse.json(
        { error: 'time must be in HH:MM format (e.g., "09:00")' },
        { status: 400 }
      )
    }

    const [inserted] = await db
      .insert(skoolScheduledPosts)
      .values({
        groupSlug: body.groupSlug || 'my-community',
        category: body.category,
        categoryId: body.categoryId || null,
        dayOfWeek: body.dayOfWeek,
        time: body.time,
        variationGroupId: body.variationGroupId || null,
        isActive: body.isActive ?? true,
        note: body.note || null,
      })
      .returning()

    // Fetch the variation group if linked
    let variationGroup = null
    if (inserted.variationGroupId) {
      const [vg] = await db
        .select({ id: skoolVariationGroups.id, name: skoolVariationGroups.name, isActive: skoolVariationGroups.isActive })
        .from(skoolVariationGroups)
        .where(eq(skoolVariationGroups.id, inserted.variationGroupId))
      variationGroup = vg || null
    }

    return NextResponse.json({ scheduler: { ...inserted, variationGroup: variationGroup } }, { status: 201 })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('[Schedulers API] POST exception:', error)
    return safeErrorResponse('Failed to create scheduler', error)
  }
}

/**
 * PUT /api/skool/schedulers
 * Update an existing scheduler slot
 */
export async function PUT(request: NextRequest) {
  try {
    await requireAuth()
    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }

    // Validate dayOfWeek if provided
    if (updates.dayOfWeek !== undefined) {
      if (updates.dayOfWeek < 0 || updates.dayOfWeek > 6) {
        return NextResponse.json(
          { error: 'dayOfWeek must be between 0 (Sunday) and 6 (Saturday)' },
          { status: 400 }
        )
      }
    }

    // Validate time format if provided
    if (updates.time && !/^\d{2}:\d{2}$/.test(updates.time)) {
      return NextResponse.json(
        { error: 'time must be in HH:MM format (e.g., "09:00")' },
        { status: 400 }
      )
    }

    // Map input to schema columns
    const setData: Record<string, unknown> = { updatedAt: new Date() }
    if (updates.groupSlug !== undefined) setData.groupSlug = updates.groupSlug
    if (updates.category !== undefined) setData.category = updates.category
    if (updates.categoryId !== undefined) setData.categoryId = updates.categoryId
    if (updates.dayOfWeek !== undefined) setData.dayOfWeek = updates.dayOfWeek
    if (updates.time !== undefined) setData.time = updates.time
    if (updates.variationGroupId !== undefined) setData.variationGroupId = updates.variationGroupId
    if (updates.isActive !== undefined) setData.isActive = updates.isActive
    if (updates.note !== undefined) setData.note = updates.note

    const [updated] = await db
      .update(skoolScheduledPosts)
      .set(setData)
      .where(eq(skoolScheduledPosts.id, id))
      .returning()

    if (!updated) {
      return NextResponse.json({ error: 'Scheduler not found' }, { status: 404 })
    }

    // Fetch the variation group if linked
    let variationGroup = null
    if (updated.variationGroupId) {
      const [vg] = await db
        .select({ id: skoolVariationGroups.id, name: skoolVariationGroups.name, isActive: skoolVariationGroups.isActive })
        .from(skoolVariationGroups)
        .where(eq(skoolVariationGroups.id, updated.variationGroupId))
      variationGroup = vg || null
    }

    return NextResponse.json({ scheduler: { ...updated, variationGroup: variationGroup } })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('[Schedulers API] PUT exception:', error)
    return safeErrorResponse('Failed to update scheduler', error)
  }
}

/**
 * DELETE /api/skool/schedulers?id=xxx
 * Delete a scheduler slot
 */
export async function DELETE(request: NextRequest) {
  try {
    await requireAuth()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Missing id query parameter' }, { status: 400 })
    }

    await db.delete(skoolScheduledPosts).where(eq(skoolScheduledPosts.id, id))

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('[Schedulers API] DELETE exception:', error)
    return safeErrorResponse('Failed to delete scheduler', error)
  }
}
