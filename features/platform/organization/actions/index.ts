'use server'

import { revalidatePath } from 'next/cache'

import { deskRequest, type DeskResult } from '../lib/deskRequest'
import { PERMISSION_KEYS } from '../lib/permissions'
import type {
  DealerGroup,
  Membership,
  MembershipAuditEvent,
  OrganizationData,
  RecordStatus,
  RetentionPolicy,
  Role,
  Rooftop,
  StaffOption,
  Viewer,
} from '../lib/types'

const ORGANIZATION_PATH = '/dashboard/platform/organization'
const PERMISSION_SELECTION = PERMISSION_KEYS.join(' ')

// Storefront shoppers are Users without a role or dealership membership; staff pickers leave them out.
const STAFF_WHERE = {
  OR: [
    { NOT: [{ role: null }] },
    { dealerGroupMemberships: { some: {} } },
    { rooftopMemberships: { some: {} } },
  ],
}

export async function getOrganizationData(): Promise<OrganizationData> {
  const [org, access, audit, roles, retention, staff] = await Promise.all([
    deskRequest<{
      authenticatedItem: { id: string; role: Record<string, unknown> | null } | null
      dealerGroups: DealerGroup[]
      rooftops: Rooftop[]
    }>(`
      query OrganizationDesk {
        authenticatedItem { ... on User { id role { id canManageDealerships canManageRoles canManagePeople } } }
        dealerGroups(orderBy: [{ name: asc }], take: 100) { id name slug legalName status createdAt updatedAt rooftopsCount membershipsCount }
        rooftops(orderBy: [{ name: asc }], take: 500) { id code name publicSlug status timezone currencyCode createdAt membershipsCount dealerGroup { id name } }
      }
    `),
    deskRequest<{ dealerGroupMemberships: any[]; rooftopMemberships: any[] }>(`
      query OrganizationAccess {
        dealerGroupMemberships(orderBy: [{ updatedAt: desc }], take: 1000) {
          id status accessAllRooftops joinedAt updatedAt
          user { id name email } role { id name } invitedBy { id name } dealerGroup { id name }
        }
        rooftopMemberships(orderBy: [{ updatedAt: desc }], take: 1000) {
          id status joinedAt updatedAt
          user { id name email } role { id name } invitedBy { id name } rooftop { id name code dealerGroup { id } }
        }
      }
    `),
    deskRequest<{ membershipAuditEvents: MembershipAuditEvent[] }>(`
      query OrganizationAccessHistory {
        membershipAuditEvents(orderBy: [{ occurredAt: desc }], take: 300) {
          id scopeType action reason occurredAt previousSnapshot nextSnapshot
          dealerGroup { id name } rooftop { id name code } targetUser { id name email } actor { id name }
        }
      }
    `),
    deskRequest<{ roles: Role[] }>(`
      query OrganizationRoles {
        roles(orderBy: [{ name: asc }], take: 200) {
          id name ${PERMISSION_SELECTION}
          assignedToCount dealerGroupMembershipsCount rooftopMembershipsCount
        }
      }
    `),
    deskRequest<{ retentionPolicies: RetentionPolicy[] }>(`
      query OrganizationRetention {
        retentionPolicies(take: 500) { id category retentionDays legalHold rationale lastSweptAt updatedAt rooftop { id name code } }
      }
    `),
    deskRequest<{ users: StaffOption[] }>(`
      query OrganizationStaff($where: UserWhereInput!) {
        users(where: $where, orderBy: [{ name: asc }], take: 1000) { id name email role { id name } }
      }
    `, { where: STAFF_WHERE }),
  ])

  const errors: OrganizationData['errors'] = {}
  if (!org.success) errors.organization = org.error
  if (!access.success) errors.access = access.error
  if (!audit.success) errors.audit = audit.error
  if (!roles.success) errors.roles = roles.error
  if (!retention.success) errors.retention = retention.error
  if (!staff.success) errors.staff = staff.error

  const role = org.success ? org.data.authenticatedItem?.role : null
  const viewer: Viewer | null = org.success && org.data.authenticatedItem
    ? {
        id: org.data.authenticatedItem.id,
        roleId: typeof role?.id === 'string' ? role.id : null,
        canManageDealerships: role?.canManageDealerships === true,
        canManageRoles: role?.canManageRoles === true,
        canManagePeople: role?.canManagePeople === true,
      }
    : null

  const memberships: Membership[] = access.success
    ? [
        ...access.data.dealerGroupMemberships.map(row => ({
          id: row.id,
          scopeType: 'dealer-group' as const,
          scopeId: row.dealerGroup?.id ?? '',
          scopeName: row.dealerGroup?.name ?? 'Dealer group',
          dealerGroupId: row.dealerGroup?.id ?? null,
          status: row.status,
          accessAllRooftops: Boolean(row.accessAllRooftops),
          joinedAt: row.joinedAt,
          updatedAt: row.updatedAt,
          user: row.user,
          role: row.role,
          invitedBy: row.invitedBy,
        })),
        ...access.data.rooftopMemberships.map(row => ({
          id: row.id,
          scopeType: 'rooftop' as const,
          scopeId: row.rooftop?.id ?? '',
          scopeName: row.rooftop ? `${row.rooftop.name} (${row.rooftop.code})` : 'Rooftop',
          dealerGroupId: row.rooftop?.dealerGroup?.id ?? null,
          status: row.status,
          accessAllRooftops: false,
          joinedAt: row.joinedAt,
          updatedAt: row.updatedAt,
          user: row.user,
          role: row.role,
          invitedBy: row.invitedBy,
        })),
      ]
    : []

  return {
    viewer,
    dealerGroups: org.success ? org.data.dealerGroups : [],
    rooftops: org.success ? org.data.rooftops : [],
    memberships,
    auditEvents: audit.success ? audit.data.membershipAuditEvents : [],
    roles: roles.success ? roles.data.roles : [],
    retentionPolicies: retention.success ? retention.data.retentionPolicies : [],
    staff: staff.success ? staff.data.users : [],
    errors,
  }
}

