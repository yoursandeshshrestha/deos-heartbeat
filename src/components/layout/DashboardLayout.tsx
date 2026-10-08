import { useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { CaretLeft, List as Menu } from '@phosphor-icons/react'
import { HeaderSlotContext } from './header-slot'
import { Sidebar } from './Sidebar'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'

const PAGE_TITLES: Record<string, string> = {
  '/': 'Fleet',
  '/fleet-map': 'Fleet map',
  '/vans': 'Vans',
  '/tickets': 'Tickets',
  '/engagement': 'Engagement',
  '/reports': 'Reports',
  '/report-history': 'Report history',
  '/users': 'Users & Access',
  '/audit': 'Audit',
}

function pageTitle(pathname: string) {
  if (pathname.startsWith('/vans/')) return 'Van'
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname]
  const match = Object.keys(PAGE_TITLES).find(
    (path) => path !== '/' && pathname.startsWith(path),
  )
  return match ? PAGE_TITLES[match] : 'Deos Heartbeat'
}

export function DashboardLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [headerSlot, setHeaderSlot] = useState<HTMLDivElement | null>(null)
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const title = pageTitle(pathname)
  const showBack = pathname.startsWith('/vans/')

  function goBack() {
    const index = (window.history.state as { idx?: number } | null)?.idx ?? 0
    if (index > 0) navigate(-1)
    else navigate(pathname.startsWith('/vans/') ? '/vans' : '/fleet-map')
  }

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
          {showBack ? (
            <Button variant="ghost" size="sm" onClick={goBack}>
              <CaretLeft />
              Back
            </Button>
          ) : null}
          <div className="min-w-0 shrink-0">
            <p className="truncate text-sm font-semibold tracking-tight">{title}</p>
          </div>
          <div ref={setHeaderSlot} className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-3 overflow-x-auto" />
        </header>
        <HeaderSlotContext.Provider value={headerSlot}>
          <div data-main-scroll className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-background">
            <Outlet />
          </div>
        </HeaderSlotContext.Provider>
      </div>
    </div>
  )
}
