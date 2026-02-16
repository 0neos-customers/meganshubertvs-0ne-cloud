'use client'

/**
 * ConversationItem Component
 *
 * Individual conversation row in the ConversationList.
 * Shows participant name, message preview, time, and pending badge.
 */

import { Badge } from '@0ne/ui'
import type { Conversation } from '../hooks/use-conversations'

// =============================================================================
// TYPES
// =============================================================================

interface ConversationItemProps {
  conversation: Conversation
  isSelected: boolean
  onClick: () => void
}

// =============================================================================
// HELPERS
// =============================================================================

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`

  // Show date for older messages
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function getInitials(name: string | null): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

function truncateText(text: string | null, maxLength: number): string {
  if (!text) return ''
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength).trim() + '...'
}

// =============================================================================
// COMPONENT
// =============================================================================

export function ConversationItem({ conversation, isSelected, onClick }: ConversationItemProps) {
  const { participant, last_message, message_count, pending_count } = conversation
  const displayName = participant.display_name || participant.username || 'Unknown'

  return (
    <button
      onClick={onClick}
      className={`
        w-full text-left p-3 hover:bg-muted/50 transition-colors
        ${isSelected ? 'bg-primary/5 border-l-2 border-l-primary' : ''}
      `}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div
          className={`
            flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center
            text-sm font-medium
            ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}
          `}
        >
          {getInitials(displayName)}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Name + Time Row */}
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-sm truncate">{displayName}</span>
            <span className="text-xs text-muted-foreground flex-shrink-0">
              {formatRelativeTime(last_message.created_at)}
            </span>
          </div>

          {/* Preview + Badge Row */}
          <div className="flex items-center justify-between gap-2 mt-0.5">
            <span className="text-sm text-muted-foreground truncate">
              {last_message.direction === 'outbound' && (
                <span className="text-muted-foreground/70">You: </span>
              )}
              {truncateText(last_message.text, 40) || 'No message'}
            </span>

            {/* Pending Badge */}
            {pending_count > 0 && (
              <Badge
                className="flex-shrink-0 bg-[#FF692D] text-white text-xs px-1.5 py-0 h-5 min-w-[20px] justify-center"
              >
                {pending_count}
              </Badge>
            )}
          </div>

          {/* Username (if different from display name) */}
          {participant.username && participant.username !== participant.display_name && (
            <span className="text-xs text-muted-foreground/70">@{participant.username}</span>
          )}
        </div>
      </div>
    </button>
  )
}
