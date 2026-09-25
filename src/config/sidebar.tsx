import type { Icon } from '@phosphor-icons/react'
import { ClipboardText, Pulse, Scroll } from '@phosphor-icons/react'
import type { Role } from '@/lib/roles'

export interface NavItem {
  title: string
  href: string
  icon: Icon
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

const nav: NavGroup[] = [
  {
    label: 'Monitor',
    items: [{ title: 'Fleet', href: '/', icon: Pulse }],
  },
  {
    label: 'Configure',
    items: [
      { title: 'Reports', href: '/reports', icon: ClipboardText },
      { title: 'Audit', href: '/audit', icon: Scroll },
    ],
  },
]

export function navForRole(_role: Role | null): NavGroup[] {
  return nav
}

export function rolesForPath(pathname: string): Role[] | null {
  if (pathname === '/') return null
  const known = nav.some((group) => group.items.some((item) => item.href === pathname))
  return known ? (['admin', 'viewer'] as Role[]) : null
}
