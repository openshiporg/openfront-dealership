/**
 * Lead routing shared by `routeLead` and staff intake (`openLead`): the highest-priority
 * active rule for the lead's source (or `any`) wins, and its first-response SLA starts at assignment.
 */

export const LEAD_SOURCES = ['walk-in', 'website', 'phone', 'referral', 'ad', 'social', 'third-party'] as const

/** Default first-response window for manual assignment, matching `transferLeadOwnership`. */
export const MANUAL_FIRST_RESPONSE_MINUTES = 30

export async function findMatchingRoutingRule(tx: any, rooftopId: string, source: string | null | undefined) {
  return tx.prisma.leadRoutingRule.findFirst({
    where: { rooftopId, active: true, source: { in: [source || 'any', 'any'] } },
    orderBy: [{ priority: 'desc' }, { routeKey: 'asc' }],
  })
}

export async function userHasActiveRooftopAccess(tx: any, userId: string, rooftopId: string) {
  const [groupAccess, directAccess] = await Promise.all([
    tx.prisma.dealerGroupMembership.count({ where: { userId, status: 'active', accessAllRooftops: true, dealerGroup: { rooftops: { some: { id: rooftopId } } } } }),
    tx.prisma.rooftopMembership.count({ where: { userId, status: 'active', rooftopId } }),
  ])
  return groupAccess > 0 || directAccess > 0
}

/**
 * Picks the owner for a new lead: an explicit assignee first, then the matching routing rule
 * (skipped when its assignee lost rooftop access), then the staff member taking the lead.
 */
export async function resolveIntakeAssignment(tx: any, input: {
  rooftopId: string
  source: string
  explicitAssigneeId?: string | null
  actorId: string
  now: Date
}) {
  // The caller checks an explicit assignee with `assertUserRooftopAccess` before the transaction.
  if (input.explicitAssigneeId) {
    return {
      assigneeId: input.explicitAssigneeId,
      routeKey: 'manual-intake',
      reason: 'Assigned at intake',
      firstResponseDueAt: new Date(input.now.getTime() + MANUAL_FIRST_RESPONSE_MINUTES * 60_000),
    }
  }
  const rule = await findMatchingRoutingRule(tx, input.rooftopId, input.source)
  if (rule && await userHasActiveRooftopAccess(tx, rule.assigneeId, input.rooftopId)) {
    return {
      assigneeId: rule.assigneeId as string,
      routeKey: rule.routeKey as string,
      reason: 'Matched active routing rule',
      firstResponseDueAt: new Date(input.now.getTime() + rule.firstResponseMinutes * 60_000),
    }
  }
  return {
    assigneeId: input.actorId,
    routeKey: 'intake-creator',
    reason: rule ? 'Routing assignee has no rooftop access; assigned to intake staff' : 'No routing rule matched; assigned to intake staff',
    firstResponseDueAt: new Date(input.now.getTime() + MANUAL_FIRST_RESPONSE_MINUTES * 60_000),
  }
}
