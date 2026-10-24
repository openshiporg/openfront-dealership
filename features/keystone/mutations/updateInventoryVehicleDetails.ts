import { permissions } from '../access'
import { commandDate } from '../lifecycle/commandDate'
import { recordDomainEventInTransaction, type DomainEventInput } from '../lifecycle/domainEvents'
import { appendInventoryPriceHistory } from '../lifecycle/inventoryPriceHistory'
import { loadInventoryPublication, lockInventoryStock } from '../lifecycle/inventoryPublication'
import { assertSessionRooftopPermission } from '../tenantRecords'
import { inventoryCommand } from './inventoryCommandErrors'
import { assertActiveInventory } from './inventoryActiveStatus'

const CONDITIONS = new Set(['new', 'used', 'certified'])
const MAX_CENTS = 2_147_483_647

function requiredText(value: unknown, label: string, max: number) {
  const result = String(value ?? '').trim()
  if (!result || result.length > max) throw new Error(`${label} is required and must be at most ${max} characters`)
  return result
}

function optionalText(value: unknown, label: string, max: number) {
  const result = String(value ?? '').trim()
  if (result.length > max) throw new Error(`${label} must be at most ${max} characters`)
  return result
}

function cents(value: unknown, label: string) {
  const result = Number(value)
  if (!Number.isSafeInteger(result) || result < 0 || result > MAX_CENTS) throw new Error(`${label} must be a non-negative amount`)
  return result
}

function idempotencyKey(value: unknown) {
  const result = String(value || '').trim()
  if (result.length < 8 || result.length > 180) throw new Error('A valid idempotency key is required')
  return result
}

/** Normalizes and validates the identity and spec edit. Exported for tests. */
export function normalizeInventoryVehicleDetails(data: any, now = new Date()) {
  const vin = requiredText(data.vin, 'VIN', 17).toUpperCase()
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) throw new Error('VIN must be 17 characters without I, O or Q')
  const year = Number(data.year)
  const maxYear = now.getUTCFullYear() + 2
  if (!Number.isInteger(year) || year < 1900 || year > maxYear) throw new Error(`Model year must be between 1900 and ${maxYear}`)
  const condition = String(data.condition || '').trim()
  if (!CONDITIONS.has(condition)) throw new Error('Condition must be new, used or certified')
  const mileage = data.mileage == null || data.mileage === '' ? null : Number(data.mileage)
  if (mileage != null && (!Number.isSafeInteger(mileage) || mileage < 0 || mileage > 2_000_000)) throw new Error('Odometer must be a whole number of miles')
  const priceCents = cents(data.priceCents, 'Retail price')
  if (priceCents === 0) throw new Error('Retail price must be greater than zero')
  const listPriceCents = data.listPriceCents == null ? priceCents : cents(data.listPriceCents, 'List price')
  const rawFeatures = data.features == null ? [] : data.features
  if (!Array.isArray(rawFeatures)) throw new Error('Features must be a list')
  const features = [...new Set(rawFeatures.map((feature: unknown) => String(feature ?? '').trim()).filter(Boolean))]
  if (features.length > 100) throw new Error('At most 100 features')
  if (features.some(feature => feature.length > 200)) throw new Error('Each feature must be at most 200 characters')
  return {
    vin,
    year,
    make: requiredText(data.make, 'Make', 100),
    model: requiredText(data.model, 'Model', 100),
    trim: optionalText(data.trim, 'Trim', 100),
    exteriorColor: optionalText(data.exteriorColor, 'Exterior colour', 100),
    interiorColor: optionalText(data.interiorColor, 'Interior colour', 100),
    condition,
    mileage,
    priceCents,
    listPriceCents,
    features,
    description: data.description == null ? null : optionalText(data.description, 'Description', 4_000),
  }
}

const TRACKED_FIELDS = ['vin', 'year', 'make', 'model', 'trim', 'exteriorColor', 'interiorColor', 'condition', 'mileage', 'priceCents', 'listPriceCents', 'features', 'description'] as const

function sameValue(a: unknown, b: unknown) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
}

/**
 * Edits a stocked unit's identity and spec. Every edited field is part of the approved listing
 * snapshot, so like `updateInventoryMerchandisingDraft` the listing goes back to draft, a pending
 * review is superseded, and the feed status resets. A retail price change appends PriceHistory.
 */
