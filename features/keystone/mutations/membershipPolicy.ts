export type MembershipScopeType = 'dealer-group' | 'rooftop'
export type MembershipStatus = 'invited' | 'active' | 'suspended' | 'revoked'

const MEMBERSHIP_STATUSES = new Set<MembershipStatus>([
  'invited',
  'active',
  'suspended',
  'revoked',
])

const PLATFORM_ADMIN_PERMISSIONS = [
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

export function assertMembershipChangePolicy(input: {
  actorUserId: string
  targetUserId: string
  scopeType: string
  status: string
  accessAllRooftops: boolean
  reason: string
}) {
  if (!input.actorUserId || !input.targetUserId) throw new Error('Actor and target user are required')
  if (input.actorUserId === input.targetUserId) {
    throw new Error('Operators cannot change their own membership')
  }
  if (input.scopeType !== 'dealer-group' && input.scopeType !== 'rooftop') {
    throw new Error('Unsupported membership scope')
  }
  if (!MEMBERSHIP_STATUSES.has(input.status as MembershipStatus)) {
    throw new Error('Unsupported membership status')
  }
  if (input.scopeType === 'rooftop' && input.accessAllRooftops) {
    throw new Error('Rooftop memberships cannot grant group-wide access')
  }
  if (!input.reason.trim()) throw new Error('An audit reason is required')
  if (input.reason.trim().length > 500) throw new Error('Audit reason must be 500 characters or fewer')
}

export function assertTenantAssignableRole(role: Record<string, unknown>) {
  const elevated = PLATFORM_ADMIN_PERMISSIONS.filter(permission => role[permission] === true)
  if (elevated.length) {
    throw new Error(`Tenant memberships cannot assign platform-administration permissions: ${elevated.join(', ')}`)
  }
}
