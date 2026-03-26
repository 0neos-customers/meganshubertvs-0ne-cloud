/**
 * Skool Integration Types
 *
 * Type definitions for Skool API responses and database entities.
 */

// =============================================================================
// SKOOL API TYPES (from API responses)
// =============================================================================

/**
 * Survey answer from Skool member profile
 * Can contain email responses!
 */
export interface SkoolSurveyAnswer {
  question: string
  answer: string
  label?: string
  type?: 'email' | 'text' | 'url' | string
}

/**
 * Member data from Skool API (via Next.js data route)
 *
 * Note: The API returns nested data in pageProps.renderData.members
 * Email is stored in member.metadata.mbme (from survey answers)
 */
export interface SkoolApiMember {
  id: string
  name: string // username/slug
  displayName: string
  firstName?: string
  lastName?: string
  bio: string | null
  location: string | null
  bubbleImage: string | null // small profile pic
  profileImage: string | null // large profile pic
  facebook: string | null
  instagram: string | null
  linkedin: string | null
  twitter: string | null
  youtube: string | null
  website: string | null
  createdAt: string // ISO date - when they joined
  lastOffline: string | null // ISO date - last activity
  attrSrc: string | null // attribution source
  spData?: {
    level: number
    points: number
  }
  // Nested member object with metadata (contains email)
  member?: {
    metadata?: {
      mbme?: string // Member email from survey/profile
      aflUser?: string // Affiliate user ID
      aflPctAtJoin?: number
      approvedBy?: string
      attrSrc?: string
      // Survey answers - can contain email responses!
      // Can be JSON string OR already parsed array
      survey?: string | SkoolSurveyAnswer[] | { survey: SkoolSurveyAnswer[] }
      mmbp?: {
        currency?: string
        amount?: number
        recurring_interval?: string
      }
    }
    inviteEmail?: string // Email for admin-invited members (bypasses survey)
    lastOffline?: string
    approvedAt?: string
    billingDeclined?: boolean
    billingCanceled?: boolean
    churned?: string
  }
  // Sometimes email is at top level too
  email?: string
  // Metadata can also be at top level
  metadata?: {
    mbme?: string
    spData?: {
      pts?: number
      lv?: number
    }
  }
}

/**
 * Chat channel (DM conversation) from Skool API
 */
export interface SkoolApiChatChannel {
  id: string
  type: 'user' // DM type
  user: {
    id: string
    name: string
    displayName: string
    image: string | null
  }
  lastMessageAt: string | null
  lastMessagePreview: string | null
  unreadCount: number
}

/**
 * Message from Skool API
 */
export interface SkoolApiMessage {
  id: string
  channelId: string
  senderId: string
  content: string
  createdAt: string
}

/**
 * Group info from Skool API
 */
export interface SkoolApiGroup {
  id: string
  name: string
  slug: string
  description: string | null
  image: string | null
  memberCount: number
  privacy: 'public' | 'private'
}

// =============================================================================
// DATABASE TYPES (match skool.sql schema)
// =============================================================================

/**
 * Database row for skool_members table
 */
export interface SkoolMemberRow {
  id: string
  skool_user_id: string
  skool_username: string | null
  display_name: string | null
  email: string | null
  bio: string | null
  location: string | null
  profile_image: string | null
  social_links: {
    facebook?: string
    instagram?: string
    linkedin?: string
    twitter?: string
    youtube?: string
    website?: string
  }
  group_slug: string
  member_since: string | null
  last_online: string | null
  attribution_source: string | null
  level: number
  points: number
  ghl_contact_id: string | null
  matched_at: string | null
  match_method: 'email' | 'phone' | 'name' | 'manual' | null
  created_at: string
  updated_at: string
}

/**
 * Database row for skool_conversations table
 */
