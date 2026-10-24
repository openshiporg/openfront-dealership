import { permissions } from '../access'
import { commandDate } from '../lifecycle/commandDate'
import { checkedCents } from '../lifecycle/dealPricing'
import { recordDomainEventInTransaction, type DomainEventInput } from '../lifecycle/domainEvents'
import { lockServiceOrder } from '../lifecycle/serviceOrderAuthority'
import { assertSessionRooftopPermission } from '../tenantRecords'

/** RO lines and tax can change only while the repair is open; completion locks the evidence. */
export const SERVICE_ORDER_EDITABLE_STATUSES = ['estimate', 'approved', 'in-progress']
const LINE_TYPES = ['labor', 'part', 'sublet']

function idempotencyKey(value: unknown) {
  const key = String(value || '').trim()
  if (key.length < 8 || key.length > 180) throw new Error('A valid idempotency key is required')
  return key
}

function required(value: unknown, label: string, max = 500) {
  const result = String(value || '').trim()
  if (!result || result.length > max) throw new Error(`${label} is required and must be at most ${max} characters`)
  return result
}

/**
 * Recomputes the stored RO totals from its lines: labor and sublet roll into labor, parts into
 * parts, and the grand total adds the stored tax. Shared by every line and tax command.
 */
export async function recomputeServiceOrderTotals(tx: any, serviceOrderId: string, taxCents: number) {
  const totals = await tx.prisma.repairOrderLineItem.groupBy({ by: ['itemType'], where: { serviceOrderId }, _sum: { priceCents: true } })
  const sum = (type: string) => totals.find((total: any) => total.itemType === type)?._sum.priceCents ?? 0
  const laborTotalCents = sum('labor') + sum('sublet')
  const partsTotalCents = sum('part')
  const grandTotalCents = laborTotalCents + partsTotalCents + taxCents
  await tx.prisma.serviceOrder.update({ where: { id: serviceOrderId }, data: { laborTotalCents, partsTotalCents, taxCents, grandTotalCents } })
  return { laborTotalCents, partsTotalCents, taxCents, grandTotalCents }
}

async function scopedOrder(context: any, serviceOrderId: unknown) {
  if (!context.session?.itemId || !permissions.canManageService({ session: context.session })) throw new Error('Service management permission is required')
  const order = await context.query.ServiceOrder.findOne({ where: { id: String(serviceOrderId || '') }, query: 'id status updatedAt rooftop { id }' })
  if (!order?.rooftop?.id) throw new Error('Service order not found or not accessible')
  await assertSessionRooftopPermission(context, order.rooftop.id, 'canManageService')
  return order as { id: string; status: string; updatedAt: string; rooftop: { id: string } }
}

/**
 * Locks the RO, replays a prior attempt with the same key (the event hash rejects a changed
 * request), or checks the lifecycle gate and optimistic lock before running `write`.
 */
async function runOrderCommand(
  context: any,
  order: { id: string; status: string; rooftop: { id: string } },
  expectedUpdatedAt: Date,
  event: Omit<DomainEventInput, 'metadata'>,
  write: (tx: any, current: { taxCents: number }) => Promise<Record<string, unknown>>,
) {
  return context.transaction(async (tx: any) => {
    await tx.prisma.$queryRaw`SELECT 1 AS "locked" FROM pg_advisory_xact_lock(hashtextextended(${`command:${event.eventKey}`}, 0))`
    await lockServiceOrder(tx, order.id)
    const replay = await tx.prisma.domainAuditEvent.findUnique({ where: { eventKey: event.eventKey }, select: { aggregateId: true, metadata: true } })
    if (replay) {
      if (replay.aggregateId !== order.id) throw new Error('Idempotency key belongs to another record')
      await recordDomainEventInTransaction(tx, { ...event, metadata: replay.metadata })
      return { reused: true, metadata: replay.metadata as Record<string, unknown> }
    }
    const current = await tx.prisma.serviceOrder.findUnique({ where: { id: order.id }, select: { status: true, updatedAt: true, taxCents: true } })
    if (!current || !SERVICE_ORDER_EDITABLE_STATUSES.includes(current.status)) throw new Error('Service order lines are locked at completion')
    if (current.updatedAt.getTime() !== expectedUpdatedAt.getTime()) throw new Error('Service order changed concurrently; reload and retry')
    const metadata = await write(tx, { taxCents: current.taxCents ?? 0 })
    await recordDomainEventInTransaction(tx, { ...event, metadata })
    return { reused: false, metadata }
  }, { timeout: 30_000 })
}

async function commandResult(context: any, orderId: string, id: string, reused: boolean) {
  const current = await context.query.ServiceOrder.findOne({ where: { id: orderId }, query: 'id status updatedAt' })
  return { id, status: current.status, updatedAt: current.updatedAt, reused }
}

