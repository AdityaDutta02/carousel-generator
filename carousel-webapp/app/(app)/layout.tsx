'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { Skeleton } from '@/components/ui/skeleton'
import {
  LayoutGrid,
  Sparkles,
  PanelLeft,
  Settings,
  LogOut,
} from 'lucide-react'

interface NavItem { href: string; label: string; icon: React.ReactNode }
function getNavItems(): NavItem[] {
  return [
    { href: '/dashboard', label: 'My Carousels', icon: <LayoutGrid size={16} /> },
    { href: '/generate', label: 'New Carousel', icon: <Sparkles size={16} /> },
    { href: '/templates', label: 'Templates', icon: <PanelLeft size={16} /> },
    { href: '/settings', label: 'Settings', icon: <Settings size={16} /> },
  ]
}

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
    <aside
      className="w-52 shrink-0 flex flex-col bg-zinc-950 border-r border-zinc-800/60"
      data-testid="sidebar"
    >
      {/* Brand */}
      <div className="px-5 pt-6 pb-5 border-b border-zinc-800/60">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-orange-500 flex items-center justify-center shrink-0">
            <span className="text-white text-xs font-black leading-none">CG</span>
          </div>
          <span className="text-sm font-semibold text-zinc-100 tracking-tight">CarouselGen</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5">
        {items.map(item => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              data-testid={`nav-${item.href.replace('/', '')}`}
              className={[
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-zinc-800 text-zinc-100'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900',
              ].join(' ')}
            >
              <span className={isActive ? 'text-orange-400' : 'text-zinc-500'}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 pb-5 pt-2 border-t border-zinc-800/60">
        <button
          type="button"
          onClick={onLogout}
          data-testid="sign-out-button"
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 transition-colors"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
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
