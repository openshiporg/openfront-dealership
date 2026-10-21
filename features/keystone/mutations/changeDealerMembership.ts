import { permissions } from '../access'
import { assertMembershipChangePolicy, assertTenantAssignableRole } from './membershipPolicy'

const roleQuery = `
  id name
  canManageDealerships canManageRoles canManagePeople canEditOtherPeople
  canSeeOtherPeople canManageOnboarding canManageUsers canManageSettings canManageKeys
  canManageInventory canViewInventory canManageLeads canViewAllLeads
  canManageDeals canApproveDeals canManageService canViewReports
  canManageFinancing canManageTradeIns
`

function snapshot(membership: any) {
  if (!membership) return null
  return {
    id: membership.id,
    status: membership.status,
    accessAllRooftops: Boolean(membership.accessAllRooftops),
    roleId: membership.role?.id || null,
  }
}

export async function changeDealerMembership(
  _root: unknown,
  { data }: { data: Record<string, unknown> },
  context: any
) {
  const actorUserId = context.session?.itemId
  if (!actorUserId || !permissions.canManageDealerships({ session: context.session })) {
    throw new Error('Dealer membership management permission is required')
  }

  const scopeType = String(data.scopeType || '')
  const scopeId = String(data.scopeId || '')
  const targetUserId = String(data.targetUserId || '')
  const roleId = String(data.roleId || '')
  const status = String(data.status || '')
  const accessAllRooftops = data.accessAllRooftops === true
  const reason = String(data.reason || '').trim()
  const expectedUpdatedAt = data.expectedUpdatedAt == null ? null
    : data.expectedUpdatedAt instanceof Date ? data.expectedUpdatedAt.toISOString() : String(data.expectedUpdatedAt)

  if (!scopeId || !roleId) throw new Error('Membership scope and role are required')
  assertMembershipChangePolicy({ actorUserId, targetUserId, scopeType, status, accessAllRooftops, reason })

  return context.transaction(async (transactionContext: any) => {
    const sudo = transactionContext.withSession(context.session).sudo()
    const [targetUser, role] = await Promise.all([
      sudo.query.User.findOne({ where: { id: targetUserId }, query: 'id role { id }' }),
      sudo.query.Role.findOne({ where: { id: roleId }, query: roleQuery }),
    ])
    if (!targetUser) throw new Error('Target user was not found')
    if (!role) throw new Error('Membership role was not found')
    assertTenantAssignableRole(role)

    let dealerGroupId: string
    let rooftopId: string | null = null
    if (scopeType === 'dealer-group') {
      const group = await sudo.query.DealerGroup.findOne({ where: { id: scopeId }, query: 'id' })
      if (!group) throw new Error('Dealer group was not found')
      dealerGroupId = group.id
    } else {
      const rooftop = await sudo.query.Rooftop.findOne({ where: { id: scopeId }, query: 'id dealerGroup { id }' })
      if (!rooftop?.dealerGroup?.id) throw new Error('Rooftop was not found')
      rooftopId = rooftop.id
      dealerGroupId = rooftop.dealerGroup.id
    }

    const listKey = scopeType === 'dealer-group' ? 'DealerGroupMembership' : 'RooftopMembership'
    const scopeField = scopeType === 'dealer-group' ? 'dealerGroup' : 'rooftop'
    const membershipKey = `${scopeId}:${targetUserId}`
    const existingRows = await sudo.query[listKey].findMany({
      where: { membershipKey: { equals: membershipKey } },
      take: 1,
      query: scopeType === 'dealer-group'
        ? 'id status accessAllRooftops updatedAt role { id }'
        : 'id status updatedAt role { id }',
    })
    const existing = existingRows[0] || null
    if (existing && !expectedUpdatedAt) throw new Error('expectedUpdatedAt is required to change an existing membership')
    const expectedVersion = expectedUpdatedAt ? new Date(expectedUpdatedAt) : null
    if (expectedVersion && Number.isNaN(expectedVersion.getTime())) throw new Error('expectedUpdatedAt is invalid')
    if (existing && new Date(existing.updatedAt).toISOString() !== expectedVersion!.toISOString()) {
      throw new Error('Membership changed since it was loaded')
    }
    if (!existing && expectedUpdatedAt) throw new Error('Membership no longer exists')

    const joinedAt = status === 'active' && (!existing || existing.status !== 'active') ? new Date() : undefined
    const membershipData = {
      status,
      ...(scopeType === 'dealer-group' ? { accessAllRooftops } : {}),
      role: { connect: { id: roleId } },
      ...(joinedAt ? { joinedAt: joinedAt.toISOString() } : {}),
    }
    let membership: { id: string }
    if (existing) {
      const prismaModel = scopeType === 'dealer-group'
        ? transactionContext.prisma.dealerGroupMembership
        : transactionContext.prisma.rooftopMembership
      const changed = await prismaModel.updateMany({
        where: { id: existing.id, updatedAt: expectedVersion! },
        data: {
          status,
          roleId,
          ...(scopeType === 'dealer-group' ? { accessAllRooftops } : {}),
          ...(joinedAt ? { joinedAt } : {}),
        },
      })
      if (changed.count !== 1) throw new Error('Membership changed since it was loaded')
      membership = { id: existing.id }
    } else {
      membership = await sudo.db[listKey].createOne({
        data: {
          ...membershipData,
          membershipKey,
          user: { connect: { id: targetUserId } },
          [scopeField]: { connect: { id: scopeId } },
          invitedBy: { connect: { id: actorUserId } },
        },
      })
    }

    // The dashboard reads the user's own Role; staff added through a membership
    // without one get the membership role so they can sign in to the dashboard.
    if (status === 'active' && !targetUser.role?.id) {
      await sudo.db.User.updateOne({ where: { id: targetUserId }, data: { role: { connect: { id: roleId } } } })
    }

    const nextSnapshot = {
      id: membership.id,
      status,
      accessAllRooftops: scopeType === 'dealer-group' ? accessAllRooftops : false,
      roleId,
    }
    await sudo.db.MembershipAuditEvent.createOne({
      data: {
        scopeType,
        action: existing ? 'updated' : 'created',
        dealerGroup: { connect: { id: dealerGroupId } },
        ...(rooftopId ? { rooftop: { connect: { id: rooftopId } } } : {}),
        targetUser: { connect: { id: targetUserId } },
        actor: { connect: { id: actorUserId } },
        membershipId: membership.id,
        previousSnapshot: snapshot(existing),
        nextSnapshot,
        reason,
        occurredAt: new Date().toISOString(),
      },
    })

    const saved = await sudo.query[listKey].findOne({ where: { id: membership.id }, query: 'id updatedAt' })
    return { ...nextSnapshot, scopeType, scopeId, updatedAt: new Date(saved.updatedAt) }
  })
}
