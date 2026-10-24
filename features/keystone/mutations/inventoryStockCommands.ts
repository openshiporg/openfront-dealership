import { randomUUID } from 'node:crypto'

import { permissions } from '../access'
import { commandDate } from '../lifecycle/commandDate'
import { assertActiveInventory } from './inventoryActiveStatus'
import { inventoryCommand } from './inventoryCommandErrors'
import { recordDomainEventInTransaction, type DomainEventInput } from '../lifecycle/domainEvents'
import { assertReconTransition, inventoryStockKey, nonNegativeCents, normalizeStockNumber } from '../lifecycle/inventoryOperationsLifecycle'
import { assertSessionRooftopPermission, assertUserRooftopAccess } from '../tenantRecords'

function text(value: unknown, label: string, max = 500) {
  const result = String(value || '').trim()
  if (!result || result.length > max) throw new Error(`${label} is required and must be at most ${max} characters`)
  return result
}

function commandKey(value: unknown) {
  const result = String(value || '').trim()
  if (result.length < 8 || result.length > 180) throw new Error('A valid idempotency key is required')
  return result
}

function requireInventory(context: any) {
  if (!context.session?.itemId || !permissions.canManageInventory({ session: context.session })) {
    throw new Error('Inventory management permission is required')
  }
}

async function accessibleStock(context: any, id: string) {
  const stock = await context.query.InventoryStock.findOne({
    where: { id },
    query: 'id stockNumber locationCode locationLabel reconStatus merchandisingStatus feedStatus stockedAt updatedAt rooftop { id } vehicle { id vin stockNumber status } acquisition { id }',
  })
  if (!stock?.rooftop?.id) throw new Error('Inventory stock not found or not accessible')
  await assertSessionRooftopPermission(context, stock.rooftop.id, 'canManageInventory')
  return stock
}

async function commandEvent(tx: any, event: DomainEventInput) {
  const result = await recordDomainEventInTransaction(tx, event)
  return result.reused
}

async function stockEvent(tx: any, event: DomainEventInput, eventType: string, reason: string, amountCents?: number, evidence: unknown = {}) {
  await tx.prisma.inventoryStockEvent.create({
    data: {
      rooftopId: event.rooftopId,
      stockId: event.aggregateId,
      eventKey: event.eventKey,
      eventType,
      reason,
      amountCents,
      evidence,
      actorId: event.actorId ?? null,
      occurredAt: event.occurredAt ?? new Date(),
    },
  })
}

async function result(context: any, stockId: string, reused: boolean, relatedId?: string) {
  const stock = await context.sudo().prisma.inventoryStock.findUnique({ where: { id: stockId }, select: { id: true, updatedAt: true, reconStatus: true, merchandisingStatus: true, feedStatus: true } })
  if (!stock) throw new Error('Inventory stock no longer exists')
  return { id: relatedId ?? stock.id, stockId: stock.id, status: stock.reconStatus, merchandisingStatus: stock.merchandisingStatus, feedStatus: stock.feedStatus, updatedAt: stock.updatedAt, reused }
}

const STOCKABLE_ACQUISITION_STATUSES = ['purchased', 'arrived', 'reconditioning']
const VEHICLE_CONDITIONS = ['new', 'used', 'certified']

function optionalText(value: unknown, label: string, max: number) {
  const result = String(value ?? '').trim()
  if (result.length > max) throw new Error(`${label} must be at most ${max} characters`)
  return result
}

/**
 * Stocks a unit. With `vehicleId` it stocks an existing vehicle. With only `acquisitionId` it receives a
 * purchased acquisition: it creates the Vehicle from the acquisition (VIN, year, make, model, odometer,
 * purchase cost) as `service` (in prep), links it to the acquisition and stocks it.
 */