export interface SkoolConversationRow {
  id: string
  skool_channel_id: string
  participant_skool_id: string | null
  participant_name: string | null
  participant_username: string | null
  participant_image: string | null
  last_message_at: string | null
  last_message_preview: string | null
  unread_count: number
  is_archived: boolean
  ghl_conversation_id: string | null
  ghl_synced_at: string | null
  created_at: string
  updated_at: string
}

/**
 * Database row for skool_messages table
 */
export interface SkoolMessageRow {
  id: string
  conversation_id: string
  skool_message_id: string
  sender_skool_id: string
  content: string
  sent_at: string
  is_outbound: boolean
  ghl_synced_at: string | null
  created_at: string
}

/**
 * Database row for skool_hand_raiser_campaigns table
 */
export interface SkoolHandRaiserCampaignRow {
  id: string
  post_url: string
  skool_post_id: string | null
  keyword_filter: string | null
  dm_template: string
  ghl_tag: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

/**
 * Database row for skool_hand_raiser_sent table
 */
export interface SkoolHandRaiserSentRow {
  id: string
  campaign_id: string
  skool_user_id: string
  sent_at: string
}

// =============================================================================
// SYNC TYPES
// =============================================================================

/**
 * Result of a member sync operation
 */
export interface MemberSyncResult {
  success: boolean
  stats: {
    total: number
    inserted: number
    updated: number
    matched: number
    errors: number
  }
  errors?: string[]
}

/**
 * Result of a DM sync operation
 */
export interface DMSyncResult {
  success: boolean
  stats: {
    conversationsTotal: number
    conversationsNew: number
    messagesTotal: number
    messagesNew: number
  }
  errors?: string[]
}

/**
 * Member match result (Skool → GHL)
 */
export interface MemberMatchResult {
  skoolUserId: string
  ghlContactId: string | null
  matchMethod: 'email' | 'name' | 'manual' | null
  confidence: number // 0-1
}

// =============================================================================
// UI TYPES
// =============================================================================

/**
 * Member for display in UI (combined Skool + GHL data)
 */
export interface SkoolMemberDisplay {
  id: string
  skoolUserId: string
  username: string
  displayName: string
  bio: string | null
  location: string | null
  profileImage: string | null
  socialLinks: {
    facebook?: string
    instagram?: string
    linkedin?: string
    twitter?: string
    youtube?: string
    website?: string
  }
  memberSince: Date | null
  lastOnline: Date | null
  level: number
  points: number
  // GHL data
  ghlContactId: string | null
  funnelStage: string | null
  tags: string[]
}

/**
 * Conversation for display in inbox
 */
export interface SkoolConversationDisplay {
  id: string
  channelId: string
  participant: {
    skoolId: string
    name: string
    username: string
    image: string | null
  }
  lastMessageAt: Date | null
  lastMessagePreview: string | null
  unreadCount: number
  isArchived: boolean
}

/**
 * Message for display in thread
 */
export interface SkoolMessageDisplay {
  id: string
  senderId: string
  content: string
  sentAt: Date
  isOutbound: boolean
}

// =============================================================================
// POST TYPES (for community posts)
// =============================================================================

/**
 * Parameters for creating a community post
 */
export interface CreatePostParams {
  /** Group slug (e.g., 'my-community') */
  groupSlug: string
  /** Post title */
  title: string
  /** Post body content (supports markdown) */
  body: string
  /** Skool's internal category/label ID (optional) */
  categoryId?: string
  /** File IDs from uploads (for image attachments) */
  attachmentIds?: string[]
  /** Video URLs (YouTube, Vimeo, Loom) */
  videoLinks?: string[]
}

/**
 * Result from creating a post
 */
export interface CreatePostResult {
  success: boolean
  postId?: string
  postUrl?: string
  error?: string
  rawResponse?: unknown
}

/**
 * Result from uploading a file
 */
export interface UploadResult {
  fileId: string
  url?: string
}

/**
 * Error from upload operation
 */
export interface UploadError {
  error: string
  details?: unknown
}

/**
 * Skool community category/label
 */
export interface SkoolCategory {
  id: string
  name: string
}
