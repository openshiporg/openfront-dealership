/**
 * Parts commands: part master (configurePart), the stock ledger (recordPartsMovement) and supplier
 * purchase orders (managePartsPurchaseOrder). Stock quantities on PartsInventory change only here, and
 * every change writes a PartsMovement row in the same transaction.
 */
import { permissions } from '../access'
import { commandDate } from '../lifecycle/commandDate'
import { recordDomainEventInTransaction, stableJson } from '../lifecycle/domainEvents'
import { assertSessionRooftopPermission } from '../tenantRecords'

const SERVICE_LINKED_TYPES = new Set(['issue', 'return', 'commit', 'release'])
export const PARTS_MOVEMENT_TYPES = ['receipt', 'issue', 'return', 'adjustment', 'count', 'commit', 'release', 'po-order', 'po-cancel'] as const
const OPEN_ORDER_STATUSES = ['estimate', 'approved', 'in-progress']

function required(value: unknown, label: string, max = 1000) {
  const text = String(value ?? '').trim()
  if (!text || text.length > max) throw new Error(`${label} is required`)
  return text
}

function optionalText(value: unknown, label: string, max = 200) {
  const text = String(value ?? '').trim()
  if (text.length > max) throw new Error(`${label} is too long`)
  return text
}

const idempotency = (value: unknown) => required(value, 'Idempotency key', 200)

function assertServicePermission(context: any) {
  if (!context.session?.itemId || !permissions.canManageService({ session: context.session })) {
    throw new Error('Service permission required')
  }
}