async function establishInventoryStockCommand(_root: unknown, { data }: any, context: any) {
  requireInventory(context)
  if (!data.vehicleId && data.acquisitionId) return receiveAcquisitionIntoStock(data, context)
  const vehicleId = String(data.vehicleId || '')
  if (!vehicleId) throw new Error('A vehicle or a purchased acquisition is required')
  const vehicle = await context.query.Vehicle.findOne({ where: { id: vehicleId }, query: 'id vin stockNumber rooftop { id } acquisition { id status purchaseCents arrivedAt frontlineAt }' })
  if (!vehicle?.rooftop?.id) throw new Error('Vehicle not found or not accessible')
  const rooftopId = vehicle.rooftop.id
  await assertSessionRooftopPermission(context, rooftopId, 'canManageInventory')
  const stockNumber = normalizeStockNumber(data.stockNumber || vehicle.stockNumber)
  const stockKey = inventoryStockKey(rooftopId, stockNumber)
  const locationCode = text(data.locationCode, 'Location code', 80).toUpperCase()
  const locationLabel = String(data.locationLabel || '').trim().slice(0, 200)
  const idempotencyKey = commandKey(data.idempotencyKey)
  const reason = text(data.reason, 'Audit reason')
  const acquisitionId = data.acquisitionId ? String(data.acquisitionId) : vehicle.acquisition?.id ?? null
  if (data.acquisitionId && acquisitionId !== vehicle.acquisition?.id) throw new Error('Acquisition must be attached to the same vehicle')
  const purchaseCostCents = nonNegativeCents(data.purchaseCostCents ?? vehicle.acquisition?.purchaseCents ?? 0, 'Purchase cost')
  const evidence = { vehicleId, acquisitionId, stockNumber, locationCode, locationLabel, purchaseCostCents, reason }
  const eventKey = `inventory-stock-establish:${idempotencyKey}`
  const command = await context.transaction(async (tx: any) => {
    await tx.prisma.$queryRaw`SELECT 1 AS "locked" FROM pg_advisory_xact_lock(hashtextextended(${`command:${eventKey}`}, 0))`
    const replay = await tx.prisma.domainAuditEvent.findUnique({ where: { eventKey }, select: { aggregateId: true } })
    if (replay) {
      await recordDomainEventInTransaction(tx, { eventKey, rooftopId, aggregateType: 'InventoryStock', aggregateId: replay.aggregateId, action: 'established', topic: 'inventory-stock.established', actorId: context.session.itemId, afterSnapshot: evidence, payload: { stockId: replay.aggregateId, rooftopId, ...evidence } })
      return { id: replay.aggregateId, reused: true }
    }
    const existing = await tx.prisma.inventoryStock.findFirst({ where: { OR: [{ stockKey }, { vehicleId }] }, select: { id: true } })
    if (existing) throw new Error('Vehicle or rooftop stock number already has an inventory stock record')
    const id = randomUUID()
    const stockedAt = vehicle.acquisition?.arrivedAt ? new Date(vehicle.acquisition.arrivedAt) : new Date()
    await tx.prisma.inventoryStock.create({ data: { id, rooftopId, vehicleId, stockNumber, stockKey, locationCode, locationLabel, stockedAt, frontlineAt: vehicle.acquisition?.frontlineAt ? new Date(vehicle.acquisition.frontlineAt) : null, purchaseCostCents, totalCostCents: purchaseCostCents } })
    await tx.prisma.vehicle.update({ where: { id: vehicleId }, data: { stockNumber } })
    if (acquisitionId) {
      const attached = await tx.prisma.inventoryAcquisition.updateMany({ where: { id: acquisitionId, rooftopId, vehicleId, stockId: null }, data: { stockId: id } })
      if (attached.count !== 1) throw new Error('Acquisition changed concurrently or is already stocked')
    }
    const event: DomainEventInput = { eventKey, rooftopId, aggregateType: 'InventoryStock', aggregateId: id, action: 'established', topic: 'inventory-stock.established', actorId: context.session.itemId, afterSnapshot: evidence, payload: { stockId: id, rooftopId, ...evidence } }
    await recordDomainEventInTransaction(tx, event)
    await stockEvent(tx, event, 'established', reason, purchaseCostCents, evidence)
    return { id, reused: false }
  }, { timeout: 30_000 })
  return result(context, command.id, command.reused)
}

