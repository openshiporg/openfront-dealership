import { permissions } from '../access'
import { recordDomainEventInTransaction } from '../lifecycle/domainEvents'
import { buildAcquisitionEvidence } from '../lifecycle/inventoryAcquisitionLifecycle'
import { assertSessionRooftopPermission } from '../tenantRecords'
import { requiredText } from './submissionUtils'

const SOURCES = new Set(['trade-in', 'auction', 'wholesale', 'consumer-purchase', 'oem-distributor', 'dealer-transfer'])

function nonNegativeInteger(value: unknown, label: string, required = false) {
  if (value == null && !required) return null
  const number = Number(value)
  if (!Number.isInteger(number) || number < 0) throw new Error(`${label} must be a non-negative integer number of cents`)
  return number
}

export async function startInventoryAcquisition(_root: unknown, { data }: { data: any }, context: any) {
  if (!context.session?.itemId || !permissions.canManageInventory({ session: context.session })) {
    throw new Error('Inventory management permission is required')
  }
  const rooftopId = requiredText(data.rooftopId, 'Rooftop', 100)
  const idempotencyKey = String(data.idempotencyKey || '').trim()
  if (idempotencyKey.length < 8 || idempotencyKey.length > 200) {
    throw new Error('Idempotency key must be between 8 and 200 characters')
  }
  const reason = requiredText(data.reason, 'Audit reason', 500)
  const vin = String(data.vin || '').trim().toUpperCase()
  if (vin.length !== 17) throw new Error('VIN must be exactly 17 characters')
  const year = Number(data.year)
  if (!Number.isInteger(year) || year < 1900 || year > 2200) throw new Error('Vehicle year is invalid')
  const make = requiredText(data.make, 'Make', 100)
  const model = requiredText(data.model, 'Model', 100)
  const acquisitionSource = requiredText(data.acquisitionSource, 'Acquisition source', 50)
  if (!SOURCES.has(acquisitionSource)) throw new Error('Unsupported acquisition source')
  const appraisalCents = nonNegativeInteger(data.appraisalCents, 'Appraisal', true)!
  const reconEstimateCents = nonNegativeInteger(data.reconEstimateCents, 'Recon estimate')
  const odometer = nonNegativeInteger(data.odometer, 'Odometer')

  await assertSessionRooftopPermission(context, rooftopId, 'canManageInventory')
  const rooftop = await context.query.Rooftop.findOne({ where: { id: rooftopId }, query: 'id status' })
  if (!rooftop || rooftop.status !== 'active') throw new Error('Rooftop not found or not accessible')
  let vehicleId: string | null = null
  if (data.vehicleId) {
    const vehicle = await context.query.Vehicle.findOne({ where: { id: String(data.vehicleId) }, query: 'id vin rooftop { id }' })
    if (!vehicle || vehicle.rooftop?.id !== rooftopId) throw new Error('Vehicle must belong to the same rooftop')
    if (vehicle.vin !== vin) throw new Error('Linked vehicle VIN must match the acquisition VIN')
    vehicleId = vehicle.id
  }

  const domainEvidence = {
    rooftopId,
    vin,
    year,
    make,
    model,
    acquisitionSource,
    appraisalCents,
    reconEstimateCents,
    odometer,
    vehicleId,
  }
  const acquisitionId = await context.transaction(async (tx: any) => {
    await tx.prisma.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${idempotencyKey}, 0))`
    const replay = await tx.prisma.inventoryAcquisition.findUnique({ where: { idempotencyKey }, select: { id: true, rooftopId: true, status: true } })
    if (replay) {
      await recordDomainEventInTransaction(tx, {
        eventKey: `inventory-acquisition-start:${idempotencyKey}`,
        rooftopId: replay.rooftopId,
        aggregateType: 'InventoryAcquisition', aggregateId: replay.id,
        action: 'started', topic: 'inventory-acquisition.started', actorId: context.session.itemId,
        afterSnapshot: domainEvidence,
        payload: { acquisitionId: replay.id, rooftopId: replay.rooftopId, status: replay.status },
      })
      return replay.id
    }
    const now = new Date()
    const reference = `ACQ-${now.toISOString().replace(/\D/g, '').slice(0, 14)}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
    const acquisition = await tx.prisma.inventoryAcquisition.create({
      data: {
        rooftopId,
        reference,
        idempotencyKey,
        status: 'appraised',
        acquisitionSource,
        sourceReference: String(data.sourceReference || '').trim().slice(0, 200),
        vin,
        year,
        make,
        model,
        odometer,
        appraisalCents,
        reconEstimateCents,
        vehicleId,
        requestedById: context.session.itemId,
        lastTransitionedById: context.session.itemId,
      },
      select: { id: true },
    })
    await tx.prisma.inventoryAcquisitionEvent.create({
      data: {
        rooftopId,
        acquisitionId: acquisition.id,
        fromStatus: '',
        toStatus: 'appraised',
        reason,
        evidence: buildAcquisitionEvidence({ reference, rooftopId, vin, year, make, model, acquisitionSource, appraisalCents, reconEstimateCents }),
        actorId: context.session.itemId,
        occurredAt: now,
      },
    })
    await recordDomainEventInTransaction(tx, {
      eventKey: `inventory-acquisition-start:${idempotencyKey}`,
      rooftopId,
      aggregateType: 'InventoryAcquisition', aggregateId: acquisition.id,
      action: 'started', topic: 'inventory-acquisition.started', actorId: context.session.itemId,
      afterSnapshot: domainEvidence,
      payload: { acquisitionId: acquisition.id, rooftopId, status: 'appraised' },
    })
    return acquisition.id
  }, { timeout: 30_000 })

  return context.db.InventoryAcquisition.findOne({ where: { id: acquisitionId } })
}
