export type MembershipRoleSessionData = Record<string, unknown> & {
  id?: string
  name?: string
}

export type DealerGroupMembershipSessionData = {
  status: string
  accessAllRooftops: boolean
  dealerGroup: { id: string } | null
  role?: MembershipRoleSessionData | null
}

export type RooftopMembershipSessionData = {
  status: string
  rooftop: { id: string; dealerGroup: { id: string } | null } | null
  role?: MembershipRoleSessionData | null
}

export type DealershipTenancySession = {
  itemId: string
  listKey: string
  data: {
    dealerGroupMemberships?: DealerGroupMembershipSessionData[]
    rooftopMemberships?: RooftopMembershipSessionData[]
    role?: Record<string, unknown> | null
    [key: string]: unknown
  }
}

export function getConnectedId(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null
  const connect = (value as { connect?: unknown }).connect
  if (!connect || typeof connect !== 'object') return null
  const id = (connect as { id?: unknown }).id
  return typeof id === 'string' && id.length > 0 ? id : null
}

// Access is role-first: a Role that can access the dashboard sees every rooftop.
// Memberships only scope access for staff whose Role does not grant it.
function roleHasDashboardAccess(session: DealershipTenancySession | undefined) {
  return session?.data.role?.canAccessDashboard === true
}

export function hasDealerGroupAccess(session: DealershipTenancySession | undefined, dealerGroupId: string) {
  if (!session) return false
  if (roleHasDashboardAccess(session)) return true
  return Boolean(session.data.dealerGroupMemberships?.some(membership =>
    membership.status === 'active' && membership.dealerGroup?.id === dealerGroupId
  ))
}

export function hasRooftopAccess(
  session: DealershipTenancySession | undefined,
  dealerGroupId: string,
  rooftopId: string
) {
  if (!session) return false
  if (roleHasDashboardAccess(session)) return true
  const groupWide = session.data.dealerGroupMemberships?.some(membership =>
    membership.status === 'active' &&
    membership.accessAllRooftops &&
    membership.dealerGroup?.id === dealerGroupId
  )
  if (groupWide) return true
  return Boolean(session.data.rooftopMemberships?.some(membership =>
    membership.status === 'active' &&
    membership.rooftop?.id === rooftopId &&
    membership.rooftop.dealerGroup?.id === dealerGroupId
  ))
}

export function hasAnyMembershipPermission(
  session: DealershipTenancySession | undefined,
  permission: string
) {
  if (!session) return false
  if (session.data.role?.[permission] === true) return true
  return Boolean(
    session.data.dealerGroupMemberships?.some(membership =>
      membership.status === 'active' && membership.role?.[permission] === true
    ) ||
    session.data.rooftopMemberships?.some(membership =>
      membership.status === 'active' && membership.role?.[permission] === true
    )
  )
}

export function hasRooftopPermission(
  session: DealershipTenancySession | undefined,
  dealerGroupId: string,
  rooftopId: string,
  permissions: string | string[]
) {
  if (!session) return false
  const required = Array.isArray(permissions) ? permissions : [permissions]
  const roleAllows = (role: MembershipRoleSessionData | null | undefined) =>
    required.some(permission => role?.[permission] === true)
  if (roleAllows(session.data.role)) return true
  const groupWide = session.data.dealerGroupMemberships?.some(membership =>
    membership.status === 'active' &&
    membership.accessAllRooftops &&
    membership.dealerGroup?.id === dealerGroupId &&
    roleAllows(membership.role)
  )
  if (groupWide) return true
  return Boolean(session.data.rooftopMemberships?.some(membership =>
    membership.status === 'active' &&
    membership.rooftop?.id === rooftopId &&
    membership.rooftop.dealerGroup?.id === dealerGroupId &&
    roleAllows(membership.role)
  ))
}

export function rooftopPermissionAccessFilter(
  session: DealershipTenancySession | undefined,
  permissions: string | string[]
) {
  if (!session) return false
  const required = Array.isArray(permissions) ? permissions : [permissions]
  if (required.some(permission => session.data.role?.[permission] === true)) return true
  const roleFilter = {
    OR: required.map(permission => ({ [permission]: { equals: true } })),
  }
  return {
    OR: [
      {
        dealerGroup: {
          memberships: {
            some: {
              user: { id: { equals: session.itemId } },
              status: { equals: 'active' },
              accessAllRooftops: { equals: true },
              role: roleFilter,
            },
          },
        },
      },
      {
        memberships: {
          some: {
            user: { id: { equals: session.itemId } },
            status: { equals: 'active' },
            role: roleFilter,
          },
        },
      },
    ],
  }
}

export function hasPermissionAcrossAllRooftops(
  session: DealershipTenancySession | undefined,
  permissions: string | string[]
) {
  if (!session) return false
  const required = Array.isArray(permissions) ? permissions : [permissions]
  if (required.some(permission => session.data.role?.[permission] === true)) return true
  const roleAllows = (role: MembershipRoleSessionData | null | undefined) =>
    required.some(permission => role?.[permission] === true)
  const groupScopes = (session.data.dealerGroupMemberships || []).filter(membership =>
    membership.status === 'active' && membership.accessAllRooftops
  )
  const rooftopScopes = (session.data.rooftopMemberships || []).filter(membership =>
    membership.status === 'active'
  )
  const scopes = [...groupScopes, ...rooftopScopes]
  return scopes.length > 0 && scopes.every(scope => roleAllows(scope.role))
}

export function dealerGroupAccessFilter(session: DealershipTenancySession | undefined) {
  if (!session) return false
  if (roleHasDashboardAccess(session)) return true
  return {
    memberships: {
      some: {
        user: { id: { equals: session.itemId } },
        status: { equals: 'active' },
      },
    },
  }
}

export function rooftopAccessFilter(session: DealershipTenancySession | undefined) {
  if (!session) return false
  if (roleHasDashboardAccess(session)) return true
  return {
    OR: [
      {
        dealerGroup: {
          memberships: {
            some: {
              user: { id: { equals: session.itemId } },
              status: { equals: 'active' },
              accessAllRooftops: { equals: true },
            },
          },
        },
      },
      {
        memberships: {
          some: {
            user: { id: { equals: session.itemId } },
            status: { equals: 'active' },
          },
        },
      },
    ],
  }
}

export function membershipKey(scopeId: string, userId: string) {
  if (!scopeId || !userId) throw new Error('Membership scope and user are required')
  return `${scopeId}:${userId}`
}
