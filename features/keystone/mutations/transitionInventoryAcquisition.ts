import { permissions } from '../access'
import { assertSessionRooftopPermission } from '../tenantRecords'
import { recordDomainEventInTransaction } from '../lifecycle/domainEvents'
import {
  assertInventoryAcquisitionTransition,
  buildAcquisitionEvidence,
  type InventoryAcquisitionStatus,
} from '../lifecycle/inventoryAcquisitionLifecycle'
import { requiredText } from './submissionUtils'

function optionalCents(value: unknown, label: string) {
  if (value == null) return undefined
  const number = Number(value)
  if (!Number.isInteger(number) || number < 0) throw new Error(`${label} must be a non-negative integer number of cents`)
  return number
}

export async function transitionInventoryAcquisition(
  _root: unknown,
  { id, toStatus, expectedUpdatedAt, reason, purchaseCents, reconEstimateCents, vehicleId, idempotencyKey }: {
    id: string
    toStatus: InventoryAcquisitionStatus
    expectedUpdatedAt: string
    reason: string
    purchaseCents?: number | null
    reconEstimateCents?: number | null
    vehicleId?: string | null
    idempotencyKey: string
  },
  context: any
) {
  if (!context.session?.itemId || !permissions.canManageInventory({ session: context.session })) {
    throw new Error('Inventory management permission is required')
  }
  const auditReason = requiredText(reason, 'Audit reason', 500)
  const commandKey = String(idempotencyKey || '').trim()
  if (commandKey.length < 8 || commandKey.length > 200) throw new Error('A valid idempotency key is required')
  const expectedVersion = new Date(expectedUpdatedAt)
  if (Number.isNaN(expectedVersion.getTime())) throw new Error('expectedUpdatedAt is invalid')
  const acquisition = await context.query.InventoryAcquisition.findOne({
    where: { id },
    query: `
      id reference status updatedAt rooftop { id } vehicle { id }
      vin year make model acquisitionSource appraisalCents purchaseCents reconEstimateCents
    `,
  })
  if (!acquisition?.rooftop?.id) throw new Error('Inventory acquisition not found or not accessible')
  await assertSessionRooftopPermission(context, acquisition.rooftop.id, 'canManageInventory')
  const eventKey = `inventory-acquisition-transition:${commandKey}`
  const requestEvidence = {
    acquisitionId: id,
    toStatus,
    reason: auditReason,
    purchaseCents: purchaseCents ?? null,
    reconEstimateCents: reconEstimateCents ?? null,
    vehicleId: vehicleId ?? null,
  }
  const domainEvent = {
    eventKey,
    rooftopId: acquisition.rooftop.id,
    aggregateType: 'InventoryAcquisition',
    aggregateId: id,
    action: `transitioned:${toStatus}`,
    topic: 'inventory-acquisition.transitioned',
    actorId: context.session.itemId,
    afterSnapshot: requestEvidence,
    payload: { acquisitionId: id, rooftopId: acquisition.rooftop.id, status: toStatus },
  }
  const replay = await context.sudo().prisma.domainAuditEvent.findUnique({ where: { eventKey }, select: { aggregateId: true } })
  if (replay) {
    if (replay.aggregateId !== id) throw new Error('Acquisition transition idempotency key belongs to another acquisition')
    await context.transaction((tx: any) => recordDomainEventInTransaction(tx, domainEvent), { timeout: 30_000 })
    return context.db.InventoryAcquisition.findOne({ where: { id } })
  }
  if (new Date(acquisition.updatedAt).toISOString() !== expectedVersion.toISOString()) {
    throw new Error('Inventory acquisition changed since it was loaded')
  }
  assertInventoryAcquisitionTransition(acquisition.status, toStatus)

  const nextPurchaseCents = optionalCents(purchaseCents, 'Purchase amount') ?? acquisition.purchaseCents
  const nextReconEstimateCents = optionalCents(reconEstimateCents, 'Recon estimate') ?? acquisition.reconEstimateCents
  const nextVehicleId = vehicleId ? String(vehicleId) : acquisition.vehicle?.id || null
  if (nextVehicleId) {
    const vehicle = await context.query.Vehicle.findOne({ where: { id: nextVehicleId }, query: 'id vin rooftop { id } priceCents description imagesCount inventoryStock { id reconStatus merchandisingStatus }' })
    if (!vehicle || vehicle.rooftop?.id !== acquisition.rooftop.id) throw new Error('Vehicle must belong to the same rooftop')
    if (vehicle.vin !== acquisition.vin) throw new Error('Linked vehicle VIN must match the acquisition VIN')
    if (toStatus === 'frontline' && (!(vehicle.priceCents > 0) || !String(vehicle.description || '').trim() || vehicle.imagesCount < 1)) {
      throw new Error('Frontline readiness requires a price, description, and at least one image')
    }
    if (toStatus === 'frontline' && (!vehicle.inventoryStock || vehicle.inventoryStock.reconStatus !== 'completed' || vehicle.inventoryStock.merchandisingStatus !== 'approved')) {
      throw new Error('Frontline readiness requires completed reconditioning and approved merchandising evidence')
    }
  }
  if (toStatus === 'purchased' && !(nextPurchaseCents > 0)) throw new Error('Purchase amount is required before purchase')
  if (toStatus === 'frontline' && !nextVehicleId) throw new Error('A linked vehicle is required for frontline readiness')

  const now = new Date()
  const evidence = buildAcquisitionEvidence({
    ...acquisition,
    rooftopId: acquisition.rooftop.id,
    purchaseCents: nextPurchaseCents,
    reconEstimateCents: nextReconEstimateCents,
  })
  await context.transaction(async (tx: any) => {
    let frontlineStockId: string | null = null
    if (toStatus === 'frontline') {
      const stock = await tx.prisma.inventoryStock.findFirst({
        where: { vehicleId: nextVehicleId!, rooftopId: acquisition.rooftop.id, reconStatus: 'completed', merchandisingStatus: 'approved' },
        select: { id: true },
      })
      if (!stock) throw new Error('Inventory readiness changed; completed recon and approved merchandising are required')

      // Match transitionDeal's Vehicle.status CAS. The predicate is evaluated against the current row
      // inside this transaction, so a winning reservation cannot be overwritten by frontline readiness.
      const eligibleVehicle = await tx.prisma.vehicle.updateMany({
        where: { id: nextVehicleId!, rooftopId: acquisition.rooftop.id, status: { in: ['available', 'service'] } },
        data: { status: 'available' },
      })
      if (eligibleVehicle.count !== 1) {
        throw new Error('Vehicle is reserved or no longer eligible for frontline readiness; reload and retry')
      }
      frontlineStockId = stock.id
    }

    const changed = await tx.prisma.inventoryAcquisition.updateMany({
      where: { id, status: acquisition.status, updatedAt: expectedVersion },
      data: {
        status: toStatus,
        purchaseCents: nextPurchaseCents,
        reconEstimateCents: nextReconEstimateCents,
        vehicleId: nextVehicleId,
        lastTransitionedById: context.session.itemId,
        ...(toStatus === 'purchased' ? { purchasedAt: now, immutablePurchaseSnapshot: evidence } : {}),
        ...(toStatus === 'arrived' ? { arrivedAt: now } : {}),
        ...(toStatus === 'frontline' ? { frontlineAt: now } : {}),
      },
    })
    if (changed.count !== 1) throw new Error('Inventory acquisition changed concurrently; reload and retry')
    await tx.prisma.inventoryAcquisitionEvent.create({
      data: {
        rooftopId: acquisition.rooftop.id,
        acquisitionId: id,
        fromStatus: acquisition.status,
        toStatus,
        reason: auditReason,
        evidence,
        actorId: context.session.itemId,
        occurredAt: now,
      },
    })
    if (frontlineStockId) {
      await tx.prisma.inventoryStock.update({ where: { id: frontlineStockId }, data: { frontlineAt: now } })
    }
    await recordDomainEventInTransaction(tx, domainEvent)
  }, { timeout: 30_000 })

  return context.db.InventoryAcquisition.findOne({ where: { id } })
}
