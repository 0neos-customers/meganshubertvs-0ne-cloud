'use client'

import { useState, useCallback } from 'react'
import useSWR from 'swr'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

/**
 * Message in a conversation thread
 */
export interface ConversationMessage {
  id: string
  direction: 'inbound' | 'outbound'
  message_text: string | null
  sender_name: string | null
  status: 'synced' | 'pending' | 'failed'
  created_at: string
}

/**
 * Participant details including GHL contact link
 */
export interface ConversationDetailParticipant {
  skool_user_id: string
  display_name: string | null
  username: string | null
  ghl_contact_id: string | null
}

/**
 * Full conversation detail
 */
export interface ConversationDetail {
  id: string
  participant: ConversationDetailParticipant
  message_count: number
}

/**
 * Return type for the useConversationDetail hook
 */
export interface UseConversationDetailReturn {
  conversation: ConversationDetail | null
  messages: ConversationMessage[]
  isLoading: boolean
  error: Error | undefined
  refresh: () => void
  sendMessage: (text: string, staffSkoolId: string) => Promise<void>
  isSending: boolean
}

/**
 * Hook for fetching conversation detail and messages
 */
export function useConversationDetail(
  conversationId: string | null
): UseConversationDetailReturn {
  const [isSending, setIsSending] = useState(false)

  const url = conversationId ? `/api/dm-sync/conversations/${conversationId}` : null

  const { data, error, mutate } = useSWR<{
    conversation: ConversationDetail
    messages: ConversationMessage[]
    pagination: { hasMore: boolean; oldestTimestamp: string | null }
  }>(url, fetcher, {
    refreshInterval: 10000, // Auto-refresh every 10 seconds
  })

  const sendMessage = useCallback(
    async (text: string, staffSkoolId: string) => {
      if (!conversationId || !text.trim()) return

      setIsSending(true)
      try {
        const response = await fetch(`/api/dm-sync/conversations/${conversationId}/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text, staffSkoolId }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to send message')
        }

        // Refresh the conversation to show the new pending message
        await mutate()
      } catch (error) {
        console.error('[useConversationDetail] Send error:', error)
        throw error
      } finally {
        setIsSending(false)
      }
    },
    [conversationId, mutate]
  )

  return {
    conversation: data?.conversation || null,
    messages: data?.messages || [],
    isLoading: conversationId !== null && !error && !data,
    error,
    refresh: () => mutate(),
    sendMessage,
    isSending,
  }
}
