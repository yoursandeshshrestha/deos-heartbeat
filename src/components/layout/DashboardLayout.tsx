import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { List as Menu } from '@phosphor-icons/react'
import { Sidebar } from './Sidebar'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'

export function DashboardLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="relative flex h-dvh bg-background">
      <Sidebar
        variant="desktop"
        collapsed={collapsed}
        onCollapsedChange={setCollapsed}
      />

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" showCloseButton={false} className="w-[288px] max-w-[85vw] border-r p-0">
          <Sidebar
            variant="mobile"
            onNavigate={() => setMobileOpen(false)}
          />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background text-foreground">
        <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border-subtle bg-background px-4 md:hidden">
          <Button
            variant="ghost"
            size="icon-sm"
            className="shrink-0"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation menu"
          >
            <Menu className="size-5" />
          </Button>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-tight">Deos Heartbeat</p>
          </div>
        </header>
        <div data-main-scroll className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
