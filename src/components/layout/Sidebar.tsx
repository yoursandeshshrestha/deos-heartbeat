import { useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  CaretUpDown,
  Laptop,
  Moon,
  SidebarSimple as PanelLeftClose,
  Sidebar as PanelLeftOpen,
  SignOut,
  Sun,
} from '@phosphor-icons/react'
import { useTheme } from 'next-themes'
import { navForRole } from '@/config/sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'

interface SidebarProps {
  collapsed?: boolean
  onCollapsedChange?: (collapsed: boolean) => void
  variant?: 'desktop' | 'mobile'
  onNavigate?: () => void
}

const profileMenuClassName =
  'w-[272px] overflow-hidden rounded-2xl border border-border-subtle bg-background p-0 shadow-none ring-0 dark:border-white/5 dark:bg-[#252525]'

const appearanceMenuClassName =
  'min-w-[207px] overflow-hidden rounded-2xl border border-border-subtle bg-background p-1.5 shadow-none ring-0 dark:border-white/5 dark:bg-[#252525]'

const menuItemClassName =
  'flex h-10 w-full items-center gap-2 rounded-lg px-3 text-sm text-foreground outline-none transition-colors'

function initials(label: string | null) {
  if (!label) return '?'
  const parts = label.split(/\s+/).filter(Boolean)
  if (parts.length > 1) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return label.slice(0, 2).toUpperCase()
}

function BrandMark({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <span className="flex size-8 items-center justify-center rounded-md bg-primary text-xs font-semibold text-primary-foreground">
        DH
      </span>
    )
  }

  return (
    <div className="min-w-0">
      <p className="truncate text-[13px] font-semibold tracking-tight">Deos Heartbeat</p>
      <p className="truncate text-[11px] text-muted-foreground">UKDEOS</p>
    </div>
  )
}

function SidebarTooltip({
  label,
  collapsed,
  children,
}: {
  label: string
  collapsed: boolean
  children: React.ReactElement
}) {
  if (!collapsed) return children

  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right" align="center" sideOffset={8}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

export function Sidebar({
  collapsed: controlledCollapsed,
  onCollapsedChange,
  variant = 'desktop',
  onNavigate,
}: SidebarProps) {
  const isMobile = variant === 'mobile'
  const [internalCollapsed, setInternalCollapsed] = useState(false)
  const { email, fullName, role, signOut } = useAuth()
  const { theme, setTheme } = useTheme()
  const location = useLocation()
  const navigate = useNavigate()
  const collapsed = isMobile ? false : (controlledCollapsed ?? internalCollapsed)
  const groups = navForRole(role)

  const setCollapsed = (value: boolean) => {
    if (onCollapsedChange) onCollapsedChange(value)
    else setInternalCollapsed(value)
  }

  const navItemClass = (isActive: boolean) =>
    cn(
      'relative flex w-full cursor-pointer items-center rounded-md text-sm transition-colors',
      collapsed ? 'size-8 justify-center p-0' : 'h-8 gap-2 px-2',
      isActive
        ? 'bg-sidebar-accent font-medium text-primary'
        : 'text-sidebar-foreground hover:bg-sidebar-accent/60',
    )

  const go = (href: string) => {
    navigate(href)
    onNavigate?.()
  }

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'flex h-full flex-col bg-sidebar transition-all duration-300',
          isMobile ? 'w-full' : cn('hidden h-dvh md:flex', collapsed ? 'w-16' : 'w-[288px]'),
        )}
      >
        <div
          className={cn(
            'flex h-12 shrink-0 items-center',
            collapsed ? 'justify-center px-2' : 'justify-between px-3',
          )}
        >
          {!collapsed && <BrandMark />}
          {!isMobile && (
            <SidebarTooltip label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} collapsed={collapsed}>
              <button
                type="button"
                onClick={() => setCollapsed(!collapsed)}
                className={cn(
                  'cursor-pointer rounded-lg text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
                  collapsed
                    ? 'group relative flex size-10 items-center justify-center p-2'
                    : 'p-2',
                )}
              >
                {collapsed ? (
                  <>
                    <span className="transition-opacity group-hover:opacity-0">
                      <BrandMark compact />
                    </span>
                    <PanelLeftOpen className="absolute size-4 opacity-0 transition-opacity group-hover:opacity-100" />
                  </>
                ) : (
                  <PanelLeftClose className="size-4" />
                )}
              </button>
            </SidebarTooltip>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <nav className={cn('flex flex-col gap-px pb-4', collapsed ? 'items-center px-2' : 'px-2 sm:mt-2')}>
            {groups.map((group, groupIndex) => (
              <div
                key={group.label}
                className={cn('mt-3 flex w-full flex-col gap-px', collapsed && 'items-center')}
              >
                {collapsed && groupIndex > 0 ? <div className="mb-2 h-px w-6 bg-sidebar-border" /> : null}
                {!collapsed ? (
                  <div className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">
                    {group.label}
                  </div>
                ) : null}
                {group.items.map((item) => {
                  const ItemIcon = item.icon
                  const isActive =
                    item.href === '/'
                      ? location.pathname === '/'
                      : location.pathname === item.href || location.pathname.startsWith(`${item.href}/`)
                  return (
                    <SidebarTooltip key={item.href} label={item.title} collapsed={collapsed}>
                      <button
                        type="button"
                        onClick={() => go(item.href)}
                        className={navItemClass(isActive)}
                      >
                        <ItemIcon className="size-4 shrink-0" />
                        {!collapsed && (
                          <span className="flex-1 truncate text-left text-[13px] tracking-[-0.01em]">
                            {item.title}
                          </span>
                        )}
                      </button>
                    </SidebarTooltip>
                  )
                })}
              </div>
            ))}
          </nav>
        </div>

        <SidebarFooter
          collapsed={collapsed}
          label={fullName ?? email}
          theme={theme}
          onThemeChange={setTheme}
          onSignOut={() => {
            void signOut()
          }}
        />
      </aside>
    </TooltipProvider>
  )
}

