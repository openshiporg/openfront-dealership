/** Role permission flags, grouped for the role editor. Mirrors features/keystone/models/fields.ts. */
export const PERMISSION_GROUPS: ReadonlyArray<{ title: string; flags: ReadonlyArray<{ key: string; label: string }> }> = [
  {
    title: 'Platform administration',
    flags: [
      { key: 'canAccessDashboard', label: 'Access the dashboard' },
      { key: 'canManageDealerships', label: 'Manage dealer groups, rooftops and access' },
      { key: 'canManageRoles', label: 'Manage roles' },
      { key: 'canReadRoles', label: 'Read roles' },
      { key: 'canManageSettings', label: 'Manage dealership settings' },
      { key: 'canManageOnboarding', label: 'Run onboarding' },
      { key: 'canManageKeys', label: 'Manage API keys' },
    ],
  },
  {
    title: 'People',
    flags: [
      { key: 'canSeeOtherPeople', label: 'See other people' },
      { key: 'canEditOtherPeople', label: 'Edit other people' },
      { key: 'canManagePeople', label: 'Create and remove people' },
      { key: 'canReadUsers', label: 'Read users' },
      { key: 'canManageUsers', label: 'Manage users' },
    ],
  },
  {
    title: 'Sales',
    flags: [
      { key: 'canViewInventory', label: 'View inventory' },
      { key: 'canManageInventory', label: 'Manage inventory' },
      { key: 'canManageLeads', label: 'Manage leads' },
      { key: 'canViewAllLeads', label: 'View all leads' },
      { key: 'canManageDeals', label: 'Manage deals' },
      { key: 'canApproveDeals', label: 'Approve deals' },
      { key: 'canManageTradeIns', label: 'Manage trade-ins' },
      { key: 'canManageFinancing', label: 'Manage financing' },
    ],
  },
  {
    title: 'Service and reporting',
    flags: [
      { key: 'canManageService', label: 'Manage service and parts' },
      { key: 'canViewReports', label: 'View reports' },
      { key: 'canReadPayments', label: 'Read payments' },
      { key: 'canManagePayments', label: 'Manage payments' },
    ],
  },
]

export const PERMISSION_KEYS = PERMISSION_GROUPS.flatMap(group => group.flags.map(flag => flag.key))

/**
 * Flags a dealer-group or rooftop membership role may not carry.
 * Mirrors PLATFORM_ADMIN_PERMISSIONS in features/keystone/mutations/membershipPolicy.ts.
 */
export const PLATFORM_ADMIN_PERMISSIONS = [
  'canManageDealerships',
  'canManageRoles',
  'canManagePeople',
  'canEditOtherPeople',
  'canSeeOtherPeople',
  'canManageOnboarding',
  'canManageUsers',
  'canManageSettings',
  'canManageKeys',
] as const

export function roleIsTenantAssignable(role: Record<string, unknown>) {
  return PLATFORM_ADMIN_PERMISSIONS.every(flag => role[flag] !== true)
}

export function rolePermissionCount(role: Record<string, unknown>) {
  return PERMISSION_KEYS.filter(key => role[key] === true).length
}

export const RETENTION_CATEGORIES: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'customer-intake', label: 'Customer intake' },
  { value: 'report-export', label: 'Report exports' },
  { value: 'provider-payload', label: 'Provider payloads' },
  { value: 'audit-evidence', label: 'Audit evidence' },
]

export const MAX_RETENTION_DAYS = 36500

export const US_TIME_ZONES = [
  'America/New_York',
  'America/Detroit',
  'America/Indiana/Indianapolis',
  'America/Chicago',
  'America/Denver',
  'America/Boise',
  'America/Phoenix',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'America/Puerto_Rico',
]

export function isValidTimeZone(value: string) {
  if (!value) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value })
    return true
  } catch {
    return false
  }
}

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
