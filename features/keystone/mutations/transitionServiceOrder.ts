import { permissions } from '../access'
import { currentServiceOrderAuthority, lockServiceOrder, serviceSettlementEvidence } from '../lifecycle/serviceOrderAuthority'
import { stableJson } from '../lifecycle/domainEvents'
import { assertSessionRooftopPermission } from '../tenantRecords'
import { recordDomainEventInTransaction } from '../lifecycle/domainEvents'
import {
  assertServiceOrderTransition,
  buildServiceOrderEvidenceSnapshot,
  type ServiceOrderStatus,
} from '../lifecycle/serviceOrderLifecycle'

const SERVICE_ORDER_EVIDENCE_QUERY = `
  id status completedAt lockedAt settledAt evidenceSnapshot
  rooftop { id }
  concern cause correction payType authorizationStatus authorizationEvidence inspectionEvidence declinedWork invoiceNumber
  diagnosis workPerformed recommendations laborTotal partsTotal tax grandTotal grandTotalCents
  appointment { id }
  lineItems { id itemType description partNumber quantity unitPrice price cost }
  laborOperations { id operationCode description status technician { id } soldHours actualMinutes timePunches startedAt completedAt }
  partsMovements { id part { id partNumber } movementType quantityDelta onHandAfter committedAfter onOrderAfter reference reason occurredAt }
`

export async function transitionServiceOrder(
  _root: unknown,
  { id, toStatus, idempotencyKey, invoiceNumber }: { id: string; toStatus: ServiceOrderStatus; idempotencyKey: string; invoiceNumber?: string | null },
  context: any
) {
  if (!context.session?.itemId || !permissions.canManageService({ session: context.session })) {
    throw new Error('Service management permission is required')
  }
  const commandKey = String(idempotencyKey || '').trim()
  if (commandKey.length < 8 || commandKey.length > 200) throw new Error('A valid idempotency key is required')
  // The invoice number can be assigned at invoicing, after completion has locked the evidence.
  const assignedInvoiceNumber = String(invoiceNumber || '').trim()
  if (assignedInvoiceNumber && toStatus !== 'invoiced') throw new Error('An invoice number can only be assigned when invoicing')
  if (assignedInvoiceNumber.length > 100) throw new Error('Invoice number must be at most 100 characters')

  return context.transaction(async (transactionContext: any) => {
    await lockServiceOrder(transactionContext, id)
    const authority = await currentServiceOrderAuthority(transactionContext, context.session, id)
    const sessionContext = authority.context
    const order = await sessionContext.query.ServiceOrder.findOne({
      where: { id },
      query: SERVICE_ORDER_EVIDENCE_QUERY,
    })
    if (!order?.rooftop?.id) throw new Error('Service order not found or not accessible')
    await assertSessionRooftopPermission(sessionContext, order.rooftop.id, 'canManageService')
    const eventKey = `service-order-transition:${commandKey}`
    const requestEvidence = assignedInvoiceNumber ? { serviceOrderId: id, toStatus, invoiceNumber: assignedInvoiceNumber } : { serviceOrderId: id, toStatus }
    const replay = await transactionContext.prisma.domainAuditEvent.findUnique({ where: { eventKey }, select: { aggregateId: true, actorId: true, rooftopId: true, afterSnapshot: true, metadata: true } })
    if (replay) {
      if (replay.aggregateId !== id || replay.actorId !== context.session.itemId || replay.rooftopId !== authority.rooftopId || stableJson(replay.afterSnapshot) !== stableJson(requestEvidence)) throw new Error('Service transition retry differs from the original actor, scope or request')
      await recordDomainEventInTransaction(transactionContext, {
        eventKey,
        rooftopId: order.rooftop.id,
        aggregateType: 'ServiceOrder',
        aggregateId: id,
        action: `transitioned:${toStatus}`,
        topic: 'service-order.transitioned',
        actorId: context.session.itemId,
        afterSnapshot: requestEvidence,
        metadata: replay.metadata,
        payload: { serviceOrderId: id, rooftopId: order.rooftop.id, status: toStatus },
      })
      return sessionContext.db.ServiceOrder.findOne({ where: { id } })
    }

    assertServiceOrderTransition(order.status, toStatus)
    if (toStatus === 'approved' && (!String(order.concern || '').trim() || order.authorizationStatus !== 'authorized')) throw new Error('Authorized customer concern evidence is required before repair approval')
    if (toStatus === 'completed' && (!String(order.cause || '').trim() || !String(order.correction || '').trim() || order.laborOperations.some((operation: any) => !['completed', 'cancelled'].includes(operation.status)))) throw new Error('Cause, correction, and completed labor operations are required')
    if (toStatus === 'invoiced' && !assignedInvoiceNumber && !String(order.invoiceNumber || '').trim()) throw new Error('Invoice number is required before invoicing')

    if (toStatus === 'paid') {
      await assertSessionRooftopPermission(sessionContext, authority.rooftopId, 'canViewReports')
      await assertSessionRooftopPermission(sessionContext, authority.rooftopId, 'canManageDealerships')
    }
    const settlement = toStatus === 'paid' ? await serviceSettlementEvidence(transactionContext, id, authority.rooftopId, order.grandTotalCents) : undefined
    const now = new Date()
    const update: Record<string, unknown> = { status: toStatus }
    if (toStatus === 'completed') {
      update.completedAt = now
      update.lockedAt = now
      update.evidenceSnapshot = buildServiceOrderEvidenceSnapshot(order)
    }
    if (toStatus === 'paid') update.settledAt = now
    if (assignedInvoiceNumber) update.invoiceNumber = assignedInvoiceNumber

    const changed = await transactionContext.prisma.serviceOrder.updateMany({
      where: { id, status: order.status },
      data: update,
    })
    if (changed.count !== 1) throw new Error('Service order changed concurrently; reload before retrying')
    await recordDomainEventInTransaction(transactionContext, {
      eventKey,
      rooftopId: order.rooftop.id,
      aggregateType: 'ServiceOrder',
      aggregateId: id,
      action: `transitioned:${toStatus}`,
      topic: 'service-order.transitioned',
      actorId: context.session.itemId,
      afterSnapshot: requestEvidence,
      metadata: settlement ? { settlement } : {},
      payload: { serviceOrderId: id, rooftopId: order.rooftop.id, status: toStatus },
    })

    return sessionContext.db.ServiceOrder.findOne({ where: { id } })
  }, { timeout: 30_000 })
}
