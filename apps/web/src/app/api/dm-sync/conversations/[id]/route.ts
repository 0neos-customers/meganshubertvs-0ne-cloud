import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth-helpers'
import { safeErrorResponse } from '@/lib/security'
import { db, eq, and, asc, lt, isNotNull, inArray } from '@0ne/db/server'
import { dmMessages, dmContactMappings, skoolMembers, conversationSyncStatus } from '@0ne/db/server'

export const dynamic = 'force-dynamic'

interface ConversationMessage {
  id: string
  direction: 'inbound' | 'outbound'
  messageText: string | null
  senderName: string | null
  status: 'synced' | 'pending' | 'failed'
  createdAt: string
}

interface ConversationParticipant {
  skoolUserId: string
  displayName: string | null
  username: string | null
  ghlContactId: string | null
}

interface ConversationDetail {
  id: string
  participant: ConversationParticipant
  messageCount: number
}

interface ConversationDetailResponse {
  conversation: ConversationDetail
  messages: ConversationMessage[]
  pagination: {
    hasMore: boolean
    oldestTimestamp: string | null
  }
}

/**
 * GET /api/dm-sync/conversations/[id]
 * Get all messages for a specific conversation
 * Query params: limit, before (timestamp for pagination)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth()
    const { id: conversationId } = await params
    const { searchParams } = new URL(request.url)

    const limit = parseInt(searchParams.get('limit') || '100', 10)
    const before = searchParams.get('before') // ISO timestamp for pagination

    if (!conversationId) {
      return NextResponse.json({ error: 'Conversation ID is required' }, { status: 400 })
    }

    // Build where conditions
    const conditions: ReturnType<typeof eq>[] = [
      eq(dmMessages.skoolConversationId, conversationId),
    ]

    if (before) {
      conditions.push(lt(dmMessages.createdAt, new Date(before)))
    }

    // Query messages with limit + 1 to check if there are more
    const messages = await db.select({
      id: dmMessages.id,
      skoolUserId: dmMessages.skoolUserId,
      direction: dmMessages.direction,
      messageText: dmMessages.messageText,
      senderName: dmMessages.senderName,
      status: dmMessages.status,
      createdAt: dmMessages.createdAt,
    }).from(dmMessages)
      .where(and(...conditions))
      .orderBy(asc(dmMessages.createdAt))
      .limit(limit + 1)

    if (messages.length === 0) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    // Check if there are more messages
    const hasMore = messages.length > limit
    const actualMessages = hasMore ? messages.slice(0, limit) : messages

    // Get participant info from the first message's skool_user_id
    // Find the user who is NOT staff (i.e., the inbound message sender)
    const participantUserId = messages.find((m) => m.direction === 'inbound')?.skoolUserId ||
      messages[0].skoolUserId || ''

    // Get contact mapping for participant
    const [mapping] = await db.select({
      skoolUserId: dmContactMappings.skoolUserId,
      skoolUsername: dmContactMappings.skoolUsername,
      skoolDisplayName: dmContactMappings.skoolDisplayName,
      ghlContactId: dmContactMappings.ghlContactId,
    }).from(dmContactMappings)
      .where(eq(dmContactMappings.skoolUserId, participantUserId))
      .limit(1)

    // Also check skool_members table as fallback for names
    const [member] = await db.select({
      displayName: skoolMembers.displayName,
      skoolUsername: skoolMembers.skoolUsername,
    }).from(skoolMembers)
      .where(eq(skoolMembers.skoolUserId, participantUserId))
      .limit(1)

    // Get participant name from conversation_sync_status (extension-pushed Skool API data)
    const [syncStatus] = await db.select({
      participantName: conversationSyncStatus.participantName,
    }).from(conversationSyncStatus)
      .where(and(
        eq(conversationSyncStatus.conversationId, conversationId),
        isNotNull(conversationSyncStatus.participantName)
      ))
      .limit(1)
    const syncStatusName = syncStatus?.participantName || null

    // Get sender_name from messages as fallback - look for a valid name (not "Unknown")
    const inboundWithName = messages.find(
      (m) => m.direction === 'inbound' && m.senderName && m.senderName !== 'Unknown'
    )
    const anyWithName = messages.find(
      (m) => m.senderName && m.senderName !== 'Unknown'
    )
    const senderName = inboundWithName?.senderName || anyWithName?.senderName || null

    const participant: ConversationParticipant = {
      skoolUserId: participantUserId,
      displayName: mapping?.skoolDisplayName || member?.displayName || syncStatusName || senderName || null,
      username: mapping?.skoolUsername || member?.skoolUsername || null,
      ghlContactId: mapping?.ghlContactId || null,
    }

    // Format messages for response
    const formattedMessages: ConversationMessage[] = actualMessages.map((msg) => ({
      id: msg.id,
      direction: msg.direction as 'inbound' | 'outbound',
      messageText: msg.messageText,
      senderName: msg.senderName,
      status: msg.status as 'synced' | 'pending' | 'failed',
      createdAt: msg.createdAt?.toISOString() || new Date().toISOString(),
    }))

    // Get oldest timestamp for pagination (first item when sorted oldest-first)
    const oldestTimestamp = actualMessages.length > 0
      ? actualMessages[0].createdAt?.toISOString() || null
      : null

    return NextResponse.json({
      conversation: {
        id: conversationId,
        participant,
        messageCount: actualMessages.length,
      },
      messages: formattedMessages,
      pagination: {
        hasMore,
        oldestTimestamp,
      },
    } as ConversationDetailResponse)
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('[Conversation Detail API] GET exception:', error)
    return safeErrorResponse('Failed to fetch conversation', error)
  }
}
