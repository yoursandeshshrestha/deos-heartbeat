export type SeedAccount = {
  label: string
  email: string
  fullName: string
  role: 'admin' | 'viewer'
}

/** Dev seed + login shortcuts for Deos Heartbeat. */
export const ACCOUNTS: SeedAccount[] = [
  {
    label: 'Viv Barrett (admin)',
    email: 'viv@ukdeos.com',
    fullName: 'Viv Barrett',
    role: 'admin',
  },
  {
    label: 'Thrumble support (viewer)',
    email: 'support@thrumble.co.uk',
    fullName: 'Thrumble Support',
    role: 'viewer',
  },
]
