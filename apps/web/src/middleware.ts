/**
 * Edge middleware — Better Auth session gate + domain routing.
 *
 * Replaces the old Clerk middleware. This file:
 *   1. Handles marketing-site rewrites for the control plane root domain.
 *   2. Bounces unauthenticated requests on protected routes to /sign-in.
 *   3. Lets public routes (sign-in, sign-up, etc.) through.
 *
 * Membership/organization checks are handled in server components and route
 * handlers — middleware only verifies the session cookie exists and is
 * non-expired (cheap, no DB call). Better Auth's `getCookie` helper validates
 * the cookie format without full session validation.
 *
 * The legacy publicMetadata.instances[slug] namespacing fix is gone — see
 * the PRD for context.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSessionCookie } from 'better-auth/cookies'

// Marketing site paths served on the canonical root domain
const MARKETING_PATHS = ['/', '/install', '/diy-install', '/download', '/privacy', '/pricing', '/migrate', '/skills', '/preview']

// Derive the app's own hostname from NEXT_PUBLIC_APP_URL (set per-tenant by orchestrator)
const APP_HOST = process.env.NEXT_PUBLIC_APP_URL
  ? new URL(process.env.NEXT_PUBLIC_APP_URL).host
  : 'app.0neos.com'

function handleDomainRouting(request: NextRequest): NextResponse | null {
  const hostname = request.headers.get('host') || ''
  const { pathname } = request.nextUrl

  // This app's own domain — serve normally, no rewriting needed
  if (hostname === APP_HOST) {
    return null
  }

  // Control plane marketing domain routing (only on the control plane instance)
  if (APP_HOST === 'app.0neos.com') {
    if (hostname === '0neos.com' || hostname === 'www.0neos.com') {
      // API routes pass through (download API, etc.)
      if (pathname.startsWith('/api/')) {
        return NextResponse.next()
      }
      // Marketing paths get rewritten to /site/*
      if (MARKETING_PATHS.includes(pathname) || pathname.startsWith('/site')) {
        if (pathname.startsWith('/site')) {
          return NextResponse.next()
        }
        const url = request.nextUrl.clone()
        url.pathname = `/site${pathname === '/' ? '' : pathname}`
        return NextResponse.rewrite(url)
      }
      // Non-marketing paths on root domain → redirect to app subdomain
      const url = request.nextUrl.clone()
      url.host = 'app.0neos.com'
      return NextResponse.redirect(url, 307)
    }

    // ALL other domains on control plane → 301 permanent redirect to 0neos.com
    if (hostname !== 'localhost' && hostname !== 'localhost:3000') {
      const url = request.nextUrl.clone()
      url.host = '0neos.com'
      url.port = ''
      return NextResponse.redirect(url, 301)
    }
  }

  // Tenant instances: any hostname is fine (Vercel handles routing)
  return null
}

// Public routes that bypass the auth gate.
const PUBLIC_PATTERNS: (string | RegExp)[] = [
  '/sign-in',
  '/sign-up',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/accept-invite',
  '/request-access',
  '/privacy',
  '/security-policy',
  '/access-control',
  '/unauthorized',
  '/subscription-required',
  /^\/site(\/|$)/,
  /^\/embed(\/|$)/,
  /^\/api\/auth(\/|$)/,
  /^\/api\/public(\/|$)/,
  /^\/api\/cron(\/|$)/,
  /^\/api\/download(\/|$)/,
  /^\/api\/external(\/|$)/,
  /^\/api\/extension(\/|$)/,
  /^\/api\/webhooks(\/|$)/,
  '/api/billing/webhooks',
  /^\/api\/widget(\/|$)/,
  '/api/admin/invites/validate',
  /^\/api\/migrate\/validate/,
  '/api/health',
  '/api/supdate/check',
  '/api/skills/registry',
  '/api/skills/marketplace.json',
  /^\/api\/skills\/[^/]+\/download/,
  /^\/api\/marketplace(\/|$)/,
]

function isPublic(pathname: string): boolean {
  for (const p of PUBLIC_PATTERNS) {
    if (typeof p === 'string') {
      if (pathname === p || pathname.startsWith(p + '/')) return true
    } else if (p.test(pathname)) {
      return true
    }
  }
  return false
}

/**
 * OAuth origin cookie — routes Google OAuth responses back to this
 * instance through the control plane catch-all at
 * `app.0neos.com/api/oauth/google/callback`.
 *
 * The control plane reads this cookie (which is scoped to the whole
 * `.0neos.com` parent domain, so it's visible from any subdomain) to
 * know which instance subdomain to 302 back to after Google returns.
 *
 * Set here before Better Auth's social sign-in handler runs. Better Auth
 * then redirects to Google, Google redirects to the control plane, the
 * control plane reads this cookie, and the browser is sent back to
 * `{slug}.0neos.com/api/auth/callback/google?code=...&state=...`.
 *
 * No shared secret — just a routing hint. The Better Auth `state` param
 * still provides CSRF end-to-end.
 */
function injectOAuthOriginCookie(response: NextResponse): NextResponse {
  const slug = process.env.NEXT_PUBLIC_INSTANCE_SLUG
  if (!slug) return response
  response.cookies.set('0ne-oauth-origin', slug, {
    domain: '.0neos.com',
    path: '/',
    secure: true,
    sameSite: 'lax',
    maxAge: 600, // 10 minutes — enough to complete a Google round-trip
    httpOnly: false, // not a secret, just a routing hint
  })
  return response
}

export default function middleware(request: NextRequest) {
  // Domain routing for marketing site / cross-domain redirects
  const domainResponse = handleDomainRouting(request)
  if (domainResponse) return domainResponse

  const { pathname } = request.nextUrl

  // OAuth sign-in initiation: set the origin cookie before Better Auth
  // redirects to the external provider. Matches `/api/auth/sign-in/social/*`
  // and `/api/auth/callback/*` (the latter doesn't strictly need it, but
  // belt-and-suspenders in case of retries).
  if (pathname.startsWith('/api/auth/sign-in/social')) {
    return injectOAuthOriginCookie(NextResponse.next())
  }

  if (isPublic(pathname)) {
    return NextResponse.next()
  }

  // Better Auth cookie check — fast path, no DB roundtrip.
  const sessionCookie = getSessionCookie(request)
  if (!sessionCookie) {
    const signInUrl = new URL('/sign-in', request.url)
    if (pathname !== '/') {
      signInUrl.searchParams.set('next', pathname)
    }
    return NextResponse.redirect(signInUrl)
  }

  // Authenticated requests fall through. Server components and route
  // handlers do the deep org-membership / role checks via auth.api.getSession.
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
