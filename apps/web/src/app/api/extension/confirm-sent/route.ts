import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@0ne/db/server'
import { auth, clerkClient } from '@clerk/nextjs/server'

export const dynamic = 'force-dynamic'

// CORS headers for Chrome extension
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Clerk-User-Id',
}

/**
 * OPTIONS /api/extension/confirm-sent
 * Handle CORS preflight
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders })
}

// =============================================
// Types
// =============================================

interface ConfirmSentRequest {
  messageId: string
  skoolMessageId?: string // The message ID from Skool after sending
  success: boolean
  error?: string
}

interface ConfirmSentResponse {
  success: boolean
  updated: boolean
  error?: string
}

// =============================================
// Auth Helper (Supports both Clerk and API key)
// =============================================

interface AuthResult {
  valid: boolean
  authType: 'clerk' | 'apiKey' | null
  userId?: string
  skoolUserId?: string
  error?: string
}

async function validateExtensionAuth(request: NextRequest): Promise<AuthResult> {
  const authHeader = request.headers.get('authorization')

  if (!authHeader) {
    return { valid: false, authType: null, error: 'Missing Authorization header' }
  }

  // Check for Clerk auth first (Clerk <token>)
  if (authHeader.startsWith('Clerk ')) {
    try {
      const { userId } = await auth()
      if (userId) {
        // Get the linked Skool user ID from Clerk metadata
        const client = await clerkClient()
        const user = await client.users.getUser(userId)
        const skoolUserId = (user.publicMetadata?.skoolUserId as string) || undefined

        return { valid: true, authType: 'clerk', userId, skoolUserId }
      }
      return { valid: false, authType: 'clerk', error: 'Invalid or expired Clerk session' }
    } catch {
      return { valid: false, authType: 'clerk', error: 'Failed to validate Clerk session' }
    }
  }

  // Check for Bearer token (API key)
  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i)
  if (bearerMatch) {
    const expectedKey = process.env.EXTENSION_API_KEY
    if (!expectedKey) {
      console.error('[Extension API] EXTENSION_API_KEY environment variable not set')
      return { valid: false, authType: 'apiKey', error: 'Server configuration error' }
    }

    if (bearerMatch[1] === expectedKey) {
      return { valid: true, authType: 'apiKey' }
    }
    return { valid: false, authType: 'apiKey', error: 'Invalid API key' }
  }

  return { valid: false, authType: null, error: 'Invalid Authorization header format' }
}

// =============================================
// POST /api/extension/confirm-sent
// =============================================

/**
 * Confirm Message Sent
 *
 * Called by the extension after successfully sending a message to Skool.
 * Updates the message status to 'synced' and records the Skool message ID.
 */
export async function POST(request: NextRequest) {
  // Validate auth (supports both Clerk and API key)
  const authResult = await validateExtensionAuth(request)
  if (!authResult.valid) {
    return NextResponse.json(
      { error: authResult.error },
      { status: 401, headers: corsHeaders }
    )
  }

  try {
    const body: ConfirmSentRequest = await request.json()

    // Validate request
    if (!body.messageId) {
      return NextResponse.json(
        { error: 'Missing required field: messageId' },
        { status: 400, headers: corsHeaders }
      )
    }

    if (typeof body.success !== 'boolean') {
      return NextResponse.json(
        { error: 'Missing required field: success (boolean)' },
        { status: 400, headers: corsHeaders }
      )
    }

    console.log(
      `[Extension API] Confirming message ${body.messageId}: success=${body.success}`
    )

    const supabase = createServerClient()

    if (body.success) {
      // Mark message as synced
      const { error: updateError } = await supabase
        .from('dm_messages')
        .update({
          status: 'synced',
          synced_at: new Date().toISOString(),
          // Update skool_message_id if provided (message sent successfully to Skool)
          ...(body.skoolMessageId && { skool_message_id: body.skoolMessageId }),
        })
        .eq('id', body.messageId)

      if (updateError) {
        console.error('[Extension API] Failed to update message status:', updateError)
        return NextResponse.json(
          { success: false, updated: false, error: updateError.message },
          { status: 500, headers: corsHeaders }
        )
      }

      console.log(`[Extension API] Message ${body.messageId} marked as synced`)

      const response: ConfirmSentResponse = {
        success: true,
        updated: true,
      }

      return NextResponse.json(response, { headers: corsHeaders })
    } else {
      // Mark message as failed
      const { error: updateError } = await supabase
        .from('dm_messages')
        .update({
          status: 'failed',
        })
        .eq('id', body.messageId)

      if (updateError) {
        console.error('[Extension API] Failed to update message status:', updateError)
        return NextResponse.json(
          { success: false, updated: false, error: updateError.message },
          { status: 500, headers: corsHeaders }
        )
      }

      console.log(
        `[Extension API] Message ${body.messageId} marked as failed: ${body.error || 'Unknown error'}`
      )

      const response: ConfirmSentResponse = {
        success: true,
        updated: true,
      }

      return NextResponse.json(response, { headers: corsHeaders })
    }
  } catch (error) {
    console.error('[Extension API] POST confirm-sent exception:', error)
    return NextResponse.json(
      {
        success: false,
        updated: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500, headers: corsHeaders }
    )
  }
}