async function advisoryLock(tx: any, key: string) {
  await tx.prisma.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`
}

type Stock = { quantity: number; committedQuantity: number; onOrderQuantity: number }
type StockAfter = { onHand: number; committed: number; onOrder: number; delta: number }

/**
 * Stock math for one movement. `quantity` is the positive movement size; for `count` it is the counted
 * on-hand (zero allowed); for `adjustment` the signed `quantityDelta` is used.
 */
export function computePartsMovement(stock: Stock, type: string, quantity: number, quantityDelta?: number): StockAfter {
  let onHand = Number(stock.quantity || 0)
  let committed = Number(stock.committedQuantity || 0)
  let onOrder = Number(stock.onOrderQuantity || 0)
  let delta = 0
  if (type === 'receipt') {
    onHand += quantity
    onOrder = Math.max(0, onOrder - quantity)
    delta = quantity
  } else if (type === 'issue') {
    onHand -= quantity
    committed = Math.max(0, committed - quantity)
    delta = -quantity
  } else if (type === 'return') {
    onHand += quantity
    delta = quantity
  } else if (type === 'adjustment') {
    delta = Number(quantityDelta)
    if (!Number.isInteger(delta) || delta === 0) throw new Error('Adjustment quantity must be a whole number other than zero')
    onHand += delta
  } else if (type === 'count') {
    delta = quantity - onHand
    onHand = quantity
  } else if (type === 'commit') committed += quantity
  else if (type === 'release') committed -= quantity
  else if (type === 'po-order') onOrder += quantity
  else if (type === 'po-cancel') onOrder -= quantity
  else throw new Error('Invalid parts movement')
  if (onHand < 0) throw new Error('Not enough stock on hand')
  if (committed < 0) throw new Error('Cannot release more than is committed')
  if (onOrder < 0) throw new Error('Cannot cancel more than is on order')
  if (committed > onHand) throw new Error('Committed quantity would exceed stock on hand')
  return { onHand, committed, onOrder, delta }
}

/**
 * Applies one movement inside an open transaction: compare-and-swap on the part's quantities, then the
 * ledger row. A concurrent change to the same part fails the whole transaction.
 */
async function applyMovementInTransaction(tx: any, input: {
  partId: string
  rooftopId: string
  type: string
  quantity: number
  quantityDelta?: number
  serviceOrderId?: string | null
  purchaseOrderId?: string | null
  reference: string
  reason: string
  idempotencyKey: string
  actorId: string
}) {
  const part = await tx.prisma.partsInventory.findFirst({
    where: { id: input.partId, rooftopId: input.rooftopId },
    select: { id: true, partNumber: true, quantity: true, committedQuantity: true, onOrderQuantity: true },
  })
  if (!part) throw new Error('Part not found in this rooftop')
  const after = computePartsMovement(part, input.type, input.quantity, input.quantityDelta)
  const changed = await tx.prisma.partsInventory.updateMany({
    where: { id: part.id, quantity: part.quantity, committedQuantity: part.committedQuantity, onOrderQuantity: part.onOrderQuantity },
    data: { quantity: after.onHand, committedQuantity: after.committed, onOrderQuantity: after.onOrder },
  })
  if (changed.count !== 1) throw new Error('Part inventory changed concurrently')
  const evidence = {
    partId: part.id,
    partNumber: part.partNumber,
    movementType: input.type,
    quantity: input.quantity,
    quantityDelta: after.delta,
    onHandBefore: part.quantity,
    committedBefore: part.committedQuantity,
    onOrderBefore: part.onOrderQuantity,
    onHandAfter: after.onHand,
    committedAfter: after.committed,
    onOrderAfter: after.onOrder,
    reference: input.reference,
    reason: input.reason,
    serviceOrderId: input.serviceOrderId || null,
    purchaseOrderId: input.purchaseOrderId || null,
    actorId: input.actorId,
  }
  const movement = await tx.prisma.partsMovement.create({
    data: {
      rooftopId: input.rooftopId,
      partId: part.id,
      serviceOrderId: input.serviceOrderId || null,
      movementType: input.type,
      quantityDelta: after.delta,
      onHandAfter: after.onHand,
      committedAfter: after.committed,
      onOrderAfter: after.onOrder,
      reference: input.reference,
      reason: input.reason,
      evidence,
      occurredAt: new Date(),
      idempotencyKey: input.idempotencyKey,
    },
    select: { id: true },
  })
  return { movementId: movement.id, before: part, after }
}

/* -------------------------------------------------------------------------- */
/* configurePart                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Creates or edits a part. With `partId` it edits that part (optionally guarded by `expectedUpdatedAt`);
 * without it, it upserts by part number within the rooftop (onboarding relies on this). Quantities are
 * never changed here.
 */
export async function configurePart(_root: unknown, { data }: any, context: any) {
  assertServicePermission(context)
  const partId = String(data.partId || '').trim() || null
  let rooftopId = String(data.rooftopId || '').trim()
  let existing: any = null
  if (partId) {
    existing = await context.query.PartsInventory.findOne({ where: { id: partId }, query: 'id updatedAt rooftop { id }' })
    if (!existing?.rooftop?.id) throw new Error('Part not found or inaccessible')
    rooftopId = existing.rooftop.id
  }
  if (!rooftopId) throw new Error('Rooftop is required')
  await assertSessionRooftopPermission(context, rooftopId, 'canManageService')
  const rooftop = await context.query.Rooftop.findOne({ where: { id: rooftopId }, query: 'id' })
  if (!rooftop) throw new Error('Rooftop inaccessible')

  const partNumber = required(data.partNumber, 'Part number', 100).toUpperCase()
  const description = required(data.description, 'Description')
  const priceCents = Number(data.priceCents)
  const costCents = Number(data.costCents || 0)
  const minimumQuantity = Number(data.minimumQuantity || 0)
  if (!Number.isInteger(priceCents) || priceCents < 0) throw new Error('Price is invalid')
  if (!Number.isInteger(costCents) || costCents < 0) throw new Error('Cost is invalid')
  if (!Number.isInteger(minimumQuantity) || minimumQuantity < 0) throw new Error('Reorder point must be a whole number of zero or more')
  const expectedUpdatedAt = partId && data.expectedUpdatedAt ? commandDate(data.expectedUpdatedAt) : null
  const values = {
    partNumber,
    description,
    binLocation: optionalText(data.binLocation, 'Bin location', 100),
    minimumQuantity,
    priceCents,
    costCents,
    supplier: optionalText(data.supplier, 'Supplier'),
    // Only sent by the parts desk; the onboarding seed leaves an existing value alone.
    ...(data.supplierPartNumber != null ? { supplierPartNumber: optionalText(data.supplierPartNumber, 'Supplier part number', 100) } : {}),
  }
  const eventKey = `part-config:${idempotency(data.idempotencyKey)}`
  // The upsert evidence keeps its original shape so onboarding replays hash the same as before.
  const evidence = partId
    ? { rooftopId: rooftop.id, partId, ...values, expectedUpdatedAt: expectedUpdatedAt?.toISOString() || null }
    : { rooftopId: rooftop.id, ...values }

  const id = await context.transaction(async (tx: any) => {
    await advisoryLock(tx, eventKey)
    await advisoryLock(tx, `part-number:${rooftop.id}:${partNumber}`)
    const event = await recordDomainEventInTransaction(tx, {
      eventKey,
      rooftopId: rooftop.id,
      aggregateType: 'PartsInventory',
      aggregateId: partId || `${rooftop.id}:${partNumber}`,
      action: partId ? 'edited' : 'configured',
      topic: 'parts.configured',
      actorId: context.session.itemId,
      afterSnapshot: evidence,
      payload: evidence,
    })
    const byNumber = await tx.prisma.partsInventory.findFirst({ where: { rooftopId: rooftop.id, partNumber }, select: { id: true } })
    if (event.reused) {
      const replayId = partId || byNumber?.id
      if (!replayId) throw new Error('Part replay missing')
      return replayId
    }
    if (partId) {
      if (byNumber && byNumber.id !== partId) throw new Error(`Part number ${partNumber} is already in use`)
      const changed = await tx.prisma.partsInventory.updateMany({
        where: { id: partId, rooftopId: rooftop.id, ...(expectedUpdatedAt ? { updatedAt: expectedUpdatedAt } : {}) },
        data: values,
      })
      if (changed.count !== 1) throw new Error('Part changed since it was opened; reload and try again')
      return partId
    }
    if (byNumber) {
      await tx.prisma.partsInventory.update({ where: { id: byNumber.id }, data: values })
      return byNumber.id
    }
    const created = await tx.prisma.partsInventory.create({ data: { ...values, rooftopId: rooftop.id }, select: { id: true } })
    return created.id
  }, { timeout: 30_000 })
  return context.db.PartsInventory.findOne({ where: { id } })
}

/* -------------------------------------------------------------------------- */
/* recordPartsMovement                                                        */
/* -------------------------------------------------------------------------- */

export async function recordPartsMovement(_root: unknown, { data }: any, context: any) {
  assertServicePermission(context)
  const part = await context.query.PartsInventory.findOne({ where: { id: String(data.partId || '') }, query: 'id rooftop { id }' })
  if (!part?.rooftop?.id) throw new Error('Part inaccessible')
  const rooftopId = part.rooftop.id
  await assertSessionRooftopPermission(context, rooftopId, 'canManageService')

  const type = required(data.movementType, 'Movement type', 30)
  if (!(PARTS_MOVEMENT_TYPES as readonly string[]).includes(type)) throw new Error('Invalid parts movement')
  const quantity = Number(data.quantity)
  const minimum = type === 'count' ? 0 : 1
  if (!Number.isInteger(quantity) || quantity < minimum) {
    throw new Error(type === 'count' ? 'Counted quantity must be a whole number of zero or more' : 'Quantity must be a whole number of at least 1')
  }
  const serviceOrderId = String(data.serviceOrderId || '').trim() || null
  if (SERVICE_LINKED_TYPES.has(type) && !serviceOrderId) throw new Error('A repair order is required for this parts movement')
  if (serviceOrderId) {
    const serviceOrder = await context.query.ServiceOrder.findOne({ where: { id: serviceOrderId }, query: 'id status rooftop { id }' })
    if (!serviceOrder || serviceOrder.rooftop?.id !== rooftopId || !OPEN_ORDER_STATUSES.includes(serviceOrder.status)) {
      throw new Error('Repair order not found, inaccessible, or closed to parts movements')
    }
  }
  const idempotencyKey = idempotency(data.idempotencyKey)
  const eventKey = `parts-movement:${idempotencyKey}`
  const reference = required(data.reference, 'Reference', 200)
  const reason = required(data.reason, 'Reason')
  const quantityDelta = type === 'adjustment' ? Number(data.quantityDelta) : undefined
  const request = { partId: part.id, movementType: type, quantity, quantityDelta: quantityDelta ?? null, reference, reason, serviceOrderId }

  const id = await context.transaction(async (tx: any) => {
    await advisoryLock(tx, eventKey)
    // A retry returns the movement already posted under this key (including ones written before the
    // request-only audit snapshot, whose hash included stock levels).
    const posted = await tx.prisma.partsMovement.findUnique({ where: { idempotencyKey }, select: { id: true, partId: true, movementType: true } })
    if (posted) {
      if (posted.partId !== part.id || posted.movementType !== type) throw new Error('This movement request was already used for a different part or type')
      return posted.id
    }
    const event = await recordDomainEventInTransaction(tx, {
      eventKey,
      rooftopId,
      aggregateType: 'PartsMovement',
      aggregateId: part.id,
      action: type,
      topic: 'parts.moved',
      actorId: context.session.itemId,
      afterSnapshot: request,
      payload: { rooftopId, partId: part.id, movementType: type, serviceOrderId },
    })
    if (event.reused) {
      const found = await tx.prisma.partsMovement.findUnique({ where: { idempotencyKey }, select: { id: true } })
      if (!found) throw new Error('Movement replay missing')
      return found.id
    }
    if (serviceOrderId) {
      const scopedOrder = await tx.prisma.serviceOrder.findFirst({
        where: { id: serviceOrderId, rooftopId, status: { in: OPEN_ORDER_STATUSES } },
        select: { id: true },
      })
      if (!scopedOrder) throw new Error('Repair order changed or is outside the parts rooftop')
    }
    const applied = await applyMovementInTransaction(tx, {
      partId: part.id, rooftopId, type, quantity, quantityDelta, serviceOrderId, reference, reason, idempotencyKey, actorId: context.session.itemId,
    })
    return applied.movementId
  }, { timeout: 30_000 })
  return context.db.PartsMovement.findOne({ where: { id } })
}

/* -------------------------------------------------------------------------- */
/* managePartsPurchaseOrder                                                   */
/* -------------------------------------------------------------------------- */

export type PurchaseOrderLine = {
  partId: string
  partNumber: string
  description: string
  quantity: number
  unitCostCents: number
  /** Units received so far. */
  receivedQuantity: number
  /** Units this PO still holds in the part's on-order quantity. */
  onOrderQuantity: number
}

const PO_ACTIONS = ['create', 'update', 'order', 'receive', 'close', 'cancel'] as const
type PoAction = (typeof PO_ACTIONS)[number]

/** Which statuses each action may start from. */
export const PO_ACTION_FROM: Record<Exclude<PoAction, 'create'>, string[]> = {
  update: ['draft'],
  order: ['draft'],
  receive: ['ordered', 'partially-received'],
  close: ['partially-received'],
  cancel: ['draft', 'ordered'],
}

function normalizeRequestedLines(value: unknown) {
  if (!Array.isArray(value) || !value.length) throw new Error('Add at least one line')
  if (value.length > 200) throw new Error('A purchase order can have at most 200 lines')
  const lines = value.map((line: any, index: number) => {
    const quantity = Number(line?.quantity)
    const unitCostCents = Number(line?.unitCostCents)
    if (!Number.isInteger(quantity) || quantity <= 0) throw new Error(`Line ${index + 1}: quantity must be a whole number of at least 1`)
    if (!Number.isInteger(unitCostCents) || unitCostCents < 0) throw new Error(`Line ${index + 1}: unit cost is invalid`)
    return { partId: required(line?.partId, `Line ${index + 1}: part`, 100), quantity, unitCostCents }
  })
  if (new Set(lines.map(line => line.partId)).size !== lines.length) throw new Error('Each part can appear on only one line')
  return lines
}

function normalizeReceiptLines(value: unknown) {
  if (value == null) return null
  if (!Array.isArray(value)) throw new Error('Receipt lines are invalid')
  const receipt = new Map<string, number>()
  for (const entry of value as any[]) {
    const partId = required(entry?.partId, 'Receipt part', 100)
    const quantity = Number(entry?.quantity)
    if (!Number.isInteger(quantity) || quantity < 0) throw new Error('Received quantities must be whole numbers of zero or more')
    if (receipt.has(partId)) throw new Error('Each part can be received once per receipt')
    if (quantity > 0) receipt.set(partId, quantity)
  }
  return Object.fromEntries([...receipt.entries()].sort(([a], [b]) => a.localeCompare(b)))
}

function storedLines(value: unknown): PurchaseOrderLine[] {
  return (Array.isArray(value) ? value : []).map((line: any) => ({
    partId: String(line?.partId || ''),
    partNumber: String(line?.partNumber || ''),
    description: String(line?.description || ''),
    quantity: Number(line?.quantity || 0),
    unitCostCents: Number(line?.unitCostCents || 0),
    receivedQuantity: Number(line?.receivedQuantity || 0),
    onOrderQuantity: Number(line?.onOrderQuantity || 0),
  }))
}

/**
 * Purchase-order lifecycle. Every stock effect posts PartsMovement rows in the same transaction as the
 * PO update:
 *   order   draft -> ordered; posts `po-order` per line (on-order up).
 *   receive ordered | partially-received -> partially-received | received; posts `receipt` per received
 *           line (on-hand up, on-order down). Without `receiptLines` it receives everything outstanding.
 *   close   partially-received -> received; posts `po-cancel` for what is still on order.
 *   cancel  draft | ordered -> cancelled; posts `po-cancel` for what is on order.
 * Retries with the same idempotency key and request return the saved PO without posting again.
 */
export async function managePartsPurchaseOrder(_root: unknown, { data }: any, context: any) {
  assertServicePermission(context)
  const action = required(data.action, 'Purchase-order action', 30) as PoAction
  if (!(PO_ACTIONS as readonly string[]).includes(action)) throw new Error('Invalid purchase-order action')
  const idempotencyKey = idempotency(data.idempotencyKey)
  const eventKey = `parts-po:${idempotencyKey}`
  const purchaseOrderId = action === 'create' ? null : required(data.purchaseOrderId, 'Purchase order', 100)

  let rooftopId = String(data.rooftopId || '').trim()
  if (purchaseOrderId) {
    const visible = await context.query.PartsPurchaseOrder.findOne({ where: { id: purchaseOrderId }, query: 'id rooftop { id }' })
    if (!visible?.rooftop?.id) throw new Error('Purchase order not found or inaccessible')
    rooftopId = visible.rooftop.id
  }
  if (!rooftopId) throw new Error('Rooftop is required')
  await assertSessionRooftopPermission(context, rooftopId, 'canManageService')

  const request: Record<string, unknown> = { version: 2, action, purchaseOrderId, rooftopId }
  if (action === 'create' || action === 'update') {
    request.reference = required(data.reference, 'PO reference', 100).toUpperCase()
    request.supplier = required(data.supplier, 'Supplier', 200)
    request.lines = normalizeRequestedLines(data.lines)
  }
  if (action === 'receive') request.receiptLines = normalizeReceiptLines(data.receiptLines)
  if (action !== 'create' && data.expectedUpdatedAt) request.expectedUpdatedAt = commandDate(data.expectedUpdatedAt).toISOString()
  const actorId = String(context.session.itemId)

  const id = await context.transaction(async (tx: any) => {
    await advisoryLock(tx, eventKey)
    const prior = await tx.prisma.domainAuditEvent.findUnique({ where: { eventKey } })
    if (prior) {
      const snapshot: any = prior.afterSnapshot
      if (prior.actorId !== actorId || prior.rooftopId !== rooftopId || snapshot?.request?.version !== 2 || stableJson(snapshot.request) !== stableJson(request)) {
        throw new Error('This purchase-order request was already used with different details')
      }
      return prior.aggregateId
    }

    let current: any = null
    if (purchaseOrderId) {
      await advisoryLock(tx, `parts-po-row:${purchaseOrderId}`)
      current = await tx.prisma.partsPurchaseOrder.findFirst({ where: { id: purchaseOrderId, rooftopId } })
      if (!current) throw new Error('Purchase order not found')
      if (request.expectedUpdatedAt && new Date(current.updatedAt).toISOString() !== request.expectedUpdatedAt) {
        throw new Error('Purchase order changed since it was opened; reload and try again')
      }
      const allowed = PO_ACTION_FROM[action as Exclude<PoAction, 'create'>]
      if (!allowed.includes(current.status)) throw new Error(`Cannot ${action} a ${current.status} purchase order`)
    }

    let lines = storedLines(current?.lines)
    let status: string = current?.status || 'draft'
    let orderedAt: Date | null = current?.orderedAt || null
    let receivedAt: Date | null = current?.receivedAt || null
    const movements: Array<{ partId: string; type: string; quantity: number; movementId: string }> = []
    const poReference = String(request.reference || current?.reference || '')
    const post = async (line: PurchaseOrderLine, type: string, quantity: number, reason: string, index: number) => {
      const applied = await applyMovementInTransaction(tx, {
        partId: line.partId,
        rooftopId,
        type,
        quantity,
        purchaseOrderId: purchaseOrderId,
        reference: `PO ${poReference}`,
        reason,
        idempotencyKey: `${eventKey}:${type}:${index}`,
        actorId,
      })
      movements.push({ partId: line.partId, type, quantity, movementId: applied.movementId })
      return applied
    }

    if (action === 'create' || action === 'update') {
      const requested = request.lines as Array<{ partId: string; quantity: number; unitCostCents: number }>
      const parts = await tx.prisma.partsInventory.findMany({
        where: { rooftopId, id: { in: requested.map(line => line.partId) } },
        select: { id: true, partNumber: true, description: true },
      })
      const byId = new Map(parts.map((part: any) => [part.id, part]))
      lines = requested.map((line, index) => {
        const part: any = byId.get(line.partId)
        if (!part) throw new Error(`Line ${index + 1}: part is not in this rooftop`)
        return { ...line, partNumber: part.partNumber, description: part.description, receivedQuantity: 0, onOrderQuantity: 0 }
      })
      const duplicate = await tx.prisma.partsPurchaseOrder.findFirst({
        where: { rooftopId, reference: request.reference, ...(purchaseOrderId ? { NOT: { id: purchaseOrderId } } : {}) },
        select: { id: true },
      })
      if (duplicate) throw new Error(`PO reference ${request.reference} is already in use`)
    } else if (action === 'order') {
      if (!lines.length) throw new Error('Add at least one line before ordering')
      for (const [index, line] of lines.entries()) {
        await post(line, 'po-order', line.quantity, 'Purchase order placed', index)
        line.onOrderQuantity = line.quantity
      }
      status = 'ordered'
      orderedAt = new Date()
    } else if (action === 'receive') {
      const receipt = request.receiptLines as Record<string, number> | null
      let received = 0
      for (const [index, line] of lines.entries()) {
        const outstanding = Math.max(0, line.quantity - line.receivedQuantity)
        const quantity = receipt ? Number(receipt[line.partId] || 0) : outstanding
        if (!quantity) continue
        if (quantity > outstanding) throw new Error(`${line.partNumber || 'Line ' + (index + 1)}: only ${outstanding} still outstanding`)
        const applied = await post(line, 'receipt', quantity, 'Purchase order received', index)
        line.receivedQuantity += quantity
        line.onOrderQuantity = Math.max(0, line.onOrderQuantity - (applied.before.onOrderQuantity - applied.after.onOrder))
        received += quantity
      }
      if (receipt && Object.keys(receipt).some(partId => !lines.some(line => line.partId === partId))) {
        throw new Error('Receipt includes a part that is not on this purchase order')
      }
      if (!received) throw new Error('Enter a received quantity for at least one line')
      const complete = lines.every(line => line.receivedQuantity >= line.quantity)
      status = complete ? 'received' : 'partially-received'
      if (complete) receivedAt = new Date()
    } else if (action === 'close' || action === 'cancel') {
      for (const [index, line] of lines.entries()) {
        if (line.onOrderQuantity <= 0) continue
        const part = await tx.prisma.partsInventory.findFirst({ where: { id: line.partId, rooftopId }, select: { onOrderQuantity: true } })
        const release = Math.min(line.onOrderQuantity, Number(part?.onOrderQuantity || 0))
        if (release > 0) await post(line, 'po-cancel', release, action === 'close' ? 'Purchase order closed short' : 'Purchase order cancelled', index)
        line.onOrderQuantity = 0
      }
      status = action === 'close' ? 'received' : 'cancelled'
      if (action === 'close') receivedAt = new Date()
    }

    let savedId: string
    const values = {
      reference: poReference,
      supplier: String(request.supplier || current?.supplier || ''),
      status,
      lines,
      orderedAt,
      receivedAt,
    }
    if (current) {
      const changed = await tx.prisma.partsPurchaseOrder.updateMany({
        where: { id: current.id, status: current.status, updatedAt: current.updatedAt },
        data: values,
      })
      if (changed.count !== 1) throw new Error('Purchase order changed concurrently')
      savedId = current.id
    } else {
      const created = await tx.prisma.partsPurchaseOrder.create({ data: { ...values, rooftopId, idempotencyKey }, select: { id: true } })
      savedId = created.id
    }

    await recordDomainEventInTransaction(tx, {
      eventKey,
      rooftopId,
      aggregateType: 'PartsPurchaseOrder',
      aggregateId: savedId,
      action,
      topic: 'parts-purchase-order.updated',
      actorId,
      afterSnapshot: { request, status, movements },
      payload: { rooftopId, purchaseOrderId: savedId, reference: poReference, status, movementCount: movements.length },
    })
    return savedId
  }, { timeout: 30_000 })
  return context.db.PartsPurchaseOrder.findOne({ where: { id } })
}
