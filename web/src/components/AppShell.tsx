'use client'

import { usePathname } from 'next/navigation'
import { SidebarShell } from './SidebarShell'

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  // Landing page renders without sidebar
  if (pathname === '/') {
    return <>{children}</>
  }

  return <SidebarShell>{children}</SidebarShell>
}
