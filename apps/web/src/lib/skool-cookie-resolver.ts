/**
 * Skool Cookie Resolver
 *
 * Resolves Skool cookies from the best available source:
 * 1. DB (extension-pushed cookies) - always fresh, no redeploy needed
 * 2. Environment variable fallback - SKOOL_COOKIES env var
 *
 * This eliminates the need for Vercel redeploys when cookies rotate,
 * since the Chrome extension pushes fresh cookies to the DB on a recurring alarm.
 */

import { createServerClient } from '@0ne/db/server'
import { decryptCookies, isEncryptionConfigured } from './cookie-encryption'

/**
 * Resolve Skool cookies - DB first (from extension), env var fallback.
 *
 * @param userId - Clerk user ID to look up the staff member's cookies
 * @returns Cookie string for Skool API requests
 */
export async function getSkoolCookies(userId?: string): Promise<string> {
  // Try DB first (extension-pushed cookies are always fresh)
  if (userId && isEncryptionConfigured()) {
    try {
      const cookies = await getDbCookies(userId)
      if (cookies) return cookies
    } catch (error) {
      console.warn('[cookie-resolver] DB lookup failed, falling back to env var:', error)
    }
  }

  // Fallback to env var
  const envCookies = process.env.SKOOL_COOKIES
  if (envCookies) return envCookies

  throw new Error('No Skool cookies available (DB empty, SKOOL_COOKIES env not set)')
}

/**
 * Check if Skool cookies are available from any source
 */
export async function hasSkoolCookies(userId?: string): Promise<boolean> {
  try {
    await getSkoolCookies(userId)
    return true
  } catch {
    return false
  }
}

/**
 * Get cookies for the default staff user (no userId needed).
 * Used by community-wide operations (member sync, analytics, etc.)
 * that don't have a user context.
 */
export async function getSkoolCookiesForDefaultStaff(): Promise<string | null> {
  if (!isEncryptionConfigured()) return null

  try {
    const supabase = createServerClient()

    // Get the most recently updated cookies from any staff member
    const { data: cookieRow } = await supabase
      .from('extension_cookies')
      .select('cookies_encrypted, auth_token_expires_at')
      .order('last_updated', { ascending: false })
      .limit(1)
      .single()

    if (!cookieRow?.cookies_encrypted) return null

    // Check expiry
    if (cookieRow.auth_token_expires_at) {
      const expiresAt = new Date(cookieRow.auth_token_expires_at)
      if (expiresAt < new Date()) return null
    }

    return decryptCookies(cookieRow.cookies_encrypted)
  } catch {
    return null
  }
}

/**
 * Look up extension-pushed cookies from the database.
 * Maps: userId (Clerk) -> staff_users.skool_user_id -> extension_cookies.staff_skool_id
 */
async function getDbCookies(userId: string): Promise<string | null> {
  const supabase = createServerClient()

  // Find the staff user's Skool ID
  const { data: staffUser } = await supabase
    .from('staff_users')
    .select('skool_user_id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('is_default', { ascending: false })
    .limit(1)
    .single()

  if (!staffUser?.skool_user_id) return null

  // Look up the extension-pushed cookies
  const { data: cookieRow } = await supabase
    .from('extension_cookies')
    .select('cookies_encrypted, auth_token_expires_at')
    .eq('staff_skool_id', staffUser.skool_user_id)
    .single()

  if (!cookieRow?.cookies_encrypted) return null

  // Check if auth token has expired
  if (cookieRow.auth_token_expires_at) {
    const expiresAt = new Date(cookieRow.auth_token_expires_at)
    if (expiresAt < new Date()) {
      console.warn('[cookie-resolver] DB cookies expired, falling back to env var')
      return null
    }
  }

  return decryptCookies(cookieRow.cookies_encrypted)
}
