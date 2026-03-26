/**
 * DM Sync Engine
 *
 * Syncs extension-captured Skool DMs to GHL conversations.
 * Server-side Skool API calls are no longer used (AWS WAF blocks them).
 * The Chrome extension captures messages and pushes them to this app.
 *
 * @module dm-sync/lib/sync-engine
 */

import { db, eq, and, asc, isNull } from '@0ne/db/server'
import { dmMessages, dmSyncConfig, dmHandRaiserCampaigns } from '@0ne/db/server'
import type {
  DmSyncConfig,
  SkoolConversation,
} from '../types'
import { findOrCreateGhlContact } from './contact-mapper'
import {
  GhlConversationProviderClient,
  createGhlConversationProviderClientWithPersistence,
} from './ghl-conversation'
import { getStoredTokens } from './ghl-token-store'
import {
  getStaffBySkoolId,
  formatInboundMessage,
  formatOutboundMessage,
} from './staff-users'

// =============================================================================
// CONFIGURATION
// =============================================================================

/** Rate limit delay between API requests (ms) */
const REQUEST_DELAY_MS = 200

// =============================================================================
// RESULT TYPES
// =============================================================================

/**
 * Result from extension message sync operation
 */
export interface ExtensionSyncResult {
  synced: number
  skipped: number
  errors: number
  errorDetails: Array<{
    messageId?: string
    conversationId?: string
    error: string
  }>
}

// =============================================================================
// SYNC ENGINE CONFIGURATION
// =============================================================================

/**
 * Sync engine configuration
 */
export interface SyncEngineConfig {
  config: DmSyncConfig
  skoolCookies: string
  ghlApiKey: string
}

/**
 * Sync options
 */
export interface SyncOptions {
  /** Maximum conversations to sync per run */
  maxConversations?: number
  /** Maximum messages per conversation */
  maxMessagesPerConversation?: number
  /** Sync only conversations with new messages since this date */
  since?: Date
  /** Dry run - don't actually send/store anything */
  dryRun?: boolean
}

// =============================================================================
// EXTENSION MESSAGE SYNC
// =============================================================================

/**
 * Group array items by a key
 */
function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
  return array.reduce(
    (result, item) => {
      const groupKey = String(item[key])
      if (!result[groupKey]) {
        result[groupKey] = []
      }
      result[groupKey].push(item)
      return result
    },
    {} as Record<string, T[]>
  )
}

/**
 * Sync extension-captured messages to GHL
 *
 * Processes messages in dm_messages that have ghl_message_id = NULL
 * These are messages captured by the Chrome extension that haven't
 * been pushed to GHL yet.
 *
 * @param userId - The user ID for multi-tenant support
 * @returns ExtensionSyncResult with counts
 */
