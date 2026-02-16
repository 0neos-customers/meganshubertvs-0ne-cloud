'use client'

/**
 * Skool Inbox Page
 *
 * iMessage-style inbox UI for viewing and responding to Skool DM conversations.
 * Messages sent from here are queued for the Chrome extension to deliver.
 */

import { useState, useEffect } from 'react'
import { MessageSquare, Inbox } from 'lucide-react'
import { ConversationList } from '@/features/dm-sync/components/ConversationList'
import { ConversationDetail } from '@/features/dm-sync/components/ConversationDetail'

// =============================================================================
// CONSTANTS
// =============================================================================

// Jimmy's Skool user ID - used for sending outbound messages
// TODO: Get this from staff_users table or settings
const DEFAULT_STAFF_SKOOL_ID = process.env.NEXT_PUBLIC_STAFF_SKOOL_ID || ''

// =============================================================================
// COMPONENTS
// =============================================================================

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8">
      <div className="rounded-full bg-muted p-4 mb-4">
        <MessageSquare className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="font-semibold text-lg mb-2">Select a Conversation</h3>
      <p className="text-sm text-muted-foreground max-w-xs">
        Choose a conversation from the list to view messages and send replies
      </p>
    </div>
  )
}

// =============================================================================
// MAIN PAGE
// =============================================================================

export default function InboxPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [staffSkoolId, setStaffSkoolId] = useState<string>(DEFAULT_STAFF_SKOOL_ID)

  // Fetch default staff user's Skool ID
  useEffect(() => {
    async function fetchDefaultStaff() {
      try {
        const response = await fetch('/api/settings/staff-users')
        if (response.ok) {
          const data = await response.json()
          const defaultStaff = data.data?.find((s: { is_default: boolean }) => s.is_default)
          if (defaultStaff?.skool_user_id) {
            setStaffSkoolId(defaultStaff.skool_user_id)
          }
        }
      } catch (error) {
        console.error('[Inbox] Failed to fetch default staff:', error)
      }
    }

    if (!DEFAULT_STAFF_SKOOL_ID) {
      fetchDefaultStaff()
    }
  }, [])

  return (
    <div className="h-[calc(100vh-64px)] flex bg-gray-50">
      {/* Left Panel: Conversation List */}
      <div className="w-80 border-r bg-white flex flex-col shadow-sm">
        <ConversationList
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      </div>

      {/* Right Panel: Conversation Detail or Empty State */}
      <div className="flex-1 flex flex-col">
        {selectedId ? (
          <ConversationDetail
            conversationId={selectedId}
            staffSkoolId={staffSkoolId || undefined}
          />
        ) : (
          <EmptyState />
        )}
      </div>
    </div>
  )
}