function SidebarFooter({
  collapsed,
  label,
  theme,
  onThemeChange,
  onSignOut,
}: {
  collapsed: boolean
  label: string | null
  theme: string | undefined
  onThemeChange: (theme: string) => void
  onSignOut: () => void
}) {
  const displayLabel = label ?? 'Account'

  return (
    <div className={cn('shrink-0 px-2 pb-3', collapsed && 'flex justify-center')}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              'inline-flex cursor-pointer items-center rounded-full text-sidebar-foreground outline-none transition-colors hover:bg-sidebar-accent/60',
              collapsed ? 'size-10 justify-center' : 'h-10 w-full gap-2 px-1.5',
            )}
          >
            <Avatar className="size-7">
              <AvatarFallback>{initials(displayLabel)}</AvatarFallback>
            </Avatar>
            {!collapsed && (
              <>
                <span className="min-w-0 flex-1 truncate text-left text-[13px] tracking-[-0.01em]">
                  {displayLabel}
                </span>
                <CaretUpDown className="size-4 shrink-0 text-muted-foreground" />
              </>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className={profileMenuClassName}>
          <div className="px-4 py-3">
            <p className="truncate text-sm font-medium">{displayLabel}</p>
          </div>
          <div className="flex flex-col gap-0.5 p-1.5">
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className={cn(menuItemClassName, 'cursor-pointer')}>
                <span className="flex size-4 shrink-0 items-center justify-center">
                  {theme === 'dark' ? <Moon className="size-4" /> : theme === 'light' ? <Sun className="size-4" /> : <Laptop className="size-4" />}
                </span>
                <span className="min-w-0 flex-1 truncate text-left">Appearance</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className={appearanceMenuClassName}>
                <ThemeChoice icon={<Sun className="size-4" />} label="Light" active={theme === 'light'} onClick={() => onThemeChange('light')} />
                <ThemeChoice icon={<Moon className="size-4" />} label="Dark" active={theme === 'dark'} onClick={() => onThemeChange('dark')} />
                <ThemeChoice icon={<Laptop className="size-4" />} label="System" active={theme === 'system'} onClick={() => onThemeChange('system')} />
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <MenuRow icon={<SignOut className="size-4" />} label="Sign out" destructive onClick={onSignOut} />
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function MenuRow({
  icon,
  label,
  destructive = false,
  onClick,
}: {
  icon: ReactNode
  label: string
  destructive?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        menuItemClassName,
        'cursor-pointer hover:bg-muted/80 dark:hover:bg-white/6',
        destructive && 'text-destructive hover:bg-destructive/10',
      )}
    >
      <span className="flex size-4 shrink-0 items-center justify-center">{icon}</span>
      <span className="min-w-0 flex-1 truncate text-left">{label}</span>
    </button>
  )
}

function ThemeChoice({
  icon,
  label,
  active,
  onClick,
}: {
  icon: ReactNode
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        menuItemClassName,
        'cursor-pointer hover:bg-muted/80 dark:hover:bg-white/6',
        active && 'bg-muted/80',
      )}
    >
      <span className="flex size-4 shrink-0 items-center justify-center">{icon}</span>
      <span className="min-w-0 flex-1 truncate text-left">{label}</span>
    </button>
  )
}