async function receiveAcquisitionIntoStock(data: any, context: any) {
  const acquisitionId = String(data.acquisitionId || '')
  const acquisition = await context.query.InventoryAcquisition.findOne({ where: { id: acquisitionId }, query: 'id reference status vin year make model odometer purchaseCents rooftop { id } vehicle { id } stock { id }' })
  if (!acquisition?.rooftop?.id) throw new Error('Inventory acquisition not found or not accessible')
  const rooftopId = acquisition.rooftop.id
  await assertSessionRooftopPermission(context, rooftopId, 'canManageInventory')
  const stockNumber = normalizeStockNumber(data.stockNumber)
  const stockKey = inventoryStockKey(rooftopId, stockNumber)
  const locationCode = text(data.locationCode, 'Location code', 80).toUpperCase()
  const locationLabel = String(data.locationLabel || '').trim().slice(0, 200)
  const idempotencyKey = commandKey(data.idempotencyKey)
  const reason = text(data.reason, 'Audit reason')
  const condition = String(data.condition || 'used').trim()
  if (!VEHICLE_CONDITIONS.includes(condition)) throw new Error('Condition must be new, used or certified')
  const trim = optionalText(data.trim, 'Trim', 100)
  const exteriorColor = optionalText(data.exteriorColor, 'Exterior colour', 100)
  const interiorColor = optionalText(data.interiorColor, 'Interior colour', 100)
  const purchaseCostCents = nonNegativeCents(data.purchaseCostCents ?? acquisition.purchaseCents ?? 0, 'Purchase cost')
  const evidence = { acquisitionId, stockNumber, locationCode, locationLabel, purchaseCostCents, condition, trim, exteriorColor, interiorColor, reason }
  const eventKey = `inventory-stock-establish:${idempotencyKey}`
  const command = await context.transaction(async (tx: any) => {
    await tx.prisma.$queryRaw`SELECT 1 AS "locked" FROM pg_advisory_xact_lock(hashtextextended(${`command:${eventKey}`}, 0))`
    const replay = await tx.prisma.domainAuditEvent.findUnique({ where: { eventKey }, select: { aggregateId: true } })
    if (replay) {
      await recordDomainEventInTransaction(tx, { eventKey, rooftopId, aggregateType: 'InventoryStock', aggregateId: replay.aggregateId, action: 'established', topic: 'inventory-stock.established', actorId: context.session.itemId, afterSnapshot: evidence, payload: { stockId: replay.aggregateId, rooftopId, ...evidence } })
      return { id: replay.aggregateId, reused: true }
    }
    const current = await tx.prisma.inventoryAcquisition.findUnique({ where: { id: acquisitionId }, select: { status: true, vin: true, year: true, make: true, model: true, odometer: true, vehicleId: true, stockId: true, arrivedAt: true } })
    if (!current) throw new Error('Inventory acquisition no longer exists')
    if (!STOCKABLE_ACQUISITION_STATUSES.includes(current.status)) throw new Error('Only a purchased, arrived or reconditioning acquisition can be stocked')
    if (current.vehicleId || current.stockId) throw new Error('This acquisition already has a vehicle; stock it from the vehicle')
    const rooftop = await tx.prisma.rooftop.findUnique({ where: { id: rooftopId }, select: { status: true } })
    if (rooftop?.status !== 'active') throw new Error('Vehicle rooftop must remain active')
    const vinTaken = await tx.prisma.vehicle.findFirst({ where: { vin: current.vin }, select: { id: true } })
    if (vinTaken) throw new Error('A vehicle with this VIN already exists')
    const stockTaken = await tx.prisma.inventoryStock.findFirst({ where: { stockKey }, select: { id: true } })
    const vehicleStockTaken = await tx.prisma.vehicle.findFirst({ where: { stockNumber }, select: { id: true } })
    if (stockTaken || vehicleStockTaken) throw new Error('Stock number already exists')
    const vehicle = await tx.prisma.vehicle.create({
      data: {
        rooftopId, vin: current.vin, stockNumber, year: current.year, make: current.make, model: current.model, trim, exteriorColor, interiorColor,
        mileage: current.odometer ?? null, purchasePriceCents: purchaseCostCents, condition, status: 'service', description: '', features: [],
        metadata: { provenance: { mode: 'acquisition-receipt', acquisitionId, reference: acquisition.reference, intakeEventKey: eventKey } },
      },
      select: { id: true },
    })
    const id = randomUUID()
    const stockedAt = current.arrivedAt ? new Date(current.arrivedAt) : new Date()
    await tx.prisma.inventoryStock.create({ data: { id, rooftopId, vehicleId: vehicle.id, stockNumber, stockKey, locationCode, locationLabel, stockedAt, purchaseCostCents, totalCostCents: purchaseCostCents } })
    const attached = await tx.prisma.inventoryAcquisition.updateMany({ where: { id: acquisitionId, rooftopId, vehicleId: null, stockId: null }, data: { vehicleId: vehicle.id, stockId: id } })
    if (attached.count !== 1) throw new Error('Acquisition changed concurrently or is already stocked')
    const stockEvidence = { ...evidence, vehicleId: vehicle.id }
    const event: DomainEventInput = { eventKey, rooftopId, aggregateType: 'InventoryStock', aggregateId: id, action: 'established', topic: 'inventory-stock.established', actorId: context.session.itemId, afterSnapshot: evidence, payload: { stockId: id, rooftopId, ...evidence } }
    await recordDomainEventInTransaction(tx, event)
    await stockEvent(tx, event, 'established', reason, purchaseCostCents, stockEvidence)
    return { id, reused: false }
  }, { timeout: 30_000 })
  return result(context, command.id, command.reused)
}

