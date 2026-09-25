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