export async function updateServiceOrderLineItem(_root: unknown, { data }: any, context: any) {
  const order = await scopedOrder(context, data.serviceOrderId)
  const lineItemId = required(data.lineItemId, 'Line item', 100)
  const itemType = String(data.itemType || '')
  if (!LINE_TYPES.includes(itemType)) throw new Error('Service line type must be labor, part, or sublet')
  const description = required(data.description, 'Line description', 500)
  const quantity = Number(data.quantity)
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 10_000) throw new Error('Quantity must be greater than zero')
  const unitPriceCents = checkedCents(data.unitPriceCents, 'Unit price')
  const priceCents = Math.round(unitPriceCents * quantity)
  if (priceCents > 2_147_483_647) throw new Error('Line total is out of range')
  const costCents = data.costCents == null ? undefined : checkedCents(data.costCents, 'Line cost')
  if (costCents !== undefined) await assertSessionRooftopPermission(context, order.rooftop.id, 'canViewDealerCost')
  const expectedUpdatedAt = commandDate(data.expectedUpdatedAt)
  const partNumber = String(data.partNumber || '').trim().slice(0, 100)
  const evidence = { serviceOrderId: order.id, lineItemId, itemType, description, partNumber, quantity, unitPriceCents, priceCents, costCents: costCents ?? null, expectedUpdatedAt: expectedUpdatedAt.toISOString() }
  const result = await runOrderCommand(context, order, expectedUpdatedAt, {
    eventKey: `service-line-update:${idempotencyKey(data.idempotencyKey)}`,
    rooftopId: order.rooftop.id, aggregateType: 'ServiceOrder', aggregateId: order.id,
    action: 'line-item-updated', topic: 'service-order.line-item-updated', actorId: context.session.itemId,
    afterSnapshot: evidence,
    payload: { rooftopId: order.rooftop.id, serviceOrderId: order.id, lineItemId, priceCents },
  }, async (tx, current) => {
    const line = await tx.prisma.repairOrderLineItem.findFirst({ where: { id: lineItemId, serviceOrderId: order.id, rooftopId: order.rooftop.id }, select: { id: true, itemType: true, description: true, partNumber: true, quantity: true, unitPriceCents: true, priceCents: true } })
    if (!line) throw new Error('Line item not found on this service order')
    await tx.prisma.repairOrderLineItem.update({ where: { id: line.id }, data: { itemType, description, partNumber, quantity, unitPriceCents, priceCents, ...(costCents !== undefined ? { costCents } : {}) } })
    const totals = await recomputeServiceOrderTotals(tx, order.id, current.taxCents)
    return { lineItemId, before: line, totals }
  })
  return commandResult(context, order.id, lineItemId, result.reused)
}

export async function removeServiceOrderLineItem(_root: unknown, { data }: any, context: any) {
  const order = await scopedOrder(context, data.serviceOrderId)
  const lineItemId = required(data.lineItemId, 'Line item', 100)
  const expectedUpdatedAt = commandDate(data.expectedUpdatedAt)
  const evidence = { serviceOrderId: order.id, lineItemId, expectedUpdatedAt: expectedUpdatedAt.toISOString() }
  const result = await runOrderCommand(context, order, expectedUpdatedAt, {
    eventKey: `service-line-remove:${idempotencyKey(data.idempotencyKey)}`,
    rooftopId: order.rooftop.id, aggregateType: 'ServiceOrder', aggregateId: order.id,
    action: 'line-item-removed', topic: 'service-order.line-item-removed', actorId: context.session.itemId,
    afterSnapshot: evidence,
    payload: { rooftopId: order.rooftop.id, serviceOrderId: order.id, lineItemId },
  }, async (tx, current) => {
    const line = await tx.prisma.repairOrderLineItem.findFirst({ where: { id: lineItemId, serviceOrderId: order.id, rooftopId: order.rooftop.id }, select: { id: true, itemType: true, description: true, partNumber: true, quantity: true, unitPriceCents: true, priceCents: true } })
    if (!line) throw new Error('Line item not found on this service order')
    await tx.prisma.repairOrderLineItem.delete({ where: { id: line.id } })
    const totals = await recomputeServiceOrderTotals(tx, order.id, current.taxCents)
    return { lineItemId, removed: line, totals }
  })
  return commandResult(context, order.id, lineItemId, result.reused)
}

export async function setServiceOrderTax(_root: unknown, { data }: any, context: any) {
  const order = await scopedOrder(context, data.serviceOrderId)
  const taxCents = checkedCents(data.taxCents, 'Tax')
  if (taxCents > 2_147_483_647) throw new Error('Tax is out of range')
  const expectedUpdatedAt = commandDate(data.expectedUpdatedAt)
  const evidence = { serviceOrderId: order.id, taxCents, expectedUpdatedAt: expectedUpdatedAt.toISOString() }
  const result = await runOrderCommand(context, order, expectedUpdatedAt, {
    eventKey: `service-order-tax:${idempotencyKey(data.idempotencyKey)}`,
    rooftopId: order.rooftop.id, aggregateType: 'ServiceOrder', aggregateId: order.id,
    action: 'tax-set', topic: 'service-order.tax-set', actorId: context.session.itemId,
    afterSnapshot: evidence,
    payload: { rooftopId: order.rooftop.id, serviceOrderId: order.id, taxCents },
  }, async (tx, current) => {
    const totals = await recomputeServiceOrderTotals(tx, order.id, taxCents)
    return { previousTaxCents: current.taxCents, totals }
  })
  return commandResult(context, order.id, order.id, result.reused)
}