async function moveInventoryStockCommand(_root: unknown, { data }: any, context: any) {
  requireInventory(context)
  const stock = await accessibleStock(context, String(data.stockId || ''))
  const locationCode = text(data.locationCode, 'Location code', 80).toUpperCase()
  const locationLabel = String(data.locationLabel || '').trim().slice(0, 200)
  const reason = text(data.reason, 'Audit reason')
  const expectedUpdatedAt = commandDate(data.expectedUpdatedAt)
  const eventKey = `inventory-stock-move:${commandKey(data.idempotencyKey)}`
  const evidence = { stockId: stock.id, toLocationCode: locationCode, locationLabel, expectedUpdatedAt: expectedUpdatedAt.toISOString(), reason }
  const reused = await context.transaction(async (tx: any) => {
    const event: DomainEventInput = { eventKey, rooftopId: stock.rooftop.id, aggregateType: 'InventoryStock', aggregateId: stock.id, action: 'moved', topic: 'inventory-stock.moved', actorId: context.session.itemId, afterSnapshot: evidence, payload: { rooftopId: stock.rooftop.id, ...evidence } }
    if (await commandEvent(tx, event)) return true
    const changed = await tx.prisma.inventoryStock.updateMany({ where: { id: stock.id, rooftopId: stock.rooftop.id, updatedAt: expectedUpdatedAt }, data: { locationCode, locationLabel } })
    if (changed.count !== 1) throw new Error('Inventory stock changed concurrently; reload and retry')
    await stockEvent(tx, event, 'moved', reason, undefined, evidence)
    return false
  }, { timeout: 30_000 })
  return result(context, stock.id, reused)
}

