'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

interface NavItem { href: string; label: string }
function getNavItems(): NavItem[] {
  return [
    { href: '/dashboard', label: 'My Carousels' },
    { href: '/generate', label: 'New Carousel' },
    { href: '/templates', label: 'Templates' },
    { href: '/settings', label: 'Settings' },
  ]
}

// Auth-gate loading state
function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center" data-testid="auth-loading">
      <Skeleton className="h-8 w-32" />
    </div>
  )
}

interface SidebarProps { pathname: string; onLogout: () => void }
function Sidebar({ pathname, onLogout }: SidebarProps) {
  const items = getNavItems()
  return (
    <aside className="w-56 border-r border-zinc-800 flex flex-col p-4 gap-1" data-testid="sidebar">
      <p className="text-xs text-zinc-500 uppercase tracking-widest mb-4 px-2">Carousel Gen</p>
      {items.map(item => (
        <Link key={item.href} href={item.href}>
          <Button
            variant={pathname === item.href ? 'secondary' : 'ghost'}
            className="w-full justify-start"
            size="sm"
            data-testid={`nav-${item.href.replace('/', '')}`}
          >
            {item.label}
          </Button>
        </Link>
      ))}
      <div className="flex-1" />
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start text-zinc-500"
        onClick={onLogout}
        data-testid="sign-out-button"
      >
        Sign out
      </Button>
    </aside>
  )
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isInitialized, logout } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (isInitialized && user === null) { router.replace('/login') }
  }, [user, isInitialized, router])

  if (!isInitialized || user === null) { return <LoadingScreen /> }

  return (
    <div className="flex min-h-screen" data-testid="app-shell">
      <Sidebar pathname={pathname} onLogout={logout} />
      <main className="flex-1 overflow-auto" data-testid="main-content">{children}</main>
    </div>
  )
}
