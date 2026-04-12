'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'
import { cn } from '@0ne/ui'
import {
  Home,
  LogOut,
  Settings,
  Rocket,
  type LucideIcon
} from 'lucide-react'
import { useSidebar } from './SidebarContext'
import { ThemeToggle } from './ThemeToggle'
// ORG_NAME removed — replaced by Sign Out link in sidebar user section

export interface NavItem {
  name: string
  href: string
  icon: LucideIcon
}

interface SidebarProps {
  navigation?: NavItem[]
}

const defaultNavigation: NavItem[] = [
  { name: 'Home', href: '/', icon: Home },
]

const accountNavigation: NavItem[] = [
  { name: 'Settings', href: '/settings', icon: Settings },
]

export function Sidebar({ navigation }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { isOpen, toggle } = useSidebar()
  const { data: session } = authClient.useSession()
  const user = session?.user

  const handleSignOut = async () => {
    await authClient.signOut()
    router.push('/sign-in')
    router.refresh()
  }

  // Onboarding "Get Started" page dismiss state was previously stored in
  // Clerk publicMetadata. Better Auth doesn't ship a per-user metadata bag —
  // we now show the Get Started link to everyone. Customers can hide it via
  // their fork if they want.
  const isDismissed = false

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  const renderNavItem = (item: NavItem) => {
    const active = isActive(item.href)

    return (
      <div key={item.name}>
        <Link
          href={item.href}
          className={cn(
            'flex flex-1 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
            active
              ? 'bg-sidebar-accent text-sidebar-accent-foreground'
              : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
          )}
        >
          <item.icon className={cn(
            'h-5 w-5',
            active ? 'text-sidebar-primary' : 'text-sidebar-primary/70'
          )} />
          {item.name}
        </Link>
      </div>
    )
  }

  return (
    <>
      {/* Toggle Button - Shows "O" when closed (in main area), hidden when open (logo in sidebar is clickable) */}
      {!isOpen && (
        <button
          onClick={toggle}
          className="fixed top-4 left-4 z-50 flex items-center justify-center text-primary hover:opacity-80"
          aria-label="Open navigation"
        >
          <span className="font-heading text-2xl font-bold italic">O</span>
        </button>
      )}

      {/* Backdrop for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/20 backdrop-blur-sm lg:hidden"
          onClick={toggle}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-60 flex-col bg-sidebar transition-transform duration-200 ease-in-out',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo header - entire area clickable to collapse */}
        <button
          onClick={toggle}
          className="flex h-16 w-full items-center justify-between px-6 hover:bg-sidebar-accent/50 transition-colors"
          aria-label="Close navigation"
        >
          <span className="font-heading text-2xl font-bold italic text-sidebar-primary">
            One
          </span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-sidebar-foreground/70"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        {/* User Info + Sign Out */}
        <div className="border-b border-sidebar-border px-4 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary font-semibold text-base">
              {(user?.name || user?.email || '?').charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                {user?.name || 'User'}
              </p>
              <button
                type="button"
                onClick={handleSignOut}
                className="flex items-center gap-1.5 text-xs text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors"
              >
                <LogOut className="h-3 w-3" />
                Sign Out
              </button>
            </div>
          </div>
        </div>

        {/* Main Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {/* Get Started - only when not dismissed */}
          {!isDismissed && (
            <div className="mb-4">
              <Link
                href="/get-started"
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors',
                  pathname === '/get-started'
                    ? 'bg-[#FF692D] text-white'
                    : 'bg-[#FF692D]/10 text-[#FF692D] hover:bg-[#FF692D]/20'
                )}
              >
                <Rocket className="h-4 w-4" />
                Get Started
              </Link>
            </div>
          )}

          {/* Home */}
          <div className="space-y-1">
            {defaultNavigation.map(item => renderNavItem(item))}
          </div>
        </nav>

        {/* Bottom Section */}
        <div className="border-t border-sidebar-border p-3">
          {/* ACCOUNT Section */}
          <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
            Account
          </p>
          <div className="space-y-1">
            {accountNavigation.map(item => renderNavItem(item))}
          </div>

          {/* Theme Toggle */}
          <div className="mt-3 flex items-center justify-between px-3">
            <span className="text-xs text-sidebar-foreground/60">Theme</span>
            <ThemeToggle />
          </div>
        </div>
      </aside>
    </>
  )
}
