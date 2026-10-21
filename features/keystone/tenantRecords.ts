import { denyAll } from '@keystone-6/core/access'
import { relationship } from '@keystone-6/core/fields'

import { connectedId } from './lifecycle/relationshipGuards'
import {
  hasRooftopPermission,
  rooftopAccessFilter,
  rooftopPermissionAccessFilter,
  type DealershipTenancySession,
} from './tenancy'

export function rooftopField() {
  return relationship({
    ref: 'Rooftop',
    db: {
      extendPrismaSchema: field => field
        .replace(/rooftop Rooftop\?/g, 'rooftop Rooftop')
        .replace(/rooftopId String\?/g, 'rooftopId String'),
    },
    access: { update: denyAll },
  })
}

export function rooftopRecordAccessFilter(session: DealershipTenancySession | undefined) {
  const rooftopFilter = rooftopAccessFilter(session)
  if (rooftopFilter === false || rooftopFilter === true) return rooftopFilter
  return { rooftop: rooftopFilter }
}

export function withRooftopScope(
  filter: boolean | Record<string, unknown>,
  session: DealershipTenancySession | undefined,
  permissions?: string | string[]
) {
  if (filter === false) return false
  const tenant = permissions
    ? rooftopPermissionAccessFilter(session, permissions)
    : rooftopAccessFilter(session)
  if (tenant === false) return false
  if (tenant === true) return filter
  const scoped = { rooftop: tenant }
  return filter === true ? scoped : { AND: [filter, scoped] }
}

export function withRooftopPermissionScope(
  filter: boolean | Record<string, unknown>,
  session: DealershipTenancySession | undefined,
  permissions: string | string[]
) {
  if (filter === false) return false
  const rooftopFilter = rooftopPermissionAccessFilter(session, permissions)
  if (rooftopFilter === false) return false
  if (rooftopFilter === true) return filter
  const tenant = { rooftop: rooftopFilter }
  return filter === true ? tenant : { AND: [filter, tenant] }
}

// The storefront serves the dealership's primary rooftop: the oldest active
// rooftop in an active dealer group, read from the database like Store Settings.
export async function storefrontRooftopSlug(context: any): Promise<string | null> {
  const rooftop = await context.sudo().prisma.rooftop.findFirst({
    where: { status: 'active', dealerGroup: { is: { status: 'active' } } },
    orderBy: { createdAt: 'asc' },
    select: { publicSlug: true },
  })
  return rooftop?.publicSlug || null
}

export async function assertStorefrontRooftopSlug(context: any, value?: unknown) {
  const served = await storefrontRooftopSlug(context)
  const requested = String(value ?? '').trim().toLowerCase()
  if (!served || (requested && requested !== served)) throw new Error('The requested dealership location is not served by this storefront')
  return served
}

export function publicActiveRooftopScope(filter: Record<string, unknown>) {
  return {
    AND: [
      filter,
      {
        rooftop: {
          status: { equals: 'active' },
          dealerGroup: { status: { equals: 'active' } },
        },
      },
    ],
  }
}

export function publicPublishedVehicleScope(filter: Record<string, unknown> = {}) {
  return publicActiveRooftopScope({
    AND: [
      filter,
      { status: { equals: 'available' } },
      {
        inventoryStock: {
          reconStatus: { equals: 'completed' },
          merchandisingStatus: { equals: 'approved' },
          approvedRevisionHash: { not: { equals: '' } },
          frontlineAt: { not: { equals: null } },
        },
      },
    ],
  })
}

export function canCreateRooftopRecord(requiredPermissions: string | string[]) {
  return async ({ session, inputData, context }: any) => {
    const rooftopId = connectedId(inputData.rooftop)
    if (!session?.itemId || !rooftopId) return false
    const rooftop = await context.sudo().query.Rooftop.findOne({
      where: { id: rooftopId },
      query: 'id status dealerGroup { id status }',
    })
    return Boolean(
      rooftop?.status === 'active' &&
      rooftop.dealerGroup?.id &&
      rooftop.dealerGroup.status === 'active' &&
      hasRooftopPermission(
        session as DealershipTenancySession,
        rooftop.dealerGroup.id,
        rooftop.id,
        requiredPermissions
      )
    )
  }
}

