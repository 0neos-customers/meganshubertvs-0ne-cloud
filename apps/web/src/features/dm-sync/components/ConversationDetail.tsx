'use client'

/**
 * ConversationDetail Component
 *
 * Full conversation view with message thread and input for sending.
 * Displays header with participant info and external links.
 */

import { useState, useRef, useEffect } from 'react'
import { Button, Input } from '@0ne/ui'
import { Send, Loader2, ExternalLink, RefreshCw } from 'lucide-react'
import { useConversationDetail } from '../hooks/use-conversation-detail'
import { MessageBubble } from './MessageBubble'

// =============================================================================
// TYPES
// =============================================================================

interface ConversationDetailProps {
  conversationId: string
  staffSkoolId?: string // Jimmy's Skool ID for sending (optional - view-only if not set)
}

// =============================================================================
// CONSTANTS
// =============================================================================

const SKOOL_COMMUNITY_SLUG = 'skool-games' // TODO: Get from config

// =============================================================================
// COMPONENT
// =============================================================================

export function ConversationDetail({ conversationId, staffSkoolId }: ConversationDetailProps) {
  const [inputValue, setInputValue] = useState('')
  const [sendError, setSendError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { conversation, messages, isLoading, error, refresh, sendMessage, isSending } =
    useConversationDetail(conversationId)

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  const handleSend = async () => {
    if (!inputValue.trim() || isSending || !staffSkoolId) return

    setSendError(null)
    const messageText = inputValue.trim()
    setInputValue('') // Optimistically clear input

    try {
      await sendMessage(messageText, staffSkoolId)
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Failed to send')
      setInputValue(messageText) // Restore input on error
    }
  }

  const canSend = !!staffSkoolId

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="mt-2 text-sm text-muted-foreground">Loading conversation...</p>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-center px-4">
        <p className="text-sm text-red-600">{error.message || 'Failed to load conversation'}</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => refresh()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    )
  }

  // Not found state
  if (!conversation) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-center px-4">
        <p className="text-sm text-muted-foreground">Conversation not found</p>
      </div>
    )
  }

  const { participant } = conversation
  const displayName = participant.display_name || participant.username || 'Unknown'

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between bg-white">
        <div>
          <h2 className="font-semibold">{displayName}</h2>
          {participant.username && (
            <p className="text-sm text-muted-foreground">@{participant.username}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Skool Profile Link */}
          <a
            href={`https://www.skool.com/@${participant.username || participant.skool_user_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            Skool
            <ExternalLink className="h-3 w-3" />
          </a>
          {/* GHL Contact Link (if available) */}
          {participant.ghl_contact_id && (
            <a
              href={`https://app.gohighlevel.com/v2/location/${SKOOL_COMMUNITY_SLUG}/contacts/detail/${participant.ghl_contact_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              GHL
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
          <Button variant="ghost" size="sm" onClick={() => refresh()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages Thread */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            No messages yet
          </div>
        ) : (
          messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Send Error */}
      {sendError && (
        <div className="px-4 py-2 bg-red-50 text-red-600 text-sm">
          {sendError}
        </div>
      )}

      {/* Input Area */}
      <div className="p-4 border-t bg-white">
        {canSend ? (
          <>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Type a message..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isSending}
                className="flex-1"
              />
              <Button
                onClick={handleSend}
                disabled={!inputValue.trim() || isSending}
                className="bg-[#FF692D] hover:bg-[#E55A20] text-white"
              >
                {isSending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Messages are queued and sent via the Chrome extension
            </p>
          </>
        ) : (
          <div className="text-center py-2">
            <p className="text-sm text-muted-foreground">
              Configure a default staff user in Settings to enable sending
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
