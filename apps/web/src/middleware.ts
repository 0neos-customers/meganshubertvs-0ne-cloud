import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { canAccessApp, type AppId } from '@0ne/auth/permissions'

// Marketing site paths served on the canonical root domain
const MARKETING_PATHS = ['/', '/install', '/diy-install', '/download', '/privacy']

// Domain routing configuration — set NEXT_PUBLIC_APP_URL to match your deployment.
// Assumes app.{domain} subdomain convention for split marketing/app routing.
// For single-domain deployments (e.g., my-app.vercel.app), marketing routes are unused.
let APP_HOSTNAME = 'localhost'
let ROOT_DOMAIN = 'localhost'
try {
  APP_HOSTNAME = new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').hostname
  ROOT_DOMAIN = APP_HOSTNAME.replace(/^app\./, '')
} catch {
  // Malformed NEXT_PUBLIC_APP_URL — fall back to localhost (no domain routing)
}

function handleDomainRouting(request: NextRequest): NextResponse | null {
  const hostname = request.headers.get('host')?.split(':')[0] || ''
  const { pathname } = request.nextUrl

  // App subdomain — serve the app, no rewriting needed
  if (hostname === APP_HOSTNAME) {
    return null
  }

  // Root domain — canonical marketing domain
  if (hostname === ROOT_DOMAIN || hostname === `www.${ROOT_DOMAIN}`) {
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
    url.host = APP_HOSTNAME
    return NextResponse.redirect(url, 307)
  }

  // ALL other domains → 301 permanent redirect to root domain
  if (hostname !== 'localhost') {
    const url = request.nextUrl.clone()
    url.host = ROOT_DOMAIN
    url.port = ''
    return NextResponse.redirect(url, 301)
  }

  return null
}

const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/request-access',
  '/embed(.*)',
  '/privacy',
  '/security-policy',
  '/access-control',
  '/site(.*)', // Marketing site pages (no auth)
  '/api/public(.*)',
  '/api/cron(.*)',
  '/api/download(.*)', // Marketing site download API (token auth)
  '/api/external(.*)', // External API uses API key auth
  '/api/extension(.*)', // Chrome extension uses API key auth
  '/api/auth(.*)', // OAuth callbacks
  '/api/webhooks(.*)', // Webhooks from external services
  '/api/widget(.*)', // Widget API uses its own token auth
  '/api/admin/invites/validate', // Invite validation (pre-auth)
])

const appRoutes: Record<string, AppId> = {
  '/kpi': 'kpi',
  '/prospector': 'prospector',
  '/skool-sync': 'skoolSync',
  '/skool': 'skoolScheduler',
  '/media': 'ghlMedia',
}

export default clerkMiddleware(async (auth, request) => {
  // Handle domain routing (marketing site rewrites, redirects)
  const domainResponse = handleDomainRouting(request)
  if (domainResponse) return domainResponse

  const { pathname } = request.nextUrl

  if (isPublicRoute(request)) {
    return NextResponse.next()
  }

  const { userId, sessionClaims } = await auth.protect()

  // Onboarding redirect: if user hasn't completed onboarding, send them there
  const skipOnboardingCheck =
    pathname.startsWith('/api/') ||
    pathname.startsWith('/onboarding') ||
    pathname.startsWith('/sign-out')

  if (!skipOnboardingCheck) {
    const metadata = sessionClaims?.metadata as { onboardingComplete?: boolean; permissions?: { isAdmin?: boolean } } | undefined
    const isAdmin = metadata?.permissions?.isAdmin === true
    // Admins without onboardingComplete are treated as complete (existing users)
    if (!metadata?.onboardingComplete && !isAdmin) {
      return NextResponse.redirect(new URL('/onboarding', request.url))
    }
  }

  for (const [route, appId] of Object.entries(appRoutes)) {
    if (pathname.startsWith(route)) {
      const hasAccess = await canAccessApp(userId, appId)
      if (!hasAccess) {
        return NextResponse.redirect(new URL('/unauthorized', request.url))
      }
    }
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
