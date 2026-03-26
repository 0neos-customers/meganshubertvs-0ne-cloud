/**
 * Template Configuration
 *
 * Central config for values that each deployment should customize.
 * Set these via environment variables or edit the defaults below.
 *
 * After forking the template:
 * 1. Set these env vars in your Vercel project (or .env.local)
 * 2. Or edit the defaults here directly
 */

/** Display name of the app owner (used in policy pages) */
export const OWNER_NAME = process.env.OWNER_NAME || 'Your Name'

/** Organization / business name (shown in sidebar, policy pages) */
export const ORG_NAME = process.env.NEXT_PUBLIC_ORG_NAME || 'Your Organization'

/** Support email address (shown in policy pages, footer) */
export const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'support@example.com'
