import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth-helpers'
import { safeErrorResponse } from '@/lib/security'
import { db, desc, inArray, isNotNull } from '@0ne/db/server'
import { dmMessages, dmContactMappings, skoolMembers, conversationSyncStatus } from '@0ne/db/server'

export const dynamic = 'force-dynamic'

interface ConversationParticipant {
  skoolUserId: string
  displayName: string | null
  username: string | null
}

interface ConversationLastMessage {
  text: string | null
  direction: 'inbound' | 'outbound'
  createdAt: string
}

interface Conversation {
  conversationId: string
  participant: ConversationParticipant
  lastMessage: ConversationLastMessage
  messageCount: number
  pendingCount: number
  syncedCount: number
}

interface ConversationsSummary {
  totalConversations: number
  totalPending: number
}

interface ConversationsResponse {
  conversations: Conversation[]
  summary: ConversationsSummary
  pagination: {
    limit: number
    offset: number
    hasMore: boolean
  }
}

/**
 * GET /api/dm-sync/conversations
 * List all conversations grouped by skool_conversation_id
 * Query params: search, status, limit, offset
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth()
    const { searchParams } = new URL(request.url)

    const search = searchParams.get('search')?.trim() || ''
    const status = searchParams.get('status') // 'all' | 'pending' | 'synced' | 'failed'
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    // Get all messages - we need to aggregate by conversation
    const messages = await db.select({
      skoolConversationId: dmMessages.skoolConversationId,
      skoolUserId: dmMessages.skoolUserId,
      direction: dmMessages.direction,
      messageText: dmMessages.messageText,
      status: dmMessages.status,
      createdAt: dmMessages.createdAt,
      senderName: dmMessages.senderName,
    }).from(dmMessages)
      .orderBy(desc(dmMessages.createdAt))

    if (messages.length === 0) {
      return NextResponse.json({
        conversations: [],
        summary: {
          totalConversations: 0,
          totalPending: 0,
        },
        pagination: {
          limit,
          offset,
          hasMore: false,
        },
      } as ConversationsResponse)
    }

    // Get contact mappings for participant names
    const skoolUserIds = [...new Set(messages.map((m) => m.skoolUserId).filter(Boolean))] as string[]

    const mappings = skoolUserIds.length > 0
      ? await db.select({
          skoolUserId: dmContactMappings.skoolUserId,
          skoolUsername: dmContactMappings.skoolUsername,
          skoolDisplayName: dmContactMappings.skoolDisplayName,
        }).from(dmContactMappings).where(inArray(dmContactMappings.skoolUserId, skoolUserIds))
      : []

    // Also check skool_members table as fallback for names
    const members = skoolUserIds.length > 0
      ? await db.select({
          skoolUserId: skoolMembers.skoolUserId,
          displayName: skoolMembers.displayName,
          skoolUsername: skoolMembers.skoolUsername,
        }).from(skoolMembers).where(inArray(skoolMembers.skoolUserId, skoolUserIds))
      : []

    // Get participant names from conversation_sync_status (extension-pushed Skool API data)
    const conversationIds = [...new Set(messages.map((m) => m.skoolConversationId).filter(Boolean))] as string[]
    const syncStatuses = conversationIds.length > 0
      ? await db.select({
          conversationId: conversationSyncStatus.conversationId,
          participantName: conversationSyncStatus.participantName,
        }).from(conversationSyncStatus)
          .where(inArray(conversationSyncStatus.conversationId, conversationIds))
      : []

    // Build conversation name lookup (conversation_id → participant_name)
    const conversationNameMap = new Map<string, string>()
    syncStatuses.forEach((s) => {
      if (s.participantName && s.conversationId) {
        conversationNameMap.set(s.conversationId, s.participantName)
      }
    })

    // Build user lookup map (dm_contact_mappings first, then skool_members fallback)
    const userMap = new Map<string, { username: string | null; displayName: string | null }>()
    members.forEach((m) => {
      userMap.set(m.skoolUserId, {
        username: m.skoolUsername,
        displayName: m.displayName,
      })
    })
    // dm_contact_mappings overwrites skool_members (higher priority)
    mappings.forEach((m) => {
      if (m.skoolUserId) {
        userMap.set(m.skoolUserId, {
          username: m.skoolUsername,
          displayName: m.skoolDisplayName,
        })
      }
    })

    // Group messages by conversation
    const conversationMap = new Map<
      string,
      {
        conversationId: string
        skoolUserId: string
        messages: typeof messages
        lastMessage: typeof messages[0] | null
        pendingCount: number
        syncedCount: number
        failedCount: number
      }
    >()

    messages.forEach((msg) => {
      const convId = msg.skoolConversationId || ''
      const existing = conversationMap.get(convId)

      if (existing) {
        existing.messages.push(msg)
        if (msg.status === 'pending') existing.pendingCount++
        else if (msg.status === 'synced') existing.syncedCount++
        else if (msg.status === 'failed') existing.failedCount++
      } else {
        conversationMap.set(convId, {
          conversationId: convId,
          skoolUserId: msg.skoolUserId || '',
          messages: [msg],
          lastMessage: msg, // First message is most recent (sorted desc)
          pendingCount: msg.status === 'pending' ? 1 : 0,
          syncedCount: msg.status === 'synced' ? 1 : 0,
          failedCount: msg.status === 'failed' ? 1 : 0,
        })
      }
    })

    // Build conversation list with participant info
    let conversations: Conversation[] = Array.from(conversationMap.values()).map((conv) => {
      // Resolve the OTHER participant's skoolUserId (from inbound messages, not staff's outbound)
      const inboundMsg = conv.messages.find((m) => m.direction === 'inbound')
      const participantUserId = inboundMsg?.skoolUserId || conv.skoolUserId

      const userInfo = userMap.get(participantUserId)

      // Try senderName from an INBOUND message that has a valid name (not "Unknown")
      const inboundMessageWithName = conv.messages.find(
        (m) => m.direction === 'inbound' && m.senderName && m.senderName !== 'Unknown'
      )
      // Fallback to any message with a valid senderName
      const anyMessageWithName = conv.messages.find(
        (m) => m.senderName && m.senderName !== 'Unknown'
      )
      const senderName = inboundMessageWithName?.senderName || anyMessageWithName?.senderName || null

      // Name from conversationSyncStatus (extension-pushed from Skool API)
      const syncStatusName = conversationNameMap.get(conv.conversationId) || null

      return {
        conversationId: conv.conversationId,
        participant: {
          skoolUserId: participantUserId,
          displayName: userInfo?.displayName || syncStatusName || senderName || null,
          username: userInfo?.username || null,
        },
        lastMessage: conv.lastMessage
          ? {
              text: conv.lastMessage.messageText,
              direction: conv.lastMessage.direction as 'inbound' | 'outbound',
              createdAt: conv.lastMessage.createdAt?.toISOString() || new Date().toISOString(),
            }
          : {
              text: null,
              direction: 'inbound' as const,
              createdAt: new Date().toISOString(),
            },
        messageCount: conv.messages.length,
        pendingCount: conv.pendingCount,
        syncedCount: conv.syncedCount,
      }
    })

    // Apply search filter (by participant name)
    if (search) {
      const searchLower = search.toLowerCase()
      conversations = conversations.filter(
        (c) =>
          c.participant.displayName?.toLowerCase().includes(searchLower) ||
          c.participant.username?.toLowerCase().includes(searchLower)
      )
    }

    // Apply status filter
    if (status && status !== 'all') {
      if (status === 'pending') {
        conversations = conversations.filter((c) => c.pendingCount > 0)
      } else if (status === 'synced') {
        conversations = conversations.filter((c) => c.pendingCount === 0 && c.syncedCount > 0)
      } else if (status === 'failed') {
        conversations = conversations.filter(
          (c) => c.pendingCount === 0 && c.syncedCount === 0
        )
      }
    }

    // Sort by last message date (most recent first)
    conversations.sort((a, b) => {
      const aDate = new Date(a.lastMessage.createdAt).getTime()
      const bDate = new Date(b.lastMessage.createdAt).getTime()
      return bDate - aDate
    })

    // Calculate summary before pagination
    const summary: ConversationsSummary = {
      totalConversations: conversations.length,
      totalPending: conversations.reduce((acc, c) => acc + c.pendingCount, 0),
    }

    // Apply pagination
    const paginatedConversations = conversations.slice(offset, offset + limit)
    const hasMore = offset + limit < conversations.length

    return NextResponse.json({
      conversations: paginatedConversations,
      summary,
      pagination: {
        limit,
        offset,
        hasMore,
      },
    } as ConversationsResponse)
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('[Conversations API] GET exception:', error)
    return safeErrorResponse('Failed to fetch conversations', error)
  }
}
