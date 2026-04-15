'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { Activity, Briefcase, Menu, Trophy, Wallet, X } from 'lucide-react'
import { WalletButton } from './WalletButton'

const navItems = [
  { href: '/signals', label: 'Signals', icon: Activity },
  { href: '/portfolio', label: 'My Positions', icon: Briefcase },
  { href: '/leaderboard', label: 'Signal Leaders', icon: Trophy },
]

function pageTitleFor(path: string) {
  if (path === '/signals') return 'Live Signals'
  if (path === '/portfolio') return 'My Positions'
  if (path === '/leaderboard') return 'Signal Leaders'
  if (path.startsWith('/market/')) return 'Signal Detail'
  return 'StakeSignal'
}

export function SidebarShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="min-h-screen flex bg-mesh bg-dot-pattern">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-[var(--sidebar-width)] border-r border-white/40 bg-white/50 backdrop-blur-xl fixed inset-y-0 left-0 z-30">
        <div className="px-6 py-5 flex items-center gap-2.5 logo-hover cursor-default">
          <Image src="/logo.png" alt="StakeSignal" width={32} height={32} className="rounded-lg" />
          <span className="text-lg font-bold tracking-tight text-brand-800">StakeSignal</span>
        </div>

        <nav className="flex-1 px-3 py-2 space-y-1">
          {navItems.map((item) => {
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  active
                    ? 'bg-brand-500/10 text-brand-700 shadow-sm nav-active-bar'
                    : 'text-muted-foreground hover:text-foreground hover:bg-white/60'
                }`}
              >
                <item.icon className={`h-4.5 w-4.5 ${active ? 'text-brand-600' : ''}`} />
                {item.label}
              </Link>
            )
          })}

          {/* Wallet — same style as nav items */}
          <div className="wallet-nav-item pt-1">
            <WalletButton />
          </div>
        </nav>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-[280px] bg-white/95 backdrop-blur-xl border-r border-white/40 flex flex-col z-50 shadow-glass-lg animate-in slide-in-from-left duration-300" style={{ animationTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
            <div className="px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Image src="/logo.png" alt="StakeSignal" width={32} height={32} className="rounded-lg" />
                <span className="text-lg font-bold tracking-tight text-brand-800">StakeSignal</span>
              </div>
              <button onClick={() => setMobileOpen(false)} className="p-1 rounded-md hover:bg-muted">
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>
            <nav className="flex-1 px-3 py-2 space-y-1">
              {navItems.map((item) => {
                const active = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      active
                        ? 'bg-brand-500/10 text-brand-700 nav-active-bar'
                        : 'text-muted-foreground hover:text-foreground hover:bg-white/60'
                    }`}
                  >
                    <item.icon className={`h-4.5 w-4.5 ${active ? 'text-brand-600' : ''}`} />
                    {item.label}
                  </Link>
                )
              })}
              <div className="wallet-nav-item pt-1">
                <WalletButton />
              </div>
            </nav>
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 lg:ml-[var(--sidebar-width)]">
        {/* Top bar */}
        <header className="sticky top-0 z-20 h-14 flex items-center justify-between px-5 lg:px-8 border-b border-white/40 bg-white/50 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden p-1.5 rounded-md hover:bg-muted"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="text-sm font-semibold text-foreground">{pageTitleFor(pathname)}</h1>
          </div>
          <div className="lg:hidden">
            <WalletButton />
          </div>
        </header>

        <main className="px-5 lg:px-8 py-6 max-w-6xl">
          {children}
        </main>
      </div>
    </div>
  )
}
