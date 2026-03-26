import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth-helpers'
import { db, eq, gte, lte, asc, and } from '@0ne/db/server'
import { skoolCommunityActivityDaily } from '@0ne/db/server'

/**
 * GET /api/kpi/community-activity
 *
 * Returns community activity history from skool_community_activity_daily table.
 *
 * Query params:
 *   - startDate: Start of date range (YYYY-MM-DD)
 *   - endDate: End of date range (YYYY-MM-DD)
 *   - range: Preset range ('30d' or '1y') - used if no explicit dates
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth()
    const { searchParams } = new URL(request.url)
    const startDateParam = searchParams.get('startDate')
    const endDateParam = searchParams.get('endDate')
    const range = searchParams.get('range') || '30d'

    // Calculate date range
    let startDate: string
    let endDate: string

    if (startDateParam && endDateParam) {
      startDate = startDateParam
      endDate = endDateParam
    } else {
      const now = new Date()
      endDate = now.toISOString().split('T')[0]

      if (range === '1y') {
        const oneYearAgo = new Date(now)
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
        startDate = oneYearAgo.toISOString().split('T')[0]
      } else {
        const thirtyDaysAgo = new Date(now)
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        startDate = thirtyDaysAgo.toISOString().split('T')[0]
      }
    }

    // Fetch daily activity data
    const dailyData = await db
      .select({
        date: skoolCommunityActivityDaily.date,
        activityCount: skoolCommunityActivityDaily.activityCount,
        dailyActiveMembers: skoolCommunityActivityDaily.dailyActiveMembers,
      })
      .from(skoolCommunityActivityDaily)
      .where(
        and(
          eq(skoolCommunityActivityDaily.groupSlug, 'my-community'),
          gte(skoolCommunityActivityDaily.date, startDate),
          lte(skoolCommunityActivityDaily.date, endDate),
        )
      )
      .orderBy(asc(skoolCommunityActivityDaily.date))

    // Transform data
    const daily = dailyData.map((row) => ({
      date: row.date!,
      activityCount: row.activityCount || 0,
      dailyActiveMembers: row.dailyActiveMembers as number | null,
    }))

    // Calculate monthly aggregates for long date ranges
    const monthlyMap = new Map<string, {
      month: string
      activityCount: number
      dailyActiveMembers: number
      daysWithActiveData: number
    }>()

    daily.forEach((row) => {
      const month = row.date.substring(0, 7) // YYYY-MM
      const existing = monthlyMap.get(month)
      if (existing) {
        existing.activityCount += row.activityCount
        if (row.dailyActiveMembers !== null) {
          existing.dailyActiveMembers += row.dailyActiveMembers
          existing.daysWithActiveData++
        }
      } else {
        monthlyMap.set(month, {
          month,
          activityCount: row.activityCount,
          dailyActiveMembers: row.dailyActiveMembers || 0,
          daysWithActiveData: row.dailyActiveMembers !== null ? 1 : 0,
        })
      }
    })

    const monthly = Array.from(monthlyMap.values()).map((m) => ({
      date: `${m.month}-01`, // First day of month for chart compatibility
      month: m.month,
      activityCount: m.activityCount,
      avgDailyActiveMembers: m.daysWithActiveData > 0
        ? Math.round(m.dailyActiveMembers / m.daysWithActiveData)
        : null,
    }))

    // Calculate totals
    const totalActivity = daily.reduce((sum, d) => sum + d.activityCount, 0)
    const avgDailyActivity = daily.length > 0
      ? Math.round(totalActivity / daily.length)
      : 0

    // Calculate average active members (only for days we have data)
    const daysWithActiveMembers = daily.filter(d => d.dailyActiveMembers !== null)
    const avgDailyActiveMembers = daysWithActiveMembers.length > 0
      ? Math.round(
          daysWithActiveMembers.reduce((sum, d) => sum + (d.dailyActiveMembers || 0), 0) /
            daysWithActiveMembers.length
        )
      : null

    // Find peak day
    const peakDay = daily.reduce(
      (max, d) => (d.activityCount > max.activityCount ? d : max),
      { date: '', activityCount: 0, dailyActiveMembers: null }
    )

    return NextResponse.json({
      daily,
      monthly,
      totals: {
        totalActivity,
        avgDailyActivity,
        avgDailyActiveMembers,
        peakDay: peakDay.activityCount > 0 ? {
          date: peakDay.date,
          count: peakDay.activityCount,
        } : null,
      },
      period: {
        range,
        startDate,
        endDate,
      },
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('[Community Activity API] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