async function recordInventoryCostCommand(_root: unknown, { data }: any, context: any) {
  requireInventory(context)
  const stock = await accessibleStock(context, String(data.stockId || ''))
  const costType = String(data.costType || '')
  if (!['reconditioning', 'transport', 'auction-fee', 'detail', 'other'].includes(costType)) throw new Error('Unsupported inventory cost type')
  const amountCents = nonNegativeCents(data.amountCents, 'Cost amount')
  if (amountCents === 0) throw new Error('Cost amount must be greater than zero')
  const reason = text(data.reason, 'Audit reason')
  const eventKey = `inventory-stock-cost:${commandKey(data.idempotencyKey)}`
  const evidence = { stockId: stock.id, costType, amountCents, reference: String(data.reference || '').trim().slice(0, 200) || null, reason }
  const reused = await context.transaction(async (tx: any) => {
    const event: DomainEventInput = { eventKey, rooftopId: stock.rooftop.id, aggregateType: 'InventoryStock', aggregateId: stock.id, action: `cost-recorded:${costType}`, topic: 'inventory-stock.cost-recorded', actorId: context.session.itemId, afterSnapshot: evidence, payload: { rooftopId: stock.rooftop.id, ...evidence } }
    if (await commandEvent(tx, event)) return true
    await tx.prisma.inventoryStock.update({
      where: { id: stock.id },
      data: costType === 'reconditioning'
        ? { reconCostCents: { increment: amountCents }, totalCostCents: { increment: amountCents } }
        : { otherCostCents: { increment: amountCents }, totalCostCents: { increment: amountCents } },
    })
    await stockEvent(tx, event, `cost:${costType}`, reason, amountCents, evidence)
    return false
  }, { timeout: 30_000 })
  return result(context, stock.id, reused)
}

async function openInventoryReconWorkItemCommand(_root: unknown, { data }: any, context: any) {
  requireInventory(context)
  const stock = await accessibleStock(context, String(data.stockId || ''))
  assertActiveInventory(stock.vehicle?.status)
  const title = text(data.title, 'Work item title', 200)
  const category = String(data.category || '')
  if (!['mechanical', 'body', 'detail', 'tires', 'inspection', 'other'].includes(category)) throw new Error('Unsupported reconditioning category')
  const estimatedCostCents = data.estimatedCostCents == null ? null : nonNegativeCents(data.estimatedCostCents, 'Estimated cost')
  const vendorName = optionalText(data.vendorName, 'Vendor', 200)
  const assignedToId = data.assignedToId ? String(data.assignedToId) : null
  if (assignedToId) await assertUserRooftopAccess(context, assignedToId, stock.rooftop.id)
  const dueAt = data.dueAt ? new Date(data.dueAt) : null
  if (dueAt && Number.isNaN(dueAt.getTime())) throw new Error('dueAt is invalid')
  const idempotencyKey = commandKey(data.idempotencyKey)
  const eventKey = `inventory-recon-create:${idempotencyKey}`
  const itemId = randomUUID()
  const reason = text(data.reason, 'Audit reason')
  const evidence = { stockId: stock.id, title, category, estimatedCostCents, vendorName, assignedToId, dueAt: dueAt?.toISOString() ?? null, reason }
  const resolvedId = await context.transaction(async (tx: any) => {
    await tx.prisma.$queryRaw`SELECT 1 AS "locked" FROM pg_advisory_xact_lock(hashtextextended(${`command:${eventKey}`}, 0))`
    const replay = await tx.prisma.domainAuditEvent.findUnique({ where: { eventKey }, select: { aggregateId: true, metadata: true } })
    if (replay) {
      const priorItemId = String((replay.metadata as any)?.workItemId || '')
      await recordDomainEventInTransaction(tx, { eventKey, rooftopId: stock.rooftop.id, aggregateType: 'InventoryStock', aggregateId: stock.id, action: 'recon-work-created', topic: 'inventory-recon.created', actorId: context.session.itemId, afterSnapshot: evidence, metadata: { workItemId: priorItemId }, payload: { rooftopId: stock.rooftop.id, ...evidence, workItemId: priorItemId } })
      return priorItemId
    }
    await tx.prisma.inventoryReconWorkItem.create({ data: { id: itemId, rooftopId: stock.rooftop.id, stockId: stock.id, title, category, status: 'open', estimatedCostCents, vendorName, assignedToId, dueAt } })
    await tx.prisma.inventoryStock.update({ where: { id: stock.id }, data: { reconStatus: 'in-progress' } })
    const event: DomainEventInput = { eventKey, rooftopId: stock.rooftop.id, aggregateType: 'InventoryStock', aggregateId: stock.id, action: 'recon-work-created', topic: 'inventory-recon.created', actorId: context.session.itemId, afterSnapshot: evidence, metadata: { workItemId: itemId }, payload: { rooftopId: stock.rooftop.id, ...evidence, workItemId: itemId } }
    await recordDomainEventInTransaction(tx, event)
    await stockEvent(tx, event, 'recon-work-created', reason, estimatedCostCents ?? undefined, { ...evidence, workItemId: itemId })
    return itemId
  }, { timeout: 30_000 })
  return result(context, stock.id, resolvedId !== itemId, resolvedId)
}

