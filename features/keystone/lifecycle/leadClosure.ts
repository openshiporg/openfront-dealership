import { recordDomainEventInTransaction } from './domainEvents'

/**
 * System transition, not an operator one: a delivered deal is proof of the sale, so the buyer's
 * lead closes as won from any status. The operator map (`transitionLead`) still forbids staff
 * from jumping e.g. new -> closed-won by hand; delivery evidence is what allows it here.
 * A lead previously closed as lost is reopened as won, because the customer bought.
 */
export const DELIVERY_CLOSE_WON_FROM = ['new', 'contacted', 'test-drive-scheduled', 'negotiating', 'closed-lost'] as const

// Keystone 6.5's Prisma extension resolves a failed query to an error object instead of throwing.
function failed(result: unknown) {
  return !result || result instanceof Error || (typeof result === 'object' && (result as any).extensions?.code === 'KS_PRISMA_ERROR')
}

/** Runs inside the delivery transaction; returns the status the lead moved from, or null when already won. */
export async function closeLeadWonOnDelivery(tx: any, input: { dealId: string; leadId: string | null; rooftopId: string; actorId: string; deliveryEventKey: string; occurredAt: Date }) {
  if (!input.leadId) return null
  const lead = await tx.prisma.lead.findUnique({ where: { id: input.leadId }, select: { id: true, rooftopId: true, status: true, cadenceStatus: true } })
  if (failed(lead) || lead.rooftopId !== input.rooftopId) throw new Error('The buyer\'s lead is unavailable at this rooftop')
  const fromStatus = String(lead.status || 'new')
  if (fromStatus === 'closed-won') return null
  if (!(DELIVERY_CLOSE_WON_FROM as readonly string[]).includes(fromStatus)) throw new Error(`The buyer's lead can't be closed from ${fromStatus}`)
  const changed = await tx.prisma.lead.updateMany({
    where: { id: lead.id, rooftopId: input.rooftopId, status: lead.status },
    data: {
      status: 'closed-won',
      lostReasonCode: null,
      ...(['active', 'paused'].includes(lead.cadenceStatus) ? { cadenceStatus: 'completed', cadenceDueAt: null } : {}),
    },
  })
  if (failed(changed) || changed.count !== 1) throw new Error('The buyer\'s lead changed concurrently; reload and retry')
  await recordDomainEventInTransaction(tx, {
    eventKey: `${input.deliveryEventKey}:lead-closed-won`,
    rooftopId: input.rooftopId,
    aggregateType: 'Lead', aggregateId: lead.id, action: 'transitioned:closed-won', topic: 'lead.transitioned',
    actorId: input.actorId, occurredAt: input.occurredAt,
    afterSnapshot: { leadId: lead.id, fromStatus, toStatus: 'closed-won', source: 'deal-delivery', dealId: input.dealId },
    payload: { leadId: lead.id, rooftopId: input.rooftopId, status: 'closed-won', dealId: input.dealId },
  })
  return fromStatus
}