async function updateInventoryVehicleDetailsCommand(_root: unknown, { data }: any, context: any) {
  if (!context.session?.itemId || !permissions.canManageInventory({ session: context.session })) throw new Error('Inventory management permission is required')
  const stock = await context.query.InventoryStock.findOne({ where: { id: String(data.stockId || '') }, query: 'id rooftop { id } vehicle { id }' })
  if (!stock?.rooftop?.id || !stock.vehicle?.id) throw new Error('Inventory stock not found or not accessible')
  await assertSessionRooftopPermission(context, stock.rooftop.id, 'canManageInventory')
  const next = normalizeInventoryVehicleDetails(data)
  const expectedUpdatedAt = commandDate(data.expectedUpdatedAt)
  const reason = requiredText(data.reason, 'Audit reason', 500)
  const priceChangeReason = optionalText(data.priceChangeReason, 'Price change reason', 500)
  const eventKey = `inventory-vehicle-details:${idempotencyKey(data.idempotencyKey)}`
  const rooftopId = stock.rooftop.id
  const actorId = context.session.itemId

  // The audit request is the operator's input only, so a retry with the same key replays cleanly.
  const request = { stockId: stock.id, vehicleId: stock.vehicle.id, ...next, priceChangeReason, expectedUpdatedAt: expectedUpdatedAt.toISOString(), reason }
  const event: DomainEventInput = {
    eventKey, rooftopId, aggregateType: 'InventoryStock', aggregateId: stock.id, action: 'vehicle-details-updated',
    topic: 'inventory-vehicle.details-updated', actorId, afterSnapshot: request, payload: { rooftopId, ...request },
  }

  const reused = await context.transaction(async (tx: any) => {
    await lockInventoryStock(tx, stock.id)
    const recorded = await recordDomainEventInTransaction(tx, event)
    if (recorded.reused) return true
    const current = await loadInventoryPublication(tx, stock.id)
    const vehicle = current.vehicle
    const before: Record<string, unknown> = {
      vin: vehicle.vin, year: vehicle.year, make: vehicle.make, model: vehicle.model, trim: vehicle.trim || '',
      exteriorColor: vehicle.exteriorColor || '', interiorColor: vehicle.interiorColor || '', condition: vehicle.condition ?? null,
      mileage: vehicle.mileage ?? null, priceCents: vehicle.priceCents ?? null, listPriceCents: vehicle.listPriceCents ?? null,
      features: Array.isArray(vehicle.features) ? vehicle.features : [], description: vehicle.description || '',
    }
    const after: Record<string, unknown> = { ...next, description: next.description ?? before.description }
    const changes = Object.fromEntries(TRACKED_FIELDS.filter(field => !sameValue(before[field], after[field])).map(field => [field, { from: before[field] ?? null, to: after[field] ?? null }]))
    const evidence = { stockId: stock.id, vehicleId: vehicle.id, changes, expectedUpdatedAt: expectedUpdatedAt.toISOString(), reason }
    assertActiveInventory(vehicle.status)
    if (Object.keys(changes).length === 0) throw new Error('No changes to save')
    if (next.vin !== vehicle.vin) {
      const duplicate = await tx.prisma.vehicle.findFirst({ where: { vin: next.vin, id: { not: vehicle.id } }, select: { id: true } })
      if (duplicate) throw new Error('Another vehicle already has this VIN')
    }
    const changed = await tx.prisma.inventoryStock.updateMany({
      where: { id: stock.id, rooftopId, updatedAt: expectedUpdatedAt },
      data: { merchandisingStatus: 'draft', approvedRevisionHash: '', feedStatus: 'not-published' },
    })
    if (changed.count !== 1) throw new Error('Inventory stock changed concurrently; reload and retry')
    await tx.prisma.inventoryMerchandisingVersion.updateMany({
      where: { stockId: stock.id, status: 'submitted' },
      data: { status: 'rejected', decisionReason: 'Superseded by edited vehicle details', decidedById: actorId, decidedAt: new Date() },
    })
    await tx.prisma.vehicle.update({
      where: { id: vehicle.id },
      data: {
        vin: next.vin, year: next.year, make: next.make, model: next.model, trim: next.trim,
        exteriorColor: next.exteriorColor, interiorColor: next.interiorColor, condition: next.condition,
        mileage: next.mileage, priceCents: next.priceCents, listPriceCents: next.listPriceCents, features: next.features,
        ...(next.description == null ? {} : { description: next.description }),
      },
    })
    // The acquisition is matched to its vehicle by VIN (transitionInventoryAcquisition); keep them aligned.
    if (next.vin !== vehicle.vin) await tx.prisma.inventoryAcquisition.updateMany({ where: { vehicleId: vehicle.id, rooftopId }, data: { vin: next.vin } })
    await appendInventoryPriceHistory(tx, { rooftopId, vehicleId: vehicle.id, previousPriceCents: vehicle.priceCents, newPriceCents: next.priceCents, actorId, changeReason: priceChangeReason || reason })
    await tx.prisma.inventoryStockEvent.create({ data: { rooftopId, stockId: stock.id, eventKey, eventType: 'vehicle-details-updated', reason, evidence, actorId } })
    return false
  }, { timeout: 30_000 })

  const result = await context.sudo().prisma.inventoryStock.findUnique({ where: { id: stock.id }, select: { updatedAt: true, reconStatus: true, merchandisingStatus: true, feedStatus: true } })
  if (!result) throw new Error('Inventory stock no longer exists')
  return { id: stock.vehicle.id, stockId: stock.id, status: result.reconStatus, merchandisingStatus: result.merchandisingStatus, feedStatus: result.feedStatus, updatedAt: result.updatedAt, reused }
}

export const updateInventoryVehicleDetails = inventoryCommand(updateInventoryVehicleDetailsCommand)