async function transitionInventoryReconWorkItemCommand(_root: unknown, { data }: any, context: any) {
  requireInventory(context)
  const item = await context.query.InventoryReconWorkItem.findOne({ where: { id: String(data.id || '') }, query: 'id status updatedAt stock { id rooftop { id } vehicle { status } }' })
  if (!item?.stock?.rooftop?.id) throw new Error('Reconditioning work item not found or not accessible')
  if (String(data.toStatus || '') !== 'cancelled') assertActiveInventory(item.stock.vehicle?.status)
  await assertSessionRooftopPermission(context, item.stock.rooftop.id, 'canManageInventory')
  const toStatus = String(data.toStatus || '')
  const actualCostCents = data.actualCostCents == null ? null : nonNegativeCents(data.actualCostCents, 'Actual cost')
  if (toStatus === 'completed' && actualCostCents == null) throw new Error('Completed work requires actual cost evidence')
  // DateTime arrives as a Date; String(Date) drops milliseconds and the updatedAt CAS below never matches.
  const expectedUpdatedAt = commandDate(data.expectedUpdatedAt)
  const reason = text(data.reason, 'Audit reason')
  const eventKey = `inventory-recon-transition:${commandKey(data.idempotencyKey)}`
  const evidence = { workItemId: item.id, stockId: item.stock.id, toStatus, actualCostCents, expectedUpdatedAt: expectedUpdatedAt.toISOString(), reason }
  const priorEvent = await context.sudo().prisma.domainAuditEvent.findUnique({ where: { eventKey }, select: { id: true } })
  if (!priorEvent) assertReconTransition(item.status, toStatus)
  const reused = await context.transaction(async (tx: any) => {
    const event: DomainEventInput = { eventKey, rooftopId: item.stock.rooftop.id, aggregateType: 'InventoryStock', aggregateId: item.stock.id, action: `recon-work:${toStatus}`, topic: 'inventory-recon.transitioned', actorId: context.session.itemId, afterSnapshot: evidence, payload: { rooftopId: item.stock.rooftop.id, ...evidence } }
    if (await commandEvent(tx, event)) return true
    const changed = await tx.prisma.inventoryReconWorkItem.updateMany({ where: { id: item.id, status: item.status, updatedAt: expectedUpdatedAt }, data: { status: toStatus, actualCostCents, completedAt: toStatus === 'completed' ? new Date() : null } })
    if (changed.count !== 1) throw new Error('Reconditioning work changed concurrently; reload and retry')
    if (toStatus === 'completed') {
      const openCount = await tx.prisma.inventoryReconWorkItem.count({ where: { stockId: item.stock.id, id: { not: item.id }, status: { in: ['open', 'in-progress'] } } })
      await tx.prisma.inventoryStock.update({ where: { id: item.stock.id }, data: { reconStatus: openCount === 0 ? 'completed' : 'in-progress', reconCostCents: { increment: actualCostCents ?? 0 }, totalCostCents: { increment: actualCostCents ?? 0 } } })
    }
    await stockEvent(tx, event, `recon-work:${toStatus}`, reason, actualCostCents ?? undefined, evidence)
    return false
  }, { timeout: 30_000 })
  return result(context, item.stock.id, reused, item.id)
}

export const establishInventoryStock = inventoryCommand(establishInventoryStockCommand)
export const moveInventoryStock = inventoryCommand(moveInventoryStockCommand)
export const recordInventoryCost = inventoryCommand(recordInventoryCostCommand)
export const openInventoryReconWorkItem = inventoryCommand(openInventoryReconWorkItemCommand)
export const transitionInventoryReconWorkItem = inventoryCommand(transitionInventoryReconWorkItemCommand)
