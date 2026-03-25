import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db, eq, desc } from '@0ne/db/server'
import { events, contacts } from '@0ne/db/server'
import { STAGE_LABELS } from '@/features/kpi/lib/config'

export const dynamic = 'force-dynamic'

export interface RecentActivityItem {
  id: string
  name: string
  action: string
  stage: string
  source: string | null
  timestamp: string
  timeAgo: string
}

function getTimeAgo(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 60) {
    return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`
  } else if (diffDays === 1) {
    return 'Yesterday'
  } else if (diffDays < 7) {
    return `${diffDays} days ago`
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
}

export async function GET(request: Request) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const limitParam = parseInt(searchParams.get('limit') || '10', 10)

    // Query recent stage change events with contact details via left join
    try {
      const rows = await db
        .select({
          id: events.id,
          eventType: events.eventType,
          eventData: events.eventData,
          source: events.source,
          createdAt: events.createdAt,
          contactId: contacts.id,
          contactFirstName: contacts.firstName,
          contactLastName: contacts.lastName,
          contactSource: contacts.source,
        })
        .from(events)
        .leftJoin(contacts, eq(events.contactId, contacts.id))
        .where(eq(events.eventType, 'stage_changed'))
        .orderBy(desc(events.createdAt))
        .limit(limitParam)

      const activity: RecentActivityItem[] = rows.map((row) => {
        const name = [row.contactFirstName, row.contactLastName].filter(Boolean).join(' ') || 'Unknown'

        const eventData = row.eventData as { new_stage?: string; old_stage?: string } | null
        const newStage = eventData?.new_stage || 'unknown'
        const stageLabel = STAGE_LABELS[newStage as keyof typeof STAGE_LABELS] || newStage
        const timestamp = new Date(row.createdAt ?? new Date())

        return {
          id: row.id,
          name,
          action: `Moved to ${stageLabel}`,
          stage: newStage,
          source: row.source || row.contactSource || null,
          timestamp: (row.createdAt ?? new Date()).toISOString(),
          timeAgo: getTimeAgo(timestamp),
        }
      })

      return NextResponse.json({ activity })
    } catch (joinError) {
      console.error('Recent activity join query error:', joinError)
      // Fallback: query contacts table directly for recent updates
      const contactRows = await db
        .select({
          id: contacts.id,
          firstName: contacts.firstName,
          lastName: contacts.lastName,
          currentStage: contacts.currentStage,
          source: contacts.source,
          updatedAt: contacts.updatedAt,
        })
        .from(contacts)
        .orderBy(desc(contacts.updatedAt))
        .limit(limitParam)

      const activity: RecentActivityItem[] = contactRows.map((contact) => {
        const name = [contact.firstName, contact.lastName].filter(Boolean).join(' ') || 'Unknown'
        const currentStage = contact.currentStage ?? 'member'
        const stageLabel = STAGE_LABELS[currentStage as keyof typeof STAGE_LABELS] || currentStage
        const timestamp = new Date(contact.updatedAt ?? new Date())

        return {
          id: contact.id,
          name,
          action: `Moved to ${stageLabel}`,
          stage: currentStage,
          source: contact.source,
          timestamp: (contact.updatedAt ?? new Date()).toISOString(),
          timeAgo: getTimeAgo(timestamp),
        }
      })

      return NextResponse.json({ activity })
    }
  } catch (error) {
    console.error('Recent activity error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch recent activity', details: String(error) },
      { status: 500 }
    )
  }
}
