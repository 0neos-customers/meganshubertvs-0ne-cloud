import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@0ne/db/server'

export const dynamic = 'force-dynamic'

interface ConversationMessage {
  id: string
  direction: 'inbound' | 'outbound'
  message_text: string | null
  sender_name: string | null
  status: 'synced' | 'pending' | 'failed'
  created_at: string
}

interface ConversationParticipant {
  skool_user_id: string
  display_name: string | null
  username: string | null
  ghl_contact_id: string | null
}

interface ConversationDetail {
  id: string
  participant: ConversationParticipant
  message_count: number
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
    const { id: conversationId } = await params
    const supabase = createServerClient()
    const { searchParams } = new URL(request.url)

    const limit = parseInt(searchParams.get('limit') || '100', 10)
    const before = searchParams.get('before') // ISO timestamp for pagination

    if (!conversationId) {
      return NextResponse.json({ error: 'Conversation ID is required' }, { status: 400 })
    }

    // Build query for messages
    let messagesQuery = supabase
      .from('dm_messages')
      .select('id, skool_user_id, direction, message_text, sender_name, status, created_at')
      .eq('skool_conversation_id', conversationId)
      .order('created_at', { ascending: true }) // Chronological order

    // Apply pagination if 'before' timestamp provided
    if (before) {
      messagesQuery = messagesQuery.lt('created_at', before)
    }

    // Add limit + 1 to check if there are more
    messagesQuery = messagesQuery.limit(limit + 1)

    const { data: messages, error: messagesError } = await messagesQuery

    if (messagesError) {
      console.error('[Conversation Detail API] GET messages error:', messagesError)
      return NextResponse.json({ error: messagesError.message }, { status: 500 })
    }

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    // Check if there are more messages
    const hasMore = messages.length > limit
    const actualMessages = hasMore ? messages.slice(0, limit) : messages

    // Get participant info from the first message's skool_user_id
    // Find the user who is NOT Jimmy (i.e., the inbound message sender)
    const participantUserId = messages.find((m) => m.direction === 'inbound')?.skool_user_id ||
      messages[0].skool_user_id

    // Get contact mapping for participant
    const { data: mapping } = await supabase
      .from('dm_contact_mappings')
      .select('skool_user_id, skool_username, skool_display_name, ghl_contact_id')
      .eq('skool_user_id', participantUserId)
      .single()

    // Get sender_name from messages as fallback
    const senderName = messages.find((m) => m.direction === 'inbound')?.sender_name ||
      messages[0]?.sender_name

    const participant: ConversationParticipant = {
      skool_user_id: participantUserId,
      display_name: mapping?.skool_display_name || senderName || null,
      username: mapping?.skool_username || null,
      ghl_contact_id: mapping?.ghl_contact_id || null,
    }

    // Format messages for response
    const formattedMessages: ConversationMessage[] = actualMessages.map((msg) => ({
      id: msg.id,
      direction: msg.direction as 'inbound' | 'outbound',
      message_text: msg.message_text,
      sender_name: msg.sender_name,
      status: msg.status as 'synced' | 'pending' | 'failed',
      created_at: msg.created_at,
    }))

    // Get oldest timestamp for pagination
    const oldestTimestamp = actualMessages.length > 0
      ? actualMessages[0].created_at
      : null

    return NextResponse.json({
      conversation: {
        id: conversationId,
        participant,
        message_count: actualMessages.length, // Note: This is just the loaded count
      },
      messages: formattedMessages,
      pagination: {
        hasMore,
        oldestTimestamp,
      },
    } as ConversationDetailResponse)
  } catch (error) {
    console.error('[Conversation Detail API] GET exception:', error)
    return NextResponse.json(
      { error: 'Failed to fetch conversation', details: String(error) },
      { status: 500 }
    )
  }
}
