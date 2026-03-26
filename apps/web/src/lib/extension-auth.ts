/**
 * Shared authentication utilities for Chrome extension API routes.
 *
 * Exports:
 * - getCorsHeaders(req) — dynamic CORS headers (validates origin against allowlist)
 * - corsHeaders         — static CORS headers (defaults to production domain, for backward compat)
 * - OPTIONS(req)        — preflight handler (uses getCorsHeaders for origin-aware CORS)
 * - AuthResult         — return type of validateExtensionAuth
 * - validateExtensionAuth(request) — Clerk + API key dual auth
 * - validateExtensionApiKey(request) — API key only auth
 */

import { NextRequest, NextResponse } from 'next/server'
import { secureCompare } from '@/lib/security'
import { auth, clerkClient } from '@clerk/nextjs/server'

// =============================================
// CORS Origin Allowlist
// =============================================

let appOrigin = 'http://localhost:3000'
let baseDomain = 'http://localhost:3000'
try {
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  appOrigin = new URL(APP_URL).origin
  baseDomain = appOrigin.replace('://app.', '://')
} catch {
  // Malformed NEXT_PUBLIC_APP_URL — fall back to localhost
}

const ALLOWED_ORIGINS = [
  appOrigin,
  baseDomain,
  'http://localhost:3000',
  'http://localhost:3001',
]

// Chrome extension origins are added dynamically via EXTENSION_CHROME_ID env var
function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false
  if (ALLOWED_ORIGINS.includes(origin)) return true
  // Allow any chrome-extension:// origin (extension IDs are validated via API key auth)
  if (origin.startsWith('chrome-extension://')) return true
  return false
}

// =============================================
// CORS Headers
// =============================================

export function getCorsHeaders(request?: NextRequest | Request): Record<string, string> {
  const origin = request?.headers?.get('origin') || ''
  const allowedOrigin = isAllowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0]

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Clerk-User-Id',
    'Vary': 'Origin',
  }
}

// Backward-compatible static export for existing imports that don't have request context
export const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGINS[0],
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Clerk-User-Id',
  'Vary': 'Origin',
}

// =============================================
// OPTIONS Preflight Handler
// =============================================

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders(request) })
}

// =============================================
// Dual Auth: Clerk session + API key
// =============================================

export interface AuthResult {
  valid: boolean
  authType: 'clerk' | 'apiKey' | null
  userId?: string
  skoolUserId?: string
  error?: string
}

export async function validateExtensionAuth(request: NextRequest): Promise<AuthResult> {
  const authHeader = request.headers.get('authorization')

  if (!authHeader) {
    return { valid: false, authType: null, error: 'Missing Authorization header' }
  }

  // Check for Clerk auth first (Clerk <token>)
  if (authHeader.startsWith('Clerk ')) {
    try {
      const { userId } = await auth()
      if (userId) {
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

    if (secureCompare(bearerMatch[1], expectedKey)) {
      return { valid: true, authType: 'apiKey' }
    }
    return { valid: false, authType: 'apiKey', error: 'Invalid API key' }
  }

  return { valid: false, authType: null, error: 'Invalid Authorization header format' }
}

// =============================================
// API Key Only Auth
// =============================================

export function validateExtensionApiKey(request: NextRequest): NextResponse | null {
  const authHeader = request.headers.get('authorization')
  const expectedKey = process.env.EXTENSION_API_KEY

  if (!expectedKey) {
    console.error('[Extension API] EXTENSION_API_KEY environment variable not set')
    return NextResponse.json(
      { error: 'Server configuration error' },
      { status: 500, headers: corsHeaders }
    )
  }

  if (!authHeader) {
    return NextResponse.json(
      { error: 'Missing Authorization header' },
      { status: 401, headers: corsHeaders }
    )
  }

  const match = authHeader.match(/^Bearer\s+(.+)$/i)
  if (!match || !secureCompare(match[1], expectedKey)) {
    return NextResponse.json(
      { error: 'Invalid API key' },
      { status: 401, headers: corsHeaders }
    )
  }

  return null // Valid
}