function done<T>(result: DeskResult<T>) {
  if (result.success) revalidatePath(ORGANIZATION_PATH)
  return result
}

export async function updateDealerGroup(id: string, data: { name?: string; slug?: string; legalName?: string; status?: RecordStatus }) {
  return done(await deskRequest<{ updateDealerGroup: { id: string } | null }>(`
    mutation UpdateDealerGroup($id: ID!, $data: DealerGroupUpdateInput!) {
      updateDealerGroup(where: { id: $id }, data: $data) { id }
    }
  `, { id, data }))
}

export async function createRooftop(data: {
  dealerGroupId: string
  code: string
  name: string
  publicSlug: string
  timezone: string
}) {
  return done(await deskRequest<{ createRooftop: { id: string } | null }>(`
    mutation CreateRooftop($data: RooftopCreateInput!) {
      createRooftop(data: $data) { id }
    }
  `, {
    data: {
      dealerGroup: { connect: { id: data.dealerGroupId } },
      code: data.code,
      name: data.name,
      publicSlug: data.publicSlug,
      timezone: data.timezone,
      currencyCode: 'USD',
      status: 'active',
    },
  }))
}

export async function updateRooftop(id: string, data: { name?: string; publicSlug?: string; timezone?: string; status?: RecordStatus }) {
  return done(await deskRequest<{ updateRooftop: { id: string } | null }>(`
    mutation UpdateRooftop($id: ID!, $data: RooftopUpdateInput!) {
      updateRooftop(where: { id: $id }, data: $data) { id }
    }
  `, { id, data }))
}

export type MembershipChangeInput = {
  scopeType: 'dealer-group' | 'rooftop'
  scopeId: string
  targetUserId: string
  roleId: string
  status: 'invited' | 'active' | 'suspended' | 'revoked'
  accessAllRooftops: boolean
  reason: string
  expectedUpdatedAt: string | null
}

/** Every grant, role change, suspension, reactivation and removal goes through the audited command. */
export async function changeMembership(data: MembershipChangeInput) {
  return done(await deskRequest<{ changeDealerMembership: { id: string; status: string; updatedAt: string } }>(`
    mutation ChangeDealerMembership($data: ChangeDealerMembershipInput!) {
      changeDealerMembership(data: $data) { id status updatedAt }
    }
  `, { data: { ...data, accessAllRooftops: data.scopeType === 'dealer-group' ? data.accessAllRooftops : false } }))
}

/** Creates the staff login for an invite; the caller then grants access with `changeMembership`. */
export async function createStaffUser(data: { name: string; email: string; password: string }) {
  return deskRequest<{ createUser: { id: string; name: string; email: string } | null }>(`
    mutation CreateStaffUser($data: UserCreateInput!) {
      createUser(data: $data) { id name email }
    }
  `, { data: { name: data.name, email: data.email.toLowerCase(), password: data.password, onboardingStatus: 'dismissed' } })
}

export async function createRole(data: Record<string, unknown>) {
  return done(await deskRequest<{ createRole: { id: string } | null }>(`
    mutation CreateRole($data: RoleCreateInput!) { createRole(data: $data) { id } }
  `, { data }))
}

export async function updateRole(id: string, data: Record<string, unknown>) {
  return done(await deskRequest<{ updateRole: { id: string } | null }>(`
    mutation UpdateRole($id: ID!, $data: RoleUpdateInput!) { updateRole(where: { id: $id }, data: $data) { id } }
  `, { id, data }))
}

export async function deleteRole(id: string) {
  return done(await deskRequest<{ deleteRole: { id: string } | null }>(`
    mutation DeleteRole($id: ID!) { deleteRole(where: { id: $id }) { id } }
  `, { id }))
}

export async function configureRetentionPolicy(data: {
  rooftopId: string
  category: string
  retentionDays: number
  legalHold: boolean
  rationale: string
  idempotencyKey: string
  expectedUpdatedAt: string | null
}) {
  return done(await deskRequest<{ configureRetentionPolicy: { id: string; updatedAt: string } }>(`
    mutation ConfigureRetentionPolicy($data: ConfigureRetentionPolicyInput!) {
      configureRetentionPolicy(data: $data) { id updatedAt }
    }
  `, { data }))
}
