/**
 * POST /api/extension/push-categories
 *
 * Receives category data fetched by the Chrome extension from Skool
 * and upserts them into the skool_categories cache table.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { createServerClient } from '@0ne/db/server'

export const dynamic = 'force-dynamic'

// CORS headers for Chrome extension
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Clerk-User-Id',
}

/**
 * OPTIONS /api/extension/push-categories
 * Handle CORS preflight
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders })
}

// =============================================
// Types
// =============================================

interface PushCategoriesRequest {
  groupSlug: string
  categories: Array<{
    id: string
    name: string
    position: number
  }>
}

interface PushCategoriesResponse {
  success: boolean
  count: number
  error?: string
}

// =============================================
// Auth Helper (Supports both Clerk and API key)
// =============================================

interface AuthResult {
  valid: boolean
  authType: 'clerk' | 'apiKey' | null
  userId?: string
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
        return { valid: true, authType: 'clerk', userId }
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
// POST /api/extension/push-categories
// =============================================

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
    const body: PushCategoriesRequest = await request.json()

    // Validate request
    if (!body.groupSlug?.trim()) {
      return NextResponse.json(
        { error: 'Missing required field: groupSlug' },
        { status: 400, headers: corsHeaders }
      )
    }

    if (!Array.isArray(body.categories) || body.categories.length === 0) {
      return NextResponse.json(
        { error: 'categories must be a non-empty array' },
        { status: 400, headers: corsHeaders }
      )
    }

    console.log(
      `[Extension API] Received ${body.categories.length} categories for group "${body.groupSlug}"`
    )

    const supabase = createServerClient()
    const now = new Date().toISOString()

    // Delete existing categories for this group, then insert fresh
    const { error: deleteError } = await supabase
      .from('skool_categories')
      .delete()
      .eq('group_slug', body.groupSlug)

    if (deleteError) {
      console.error('[Extension API] Failed to clear old categories:', deleteError)
    }

    // Insert new categories
    const rows = body.categories.map((c, index) => ({
      group_slug: body.groupSlug,
      skool_id: c.id,
      name: c.name,
      position: c.position ?? index,
      fetched_at: now,
    }))

    const { error: insertError } = await supabase
      .from('skool_categories')
      .insert(rows)

    if (insertError) {
      console.error('[Extension API] Failed to insert categories:', insertError)
      return NextResponse.json(
        { success: false, count: 0, error: insertError.message } as PushCategoriesResponse,
        { status: 500, headers: corsHeaders }
      )
    }

    console.log(
      `[Extension API] Saved ${body.categories.length} categories for "${body.groupSlug}"`
    )

    const response: PushCategoriesResponse = {
      success: true,
      count: body.categories.length,
    }

    return NextResponse.json(response, { headers: corsHeaders })
  } catch (error) {
    console.error('[Extension API] POST push-categories exception:', error)
    return NextResponse.json(
      {
        success: false,
        count: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      } as PushCategoriesResponse,
      { status: 500, headers: corsHeaders }
    )
  }
}
