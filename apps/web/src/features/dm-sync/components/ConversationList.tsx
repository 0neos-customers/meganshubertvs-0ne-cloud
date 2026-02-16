'use client'

/**
 * ConversationList Component
 *
 * Displays a scrollable list of DM conversations with search,
 * status filtering, and selection support for the Skool Inbox.
 */

import { useState, useMemo } from 'react'
import { Input, Badge } from '@0ne/ui'
import { Search, Loader2, Inbox, MessageCircle } from 'lucide-react'
import { useConversations, type Conversation } from '../hooks/use-conversations'
import { ConversationItem } from './ConversationItem'

// =============================================================================
// TYPES
// =============================================================================

interface ConversationListProps {
  selectedId: string | null
  onSelect: (id: string) => void
}

type StatusFilter = 'all' | 'pending' | 'synced'

// =============================================================================
// COMPONENT
// =============================================================================

export function ConversationList({ selectedId, onSelect }: ConversationListProps) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const { conversations, summary, isLoading, error, refresh } = useConversations({
    search: search.trim() || undefined,
    status: statusFilter,
    limit: 100,
  })

  // Debounce search (simple implementation)
  const [debouncedSearch, setDebouncedSearch] = useState('')
  useMemo(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const filteredConversations = useMemo(() => {
    if (!debouncedSearch) return conversations
    const searchLower = debouncedSearch.toLowerCase()
    return conversations.filter(
      (c) =>
        c.participant.display_name?.toLowerCase().includes(searchLower) ||
        c.participant.username?.toLowerCase().includes(searchLower)
    )
  }, [conversations, debouncedSearch])

  // Status filter tabs
  const statusTabs: { value: StatusFilter; label: string; count?: number }[] = [
    { value: 'all', label: 'All', count: summary.total_conversations },
    { value: 'pending', label: 'Pending', count: summary.total_pending },
    { value: 'synced', label: 'Synced' },
  ]

  if (error) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-4 border-b">
          <h2 className="font-semibold">Conversations</h2>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
          <MessageCircle className="h-10 w-10 text-red-500/50 mb-3" />
          <p className="text-sm text-red-600">{error.message || 'Failed to load conversations'}</p>
          <button
            onClick={() => refresh()}
            className="mt-3 text-sm text-primary underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b space-y-3">
        <h2 className="font-semibold text-lg">Skool Inbox</h2>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex gap-1">
          {statusTabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`
                px-3 py-1.5 text-xs font-medium rounded-md transition-colors
                ${
                  statusFilter === tab.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                }
              `}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="ml-1.5 opacity-70">({tab.count})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-center px-4">
            <Inbox className="h-10 w-10 text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">
              {search ? 'No conversations match your search' : 'No conversations yet'}
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {filteredConversations.map((conversation) => (
              <ConversationItem
                key={conversation.conversation_id}
                conversation={conversation}
                isSelected={selectedId === conversation.conversation_id}
                onClick={() => onSelect(conversation.conversation_id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer - Conversation Count */}
      <div className="p-3 border-t bg-muted/30">
        <p className="text-xs text-muted-foreground text-center">
          {summary.total_conversations.toLocaleString()} conversation
          {summary.total_conversations !== 1 ? 's' : ''}
          {summary.total_pending > 0 && (
            <span className="ml-2">
              <Badge variant="outline" className="text-xs py-0">
                {summary.total_pending} pending
              </Badge>
            </span>
          )}
        </p>
      </div>
    </div>
  )
}
