import type { Icon } from '@phosphor-icons/react'
import {
  ClipboardText,
  FilePdf,
  MapTrifold,
  Pulse,
  Scroll,
  UsersThree,
} from '@phosphor-icons/react'
import type { Role } from '@/lib/roles'

export interface NavItem {
  title: string
  href: string
  icon: Icon
  /** If set, only these roles see the item. */
  roles?: Role[]
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

const nav: NavGroup[] = [
  {
    label: 'Monitor',
    items: [
      { title: 'Fleet', href: '/', icon: Pulse },
      { title: 'Fleet map', href: '/fleet-map', icon: MapTrifold },
    ],
  },
  {
    label: 'Configure',
    items: [
      { title: 'Reports', href: '/reports', icon: ClipboardText },
      { title: 'Report history', href: '/report-history', icon: FilePdf },
      { title: 'Users & Access', href: '/users', icon: UsersThree, roles: ['admin'] },
      { title: 'Audit', href: '/audit', icon: Scroll },
    ],
  },
]

export function navForRole(role: Role | null): NavGroup[] {
  return nav
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (!item.roles) return true
        return role != null && item.roles.includes(role)
      }),
    }))
    .filter((group) => group.items.length > 0)
}

export function rolesForPath(pathname: string): Role[] | null {
  if (pathname === '/') return null
  for (const group of nav) {
    for (const item of group.items) {
      if (
        item.href === pathname ||
        (item.href !== '/' && pathname.startsWith(`${item.href}/`))
      ) {
        return item.roles ?? (['admin', 'viewer'] as Role[])
      }
    }
  }
  return null
}
