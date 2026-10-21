import {
  withRooftopPermissionScope,
  withRooftopScope,
} from './tenantRecords'
import { hasAnyMembershipPermission, hasPermissionAcrossAllRooftops, rooftopPermissionAccessFilter } from './tenancy'
import { permissionsList } from './models/fields'
import { scopeAllowsPermission } from './utils/apiKeyPolicy'

export type RolePermission = (typeof permissionsList)[number]

export type Session = {
  itemId: string
  listKey: string
  apiKeyId?: string
  apiKeyScopes?: string[]
  data: {
    name: string
    email?: string
    role?: ({ id: string; name: string } & Partial<Record<RolePermission, boolean>>) | null
    dealerGroupMemberships?: Array<{
      status: string
      accessAllRooftops: boolean
      dealerGroup: { id: string } | null
      role?: Record<string, unknown> | null
    }>
    rooftopMemberships?: Array<{
      status: string
      rooftop: { id: string; dealerGroup: { id: string } | null } | null
      role?: Record<string, unknown> | null
    }>
  }
}

export type AccessArgs = {
  session?: Session | null
}

export const LEAD_ACCESS_PERMISSIONS: RolePermission[] = [
  'canManageLeads', 'canManageDeals', 'canManageService', 'canManageFinancing', 'canManageTradeIns',
]
export const TRADE_IN_ACCESS_PERMISSIONS: RolePermission[] = [
  'canManageTradeIns', 'canManageDeals', 'canManageLeads',
]

// Identity, configuration and platform permissions come from the user's Role only.
// Dealership operating permissions are granted by the Role first; an active
// dealer-group or rooftop membership role can grant them for that scope only.
const ROLE_ONLY_PERMISSIONS = new Set<RolePermission>([
  'canAccessDashboard',
  'canSeeOtherPeople',
  'canEditOtherPeople',
  'canManagePeople',
  'canReadUsers',
  'canManageUsers',
  'canReadRoles',
  'canManageRoles',
  'canManageSettings',
  'canManageOnboarding',
  'canManageKeys',
  'canReadPayments',
  'canManagePayments',
])

function hasPermission({ session }: AccessArgs, permission: RolePermission) {
  if (!session) return false
  const granted = ROLE_ONLY_PERMISSIONS.has(permission)
    ? session.data?.role?.[permission] === true
    : hasAnyMembershipPermission(session as any, permission)
  if (session.apiKeyId || session.apiKeyScopes) {
    return granted && scopeAllowsPermission(session.apiKeyScopes, permission)
  }
  return granted
}

export function isSignedIn({ session }: AccessArgs) {
  return Boolean(session && !session.apiKeyId && !session.apiKeyScopes)
}

const generatedPermissions = Object.fromEntries(
  permissionsList.map(permission => [permission, (args: AccessArgs) => hasPermission(args, permission)])
) as Record<RolePermission, (args: AccessArgs) => boolean>

export const permissions = {
  ...generatedPermissions,
  canViewInventory: (args: AccessArgs) =>
    hasPermission(args, 'canViewInventory') || hasPermission(args, 'canManageInventory'),
  canAccessDeals: (args: AccessArgs) =>
    hasPermission(args, 'canManageDeals') ||
    hasPermission(args, 'canApproveDeals') ||
    hasPermission(args, 'canManageFinancing'),
  canAccessTradeIns: (args: AccessArgs) =>
    TRADE_IN_ACCESS_PERMISSIONS.some(permission => hasPermission(args, permission)),
  canAccessLeads: (args: AccessArgs) =>
    LEAD_ACCESS_PERMISSIONS.some(permission => hasPermission(args, permission)),
  canManageTasks: (args: AccessArgs) =>
    hasPermission(args, 'canManageLeads') ||
    hasPermission(args, 'canManageFinancing') ||
    hasPermission(args, 'canManageService'),
  canViewDealerCost: ({ session }: AccessArgs) =>
    hasPermissionAcrossAllRooftops(session as any, ['canManageInventory', 'canManageFinancing']),
}

