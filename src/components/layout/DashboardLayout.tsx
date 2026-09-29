import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { List as Menu } from '@phosphor-icons/react'
import { Sidebar } from './Sidebar'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'

const PAGE_TITLES: Record<string, string> = {
  '/': 'Fleet',
  '/fleet-map': 'Fleet map',
  '/reports': 'Reports',
  '/report-history': 'Report history',
  '/users': 'Users & Access',
  '/audit': 'Audit',
}

function pageTitle(pathname: string) {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname]
  const match = Object.keys(PAGE_TITLES).find(
    (path) => path !== '/' && pathname.startsWith(path),
  )
  return match ? PAGE_TITLES[match] : 'Deos Heartbeat'
}

export function DashboardLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { pathname } = useLocation()
  const title = pageTitle(pathname)

  return (
    <div className="relative flex h-dvh bg-background">
      <Sidebar
        variant="desktop"
        collapsed={collapsed}
        onCollapsedChange={setCollapsed}
      />

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" showCloseButton={false} className="w-[288px] max-w-[85vw] border-r border-sidebar-border p-0">
          <Sidebar
            variant="mobile"
            onNavigate={() => setMobileOpen(false)}
          />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background text-foreground">
        <header className="flex h-12 shrink-0 items-center gap-3 border-b border-black/6 bg-background px-4 dark:border-white/6 dark:bg-sidebar">
          <Button
            variant="ghost"
            size="icon-sm"
            className="shrink-0 md:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation menu"
          >
            <Menu className="size-5" />
          </Button>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-tight">{title}</p>
          </div>
        </header>
        <div data-main-scroll className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-background">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