type TenantRelationship = {
  field: string
  listKey: string
  kind?: 'record' | 'user'
}

export async function assertSessionRooftopPermission(
  context: any,
  rooftopId: string,
  permissions: string | string[]
) {
  const session = context.session as DealershipTenancySession | undefined
  if (!session?.itemId) throw new Error('Authentication required')
  const rooftop = await context.sudo().query.Rooftop.findOne({
    where: { id: rooftopId },
    query: 'id status dealerGroup { id status }',
  })
  if (
    !rooftop?.dealerGroup?.id ||
    rooftop.status !== 'active' ||
    rooftop.dealerGroup.status !== 'active' ||
    !hasRooftopPermission(session, rooftop.dealerGroup.id, rooftop.id, permissions)
  ) {
    throw new Error('Rooftop not found or permission denied')
  }
  return rooftop
}

export async function assertUserRooftopAccess(context: any, userId: string, rooftopId: string) {
  const prisma = context.sudo().prisma
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: { select: { canAccessDashboard: true } } } })
  if (user?.role?.canAccessDashboard === true) return
  const [groupAccess, directAccess] = await Promise.all([
    prisma.dealerGroupMembership.count({
      where: {
        userId,
        status: 'active',
        accessAllRooftops: true,
        dealerGroup: { rooftops: { some: { id: rooftopId } } },
      },
    }),
    prisma.rooftopMembership.count({
      where: { userId, status: 'active', rooftopId },
    }),
  ])
  if (groupAccess === 0 && directAccess === 0) {
    throw new Error('User relationship must have active access to the same rooftop')
  }
}

export async function validateRooftopRecord(
  { operation, resolvedData, item, context }: any,
  relationships: TenantRelationship[] = []
) {
  const inputRooftopId = connectedId(resolvedData.rooftop)
  const currentRooftopId = item?.rooftopId == null ? null : String(item.rooftopId)
  if (operation === 'create' && !inputRooftopId) throw new Error('Rooftop is required')
  if (operation === 'update' && inputRooftopId !== undefined && inputRooftopId !== currentRooftopId) {
    throw new Error('Rooftop cannot be moved to another record')
  }
  const rooftopId = operation === 'create' ? inputRooftopId : currentRooftopId
  if (!rooftopId) throw new Error('Rooftop is required')

  const rooftop = await context.sudo().query.Rooftop.findOne({ where: { id: rooftopId }, query: 'id status' })
  if (!rooftop) throw new Error('Rooftop does not exist')

  for (const relation of relationships) {
    const relationId = connectedId(resolvedData[relation.field])
    if (relationId === undefined || relationId === null) continue
    if (relation.kind === 'user') {
      await assertUserRooftopAccess(context, relationId, rooftopId)
      continue
    }
    const related = await context.sudo().query[relation.listKey].findOne({
      where: { id: relationId },
      query: 'id rooftop { id }',
    })
    if (!related || related.rooftop?.id !== rooftopId) {
      throw new Error(`${relation.field} must belong to the same rooftop`)
    }
  }
}

export async function resolvePublicRooftopId(context: any, publicSlug: string) {
  const rooftops = await context.sudo().query.Rooftop.findMany({
    where: {
      publicSlug: { equals: publicSlug },
      status: { equals: 'active' },
      dealerGroup: { status: { equals: 'active' } },
    },
    take: 2,
    query: 'id publicSlug dealerGroup { id status }',
  })
  if (rooftops.length !== 1 || !rooftops[0]?.dealerGroup?.id) {
    throw new Error('The requested public dealership location is unavailable')
  }
  return rooftops[0].id
}