export const rules = {
  canReadRooftopRecords: ({ session }: AccessArgs) => {
    if (!session) return false
    return withRooftopScope(true, session as any)
  },
  canReadLeadOperations: ({ session }: AccessArgs) => {
    if (!session || !permissions.canManageLeads({ session })) return false
    return withRooftopPermissionScope(true, session as any, 'canManageLeads')
  },
  canReadCustomers: ({ session }: AccessArgs) => {
    if (!session || !permissions.canAccessLeads({ session })) return false
    return withRooftopPermissionScope(
      true,
      session as any,
      ['canManageLeads', 'canManageDeals', 'canManageService', 'canManageFinancing', 'canManageTradeIns']
    )
  },
  canReadRoles: ({ session }: AccessArgs) => {
    if (!session) return false
    if (permissions.canReadRoles({ session }) || permissions.canManageRoles({ session })) return true
    // Staff can always read their own Role so the dashboard shell can read its flags.
    return {
      OR: [
        { assignedTo: { some: { id: { equals: session.itemId } } } },
        { dealerGroupMemberships: { some: { user: { id: { equals: session.itemId } }, status: { equals: 'active' } } } },
        { rooftopMemberships: { some: { user: { id: { equals: session.itemId } }, status: { equals: 'active' } } } },
      ],
    }
  },
  canReadPeople: ({ session }: AccessArgs) => {
    if (!session) return false
    if (
      permissions.canSeeOtherPeople({ session }) ||
      permissions.canReadUsers({ session }) ||
      permissions.canManagePeople({ session }) ||
      permissions.canManageUsers({ session })
    ) return true
    const self = { id: { equals: session.itemId } }
    if (!hasAnyMembershipPermission(session as any, 'canSeeOtherPeople') && !hasAnyMembershipPermission(session as any, 'canManagePeople')) return self
    const scope = rooftopPermissionAccessFilter(session as any, ['canSeeOtherPeople', 'canManagePeople'])
    if (scope === false || scope === true) return self
    return { OR: [
      self,
      { rooftopMemberships: { some: { status: { equals: 'active' }, rooftop: scope } } },
      { dealerGroupMemberships: { some: { status: { equals: 'active' }, accessAllRooftops: { equals: true }, dealerGroup: { rooftops: { some: scope } } } } },
    ] }
  },
  canUpdatePeople: ({ session }: AccessArgs) => {
    if (!session) return false
    if (
      permissions.canEditOtherPeople({ session }) ||
      permissions.canManagePeople({ session }) ||
      permissions.canManageUsers({ session })
    ) return true
    return { id: { equals: session.itemId } }
  },
  canReadLeads: ({ session }: AccessArgs) => {
    if (!session || !permissions.canAccessLeads({ session })) return false
    const roleFilter = hasPermissionAcrossAllRooftops(session as any, 'canViewAllLeads')
      ? true
      : {
          OR: [
            { assignedSalesperson: { id: { equals: session.itemId } } },
            ...(hasPermissionAcrossAllRooftops(session as any, 'canManageService') ? [{ serviceAppointments: { some: {} } }] : []),
            ...(hasPermissionAcrossAllRooftops(session as any, 'canManageTradeIns') ? [{ tradeIns: { some: {} } }] : []),
          ],
        }
    return withRooftopPermissionScope(
      roleFilter,
      session as any,
      ['canManageLeads', 'canManageDeals', 'canManageService', 'canManageFinancing', 'canManageTradeIns']
    )
  },
  canReadLeadChildren: ({ session }: AccessArgs) => {
    if (!session || !permissions.canAccessLeads({ session })) return false
    const roleFilter = hasPermissionAcrossAllRooftops(session as any, 'canViewAllLeads')
      ? true
      : { lead: { assignedSalesperson: { id: { equals: session.itemId } } } }
    return withRooftopPermissionScope(
      roleFilter,
      session as any,
      ['canManageLeads', 'canManageDeals', 'canManageService', 'canManageFinancing', 'canManageTradeIns']
    )
  },
  canReadTradeIns: ({ session }: AccessArgs) => {
    if (!session || !permissions.canAccessTradeIns({ session })) return false
    const roleFilter = hasPermissionAcrossAllRooftops(session as any, ['canManageTradeIns', 'canViewAllLeads'])
      ? true
      : { lead: { assignedSalesperson: { id: { equals: session.itemId } } } }
    return withRooftopPermissionScope(
      roleFilter,
      session as any,
      ['canManageTradeIns', 'canManageDeals', 'canManageLeads']
    )
  },
  canReadDeals: ({ session }: AccessArgs) => {
    if (!session || !permissions.canAccessDeals({ session })) return false
    const roleFilter = hasPermissionAcrossAllRooftops(session as any, 'canViewAllLeads')
      ? true
      : { lead: { assignedSalesperson: { id: { equals: session.itemId } } } }
    return withRooftopPermissionScope(
      roleFilter,
      session as any,
      ['canManageDeals', 'canApproveDeals', 'canManageFinancing']
    )
  },
  canReadDealApprovals: ({ session }: AccessArgs) => {
    if (!session || !permissions.canAccessDeals({ session })) return false
    const roleFilter = hasPermissionAcrossAllRooftops(session as any, 'canViewAllLeads')
      ? true
      : { deal: { lead: { assignedSalesperson: { id: { equals: session.itemId } } } } }
    return withRooftopPermissionScope(
      roleFilter,
      session as any,
      ['canManageDeals', 'canApproveDeals', 'canManageFinancing']
    )
  },
  canReadVehicles: ({ session }: AccessArgs) => {
    if (!session || !permissions.canViewInventory({ session })) return false
    return withRooftopPermissionScope(true, session as any, ['canViewInventory', 'canManageInventory'])
  },
  canReadVehicleImages: ({ session }: AccessArgs) => {
    if (!session || !permissions.canViewInventory({ session })) return false
    return withRooftopPermissionScope(true, session as any, ['canViewInventory', 'canManageInventory'])
  },
}
