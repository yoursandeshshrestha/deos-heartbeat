export const ROLES = ['admin', 'viewer'] as const

export type Role = (typeof ROLES)[number]

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value)
}

const roleBadgeClasses: Record<Role, string> = {
  admin: 'bg-red-600/10 text-red-700 dark:bg-red-400/15 dark:text-red-300',
  viewer: 'bg-sky-600/10 text-sky-800 dark:bg-sky-400/15 dark:text-sky-300',
}

export function roleBadgeClass(role: Role) {
  return roleBadgeClasses[role]
}

export function roleLabel(role: Role | null) {
  if (!role) return 'No role'
  return role.charAt(0).toUpperCase() + role.slice(1)
}

/** What each role can do in the product UI. */
export const ROLE_ACCESS: Record<
  Role,
  { label: string; summary: string; can: string[]; cannot: string[] }
> = {
  admin: {
    label: 'Admin',
    summary: 'Full access — configure everything and manage users.',
    can: [
      'View fleet health and map',
      'Edit trusts, vans, and recipients',
      'Change fleet thresholds',
      'Send test / scheduled reports',
      'Manage users and roles',
      'View audit log',
    ],
    cannot: [],
  },
  viewer: {
    label: 'Viewer',
    summary: 'Read-only — monitor the fleet without changing config.',
    can: [
      'View fleet health and map',
      'View report config (read-only)',
      'View audit log',
    ],
    cannot: [
      'Edit trusts, vans, or recipients',
      'Change thresholds',
      'Send reports',
      'Manage users',
    ],
  },
}

export const ROLE_OPTIONS = ROLES.map((value) => ({
  value,
  label: ROLE_ACCESS[value].label,
}))