export async function syncExtensionMessages(
  userId: string
): Promise<ExtensionSyncResult> {
  const result: ExtensionSyncResult = {
    synced: 0,
    skipped: 0,
    errors: 0,
    errorDetails: [],
  }

  console.log(`[Sync Engine] Starting extension message sync for user: ${userId}`)

  try {
    // 1. Get user's sync config
    const [syncConfig] = await db.select().from(dmSyncConfig)
      .where(and(eq(dmSyncConfig.clerkUserId, userId), eq(dmSyncConfig.enabled, true)))
      .limit(1)

    if (!syncConfig) {
      console.log(`[Sync Engine] No enabled sync config for user: ${userId}`)
      return result
    }

    // 2. Get stored GHL tokens
    const storedTokens = await getStoredTokens(userId)

    // 3. Create GHL client with persistence
    const ghlClient = await createGhlConversationProviderClientWithPersistence(
      userId,
      syncConfig.ghlLocationId!,
      process.env.GHL_CONVERSATION_PROVIDER_ID?.trim(),
      storedTokens
        ? {
            refreshToken: storedTokens.refreshToken,
            accessToken: storedTokens.accessToken,
            expiresAt: storedTokens.expiresAt,
          }
        : undefined
    )

    // 4. Query messages with ghl_message_id IS NULL AND status = 'pending'
    // These are extension-captured messages that need to be synced to GHL
    const pendingMessages = await db.select().from(dmMessages)
      .where(and(
        eq(dmMessages.clerkUserId, userId),
        eq(dmMessages.status, 'pending'),
        isNull(dmMessages.ghlMessageId)
      ))
      .orderBy(asc(dmMessages.createdAt))
      .limit(100) // Process up to 100 messages per run

    if (pendingMessages.length === 0) {
      console.log('[Sync Engine] No extension messages to sync')
      return result
    }

    console.log(
      `[Sync Engine] Found ${pendingMessages.length} extension messages to sync`
    )

    // 5. Group by conversation for efficient contact lookup
    const messagesByConversation = groupBy(
      pendingMessages,
      'skoolConversationId'
    )

    // 6. Process each conversation
    for (const [conversationId, messages] of Object.entries(messagesByConversation)) {
      // Get the first message to extract skoolUserId for contact lookup
      const firstMessage = messages[0]
      const skoolUserId = firstMessage.skoolUserId || ''

      try {
        // Find/create GHL contact for this Skool user
        const contactResult = await findOrCreateGhlContact(
          userId,
          skoolUserId,
          '', // We don't have username from the message
          ''  // We don't have displayName from the message
        )

        if (!contactResult.ghlContactId) {
          console.log(
            `[Sync Engine] Could not find/create GHL contact for Skool user ${skoolUserId}, skipping conversation`
          )
          result.skipped += messages.length
          continue
        }

        const ghlContactId = contactResult.ghlContactId

        // Process each message in this conversation
        for (const message of messages) {
          try {
            // Skip messages with no content
            const messageContent = message.messageText || ''
            if (!messageContent.trim()) {
              console.log(
                `[Sync Engine] Skipping empty extension message ${message.id}`
              )
              result.skipped++
              continue
            }

            // Phase 5: Get staff info for message attribution
            let formattedContent = messageContent
            let staffInfo: { skoolUserId: string; displayName: string } | null = null

            // Check if message already has staff attribution
            if (message.staffSkoolId && message.staffDisplayName) {
              staffInfo = {
                skoolUserId: message.staffSkoolId,
                displayName: message.staffDisplayName,
              }
            } else {
              // Try to look up staff by the sender's Skool ID
              const staffUser = await getStaffBySkoolId(
                message.direction === 'outbound' ? userId : (message.skoolUserId || '')
              )
              if (staffUser) {
                staffInfo = {
                  skoolUserId: staffUser.skoolUserId,
                  displayName: staffUser.displayName,
                }
              }
            }

            // Format message with staff prefix
            if (staffInfo) {
              if (message.direction === 'outbound') {
                formattedContent = formatOutboundMessage(
                  staffInfo.displayName,
                  messageContent
                )
              } else {
                // For inbound, use sender_name if available
                const senderName = message.senderName || 'Contact'
                formattedContent = formatInboundMessage(
                  senderName,
                  staffInfo.displayName,
                  messageContent
                )
              }
            }

            // Push to GHL using appropriate endpoint based on direction
            let ghlMessageId: string

            if (message.direction === 'outbound') {
              // Outbound message (from staff to contact) - appears on RIGHT side in GHL
              console.log(
                `[Sync Engine] Syncing extension outbound: ${message.id} (staff: ${staffInfo?.displayName || 'none'})`
              )
              ghlMessageId = await ghlClient.pushOutboundMessage(
                syncConfig.ghlLocationId!,
                ghlContactId,
                skoolUserId,
                formattedContent,
                message.skoolMessageId!
              )
            } else {
              // Inbound message (from contact to staff) - appears on LEFT side in GHL
              console.log(
                `[Sync Engine] Syncing extension inbound: ${message.id} (staff: ${staffInfo?.displayName || 'none'})`
              )
              ghlMessageId = await ghlClient.pushInboundMessage(
                syncConfig.ghlLocationId!,
                ghlContactId,
                skoolUserId,
                formattedContent,
                message.skoolMessageId!
              )
            }

            // Update row with ghl_message_id, status='synced', synced_at, and staff info
            try {
              await db.update(dmMessages)
                .set({
                  ghlMessageId: ghlMessageId,
                  status: 'synced',
                  syncedAt: new Date(),
                  // Phase 5: Update staff attribution if we resolved it
                  ...(staffInfo && !message.staffSkoolId
                    ? {
                        staffSkoolId: staffInfo.skoolUserId,
                        staffDisplayName: staffInfo.displayName,
                      }
                    : {}),
                })
                .where(eq(dmMessages.id, message.id))
            } catch (updateError) {
              throw new Error(
                `Failed to update message status: ${String(updateError)}`
              )
            }

            result.synced++
            console.log(
              `[Sync Engine] Synced extension message ${message.id} -> ${ghlMessageId}`
            )

            // Rate limiting
            await delay(REQUEST_DELAY_MS)
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : String(error)
            console.error(
              `[Sync Engine] Error syncing extension message ${message.id}:`,
              errorMessage
            )
            result.errors++
            result.errorDetails.push({
              messageId: message.id,
              conversationId,
              error: errorMessage,
            })

            // Mark message as failed
            await db.update(dmMessages)
              .set({ status: 'failed' })
              .where(eq(dmMessages.id, message.id))
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error(
          `[Sync Engine] Error processing extension conversation ${conversationId}:`,
          errorMessage
        )
        result.errors += messages.length
        result.errorDetails.push({
          conversationId,
          error: errorMessage,
        })
      }
    }

    console.log(
      `[Sync Engine] Extension sync complete: synced=${result.synced}, skipped=${result.skipped}, errors=${result.errors}`
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(
      '[Sync Engine] Fatal error during extension sync:',
      errorMessage
    )
    result.errors++
    result.errorDetails.push({
      error: `Fatal sync error: ${errorMessage}`,
    })
  }

  return result
}

// =============================================================================
// QUERY HELPERS
// =============================================================================

/**
 * Get all users with active hand-raiser campaigns
 */
export async function getUsersWithActiveHandRaisers(): Promise<
  Array<{ clerk_user_id: string }>
> {
  try {
    const data = await db.select({ clerkUserId: dmHandRaiserCampaigns.clerkUserId })
      .from(dmHandRaiserCampaigns)
      .where(eq(dmHandRaiserCampaigns.isActive, true))

    // Deduplicate user IDs
    const uniqueUserIds = [...new Set(data.map((d) => d.clerkUserId).filter(Boolean))]
    return uniqueUserIds.map((clerk_user_id) => ({ clerk_user_id: clerk_user_id! }))
  } catch (error) {
    console.error('[Sync Engine] Error fetching hand-raiser users:', String(error))
    return []
  }
}

/**
 * Get all enabled sync configs for cron processing
 */
export async function getEnabledSyncConfigs(): Promise<
  Array<{ clerk_user_id: string; skool_community_slug: string; ghl_location_id: string }>
> {
  try {
    const data = await db.select({
      clerkUserId: dmSyncConfig.clerkUserId,
      skoolCommunitySlug: dmSyncConfig.skoolCommunitySlug,
      ghlLocationId: dmSyncConfig.ghlLocationId,
    }).from(dmSyncConfig)
      .where(eq(dmSyncConfig.enabled, true))

    return data.map((d) => ({
      clerk_user_id: d.clerkUserId || '',
      skool_community_slug: d.skoolCommunitySlug || '',
      ghl_location_id: d.ghlLocationId || '',
    }))
  } catch (error) {
    console.error('[Sync Engine] Error fetching sync configs:', String(error))
    return []
  }
}

// =============================================================================
// SYNC UTILITIES
// =============================================================================

/**
 * Delay helper for rate limiting
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Determine if conversation needs syncing
 */
export function needsSync(
  conversation: SkoolConversation,
  lastSyncAt: Date | null
): boolean {
  if (!lastSyncAt) return true
  if (!conversation.lastMessageAt) return false
  return conversation.lastMessageAt > lastSyncAt
}

/**
 * Calculate sync priority for a conversation
 */
export function calculateSyncPriority(
  conversation: SkoolConversation
): number {
  let priority = 0

  // Higher priority for unread messages
  if (conversation.unreadCount > 0) {
    priority += 100 + Math.min(conversation.unreadCount, 50)
  }

  // Higher priority for recent messages
  if (conversation.lastMessageAt) {
    const hoursSinceLastMessage =
      (Date.now() - conversation.lastMessageAt.getTime()) / (1000 * 60 * 60)
    if (hoursSinceLastMessage < 1) priority += 50
    else if (hoursSinceLastMessage < 24) priority += 25
    else if (hoursSinceLastMessage < 72) priority += 10
  }

  return priority
}

/**
 * Sort conversations by sync priority
 */
export function sortBySyncPriority(
  conversations: SkoolConversation[]
): SkoolConversation[] {
  return [...conversations].sort(
    (a, b) => calculateSyncPriority(b) - calculateSyncPriority(a)
  )
}
