import { domainEventRequestHash, recordDomainEventInTransaction } from '../lifecycle/domainEvents'
import { assertMerchandisingContent } from '../lifecycle/inventoryPublication'
import { inventoryStockKey, nonNegativeCents, normalizeStockNumber } from '../lifecycle/inventoryOperationsLifecycle'
import { permissions } from '../access'
import { inventoryCommand } from './inventoryCommandErrors'
import { assertSessionRooftopPermission } from '../tenantRecords'

type IntakeMode = 'operator-intake' | 'onboarding-ready'

type InventoryIntakeInput = {
  rooftopId: string
  idempotencyKey: string
  reason: string
  acquisitionSource: string
  sourceReference?: string | null
  vin: string
  legacyVin?: string | null
  stockNumber: string
  year: number
  make: string
  model: string
  trim?: string | null
  exteriorColor?: string | null
  interiorColor?: string | null
  mileage?: number | null
  purchasePriceCents: number
  listPriceCents: number
  priceCents: number
  condition: string
  description?: string | null
  features?: unknown[]
  imagePath?: string | null
  locationCode: string
  locationLabel?: string | null
}

type InventoryIntakeOptions = {
  actorId: string
  mode: IntakeMode
  allowExistingVehicle?: boolean
}

const SOURCES = new Set(['trade-in', 'auction', 'wholesale', 'consumer-purchase', 'oem-distributor', 'dealer-transfer'])
const CONDITIONS = new Set(['new', 'used', 'certified'])

function boundedText(value: unknown, label: string, maximum: number, required = true) {
  const result = String(value ?? '').trim()
  if ((required && !result) || result.length > maximum) {
    throw new Error(`${label} ${required ? 'is required and ' : ''}must be at most ${maximum} characters`)
  }
  return result
}

function normalizeVin(value: unknown, label = 'VIN') {
  const vin = boundedText(value, label, 17).toUpperCase()
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) throw new Error(`${label} must be a valid 17-character VIN`)
  return vin
}

function optionalLegacyVin(value: unknown) {
  const vin = String(value ?? '').trim().toUpperCase()
  if (!vin) return null
  if (!/^[A-Z0-9]{11,17}$/.test(vin)) throw new Error('Legacy VIN must be an 11–17 character identifier')
  return vin
}

function integer(value: unknown, label: string, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  const result = Number(value)
  if (!Number.isInteger(result) || result < minimum || result > maximum) {
    throw new Error(`${label} must be an integer between ${minimum} and ${maximum}`)
  }
  return result
}

function normalizeIntake(input: InventoryIntakeInput) {
  const rooftopId = boundedText(input.rooftopId, 'Rooftop', 100)
  const idempotencyKey = boundedText(input.idempotencyKey, 'Idempotency key', 100)
  if (idempotencyKey.length < 8) throw new Error('Idempotency key must be at least 8 characters')
  const acquisitionSource = boundedText(input.acquisitionSource, 'Acquisition source', 40)
  if (!SOURCES.has(acquisitionSource)) throw new Error('Unsupported acquisition source')
  const condition = boundedText(input.condition, 'Vehicle condition', 30)
  if (!CONDITIONS.has(condition)) throw new Error('Unsupported vehicle condition')
  const vin = normalizeVin(input.vin)
  const legacyVin = optionalLegacyVin(input.legacyVin)
  const stockNumber = normalizeStockNumber(input.stockNumber)
  const year = integer(input.year, 'Model year', 1900, 2200)
  const mileage = input.mileage == null ? null : integer(input.mileage, 'Mileage')
  const purchasePriceCents = nonNegativeCents(input.purchasePriceCents, 'Purchase price')
  const listPriceCents = nonNegativeCents(input.listPriceCents, 'List price')
  const priceCents = nonNegativeCents(input.priceCents, 'Retail price')
  if (priceCents === 0) throw new Error('Retail price must be greater than zero')
  const features = Array.isArray(input.features)
    ? input.features.slice(0, 100).map((feature, index) => boundedText(feature, `Feature ${index + 1}`, 200))
    : []
  return {
    rooftopId,
    idempotencyKey,
    reason: boundedText(input.reason, 'Audit reason', 500),
    acquisitionSource,
    sourceReference: boundedText(input.sourceReference, 'Source reference', 200, false) || null,
    vin,
    legacyVin,
    stockNumber,
    year,
    make: boundedText(input.make, 'Make', 100),
    model: boundedText(input.model, 'Model', 100),
    trim: boundedText(input.trim, 'Trim', 100, false),
    exteriorColor: boundedText(input.exteriorColor, 'Exterior color', 100, false),
    interiorColor: boundedText(input.interiorColor, 'Interior color', 100, false),
    mileage,
    purchasePriceCents,
    listPriceCents,
    priceCents,
    condition,
    description: boundedText(input.description, 'Description', 4_000, false),
    features,
    imagePath: boundedText(input.imagePath, 'Image path', 500, false) || null,
    locationCode: boundedText(input.locationCode, 'Location code', 80).toUpperCase(),
    locationLabel: boundedText(input.locationLabel, 'Location label', 200, false),
  }
}

function eventEvidence(input: ReturnType<typeof normalizeIntake>, mode: IntakeMode) {
  return {
    mode,
    rooftopId: input.rooftopId,
    vin: input.vin,
    legacyVin: input.legacyVin,
    stockNumber: input.stockNumber,
    year: input.year,
    make: input.make,
    model: input.model,
    mileage: input.mileage,
    acquisitionSource: input.acquisitionSource,
    sourceReference: input.sourceReference,
    purchasePriceCents: input.purchasePriceCents,
    listPriceCents: input.listPriceCents,
    priceCents: input.priceCents,
    condition: input.condition,
    locationCode: input.locationCode,
    locationLabel: input.locationLabel,
    description: input.description,
    features: input.features,
    imagePath: input.imagePath,
    reason: input.reason,
  }
}

/** Approves the onboarding revision and writes the revision hash the storefront gate requires. */
async function writeOnboardingApproval(prisma: any, publication: any, actorId: string, now: Date) {
  const snapshot = assertMerchandisingContent(publication)
  const revisionHash = domainEventRequestHash(snapshot)
  const latestVersion = publication.merchandisingVersions[0]
  if (latestVersion?.status === 'submitted') {
    await prisma.inventoryMerchandisingVersion.updateMany({
      where: { id: latestVersion.id, status: 'submitted' },
      data: { status: 'rejected', decisionReason: 'Superseded by onboarding', decidedById: actorId, decidedAt: now },
    })
  }
  let merchandisingVersionId: string
  let created = false
  if (latestVersion?.status === 'approved' && latestVersion.snapshot?.schemaVersion === 2 && domainEventRequestHash(latestVersion.snapshot) === revisionHash) {
    merchandisingVersionId = latestVersion.id
  } else {
    const version = (latestVersion?.version ?? 0) + 1
    const merchandising = await prisma.inventoryMerchandisingVersion.create({
      data: {
        rooftopId: publication.rooftopId,
        stockId: publication.id,
        version,
        versionKey: `${publication.id}:${version}`,
        status: 'approved',
        snapshot,
        submittedById: actorId,
        submittedAt: now,
        decidedById: actorId,
        decidedAt: now,
        decisionReason: 'Onboarding',
      },
      select: { id: true },
    })
    merchandisingVersionId = merchandising.id
    created = true
  }
  await prisma.inventoryStock.update({
    where: { id: publication.id },
    data: { merchandisingStatus: 'approved', approvedRevisionHash: revisionHash, feedStatus: 'succeeded' },
  })
  return { merchandisingVersionId, created }
}

/**
 * Onboarding replays return early, so rows seeded before the revision hash existed kept
 * `approvedRevisionHash: ''` and never reached the storefront. Backfill them on replay.
 */
async function backfillOnboardingApproval(prisma: any, stockId: string, actorId: string) {
  const publication = await prisma.inventoryStock.findUnique({
    where: { id: stockId },
    include: {
      vehicle: { include: { images: true } },
      merchandisingVersions: { orderBy: { version: 'desc' }, take: 1 },
    },
  })
  if (!publication?.vehicle || publication.approvedRevisionHash || publication.merchandisingStatus !== 'approved' || publication.reconStatus !== 'completed') return
  try {
    assertMerchandisingContent(publication)
  } catch {
    // Missing price, description or photo: the inventory desk reports why the unit is not live.
    return
  }
  await writeOnboardingApproval(prisma, publication, actorId, new Date())
}

export async function intakeInventoryVehicleInTransaction(
  transactionContext: any,
  rawInput: InventoryIntakeInput,
  options: InventoryIntakeOptions
) {
  const input = normalizeIntake(rawInput)
  const eventKey = `inventory-intake:${input.rooftopId}:${input.idempotencyKey}`
  const evidence = eventEvidence(input, options.mode)
  const prisma = transactionContext.prisma

  await prisma.$queryRaw`SELECT 1 AS "locked" FROM pg_advisory_xact_lock(hashtextextended(${`command:${eventKey}`}, 0))`
  const replay = await prisma.domainAuditEvent.findUnique({
    where: { eventKey },
    select: { aggregateId: true, metadata: true },
  })
  if (replay) {
    const metadata = replay.metadata as Record<string, unknown>
    if (options.mode === 'onboarding-ready') await backfillOnboardingApproval(prisma, String(metadata.stockId || replay.aggregateId), options.actorId)
    await recordDomainEventInTransaction(transactionContext, {
      eventKey,
      rooftopId: input.rooftopId,
      aggregateType: 'InventoryStock',
      aggregateId: String(metadata.stockId || replay.aggregateId),
      action: 'vehicle-intake',
      topic: 'inventory.vehicle-intake',
      actorId: options.actorId,
      afterSnapshot: evidence,
      metadata,
      payload: { rooftopId: input.rooftopId, ...metadata },
    })
    return {
      vehicleId: String(metadata.vehicleId || ''),
      acquisitionId: String(metadata.acquisitionId || ''),
      stockId: String(metadata.stockId || replay.aggregateId),
      reused: true,
      vehicleCreated: false,
      acquisitionCreated: false,
      stockCreated: false,
      imageCreated: false,
      publicationEvidenceCreated: false,
    }
  }

  const rooftop = await prisma.rooftop.findUnique({
    where: { id: input.rooftopId },
    select: { id: true, status: true, dealerGroup: { select: { status: true } } },
  })
  if (!rooftop || rooftop.status !== 'active' || rooftop.dealerGroup.status !== 'active') {
    throw new Error('Inventory intake requires an active rooftop and dealer group')
  }

  const candidateVins = [...new Set([input.vin, input.legacyVin].filter(Boolean) as string[])]
  const existingVehicle = await prisma.vehicle.findFirst({
    where: { vin: { in: candidateVins } },
    include: {
      images: { select: { id: true, imagePath: true } },
      inventoryStock: { select: { id: true, rooftopId: true, stockNumber: true } },
      acquisition: { select: { id: true, rooftopId: true, idempotencyKey: true } },
    },
  })
  if (existingVehicle && !options.allowExistingVehicle) throw new Error('A vehicle with this VIN already exists')
  if (existingVehicle && existingVehicle.rooftopId !== input.rooftopId) throw new Error('Vehicle belongs to another rooftop')
  if (existingVehicle && options.mode === 'onboarding-ready' && !['available', 'service'].includes(String(existingVehicle.status))) {
    throw new Error('Onboarding will not overwrite a pending or sold vehicle without prior replay evidence')
  }

  const stockCollision = await prisma.inventoryStock.findUnique({
    where: { stockKey: inventoryStockKey(input.rooftopId, input.stockNumber) },
    select: { id: true, vehicleId: true },
  })
  if (stockCollision && stockCollision.vehicleId !== existingVehicle?.id) {
    throw new Error('Stock number already exists at this rooftop')
  }

  const now = new Date()
  const ready = options.mode === 'onboarding-ready'
  const provenance = {
    mode: options.mode,
    acquisitionSource: input.acquisitionSource,
    sourceReference: input.sourceReference,
    intakeEventKey: eventKey,
  }
  const vehicleValues = {
    rooftopId: input.rooftopId,
    vin: input.vin,
    stockNumber: input.stockNumber,
    year: input.year,
    make: input.make,
    model: input.model,
    trim: input.trim,
    exteriorColor: input.exteriorColor,
    interiorColor: input.interiorColor,
    mileage: input.mileage,
    purchasePriceCents: input.purchasePriceCents,
    listPriceCents: input.listPriceCents,
    priceCents: input.priceCents,
    condition: input.condition,
    status: ready ? 'available' : 'service',
    description: input.description,
    features: input.features,
    metadata: { ...((existingVehicle?.metadata as Record<string, unknown>) || {}), provenance },
  }
  const vehicle = existingVehicle
    ? await prisma.vehicle.update({ where: { id: existingVehicle.id }, data: vehicleValues, select: { id: true } })
    : await prisma.vehicle.create({ data: vehicleValues, select: { id: true } })

  let imageCreated = false
  if (input.imagePath) {
    const existingImage = existingVehicle?.images.find((image: any) => image.imagePath === input.imagePath)
    const imageValues = {
      rooftopId: input.rooftopId,
      vehicleId: vehicle.id,
      imagePath: input.imagePath,
      caption: `${input.year} ${input.make} ${input.model}`,
      category: 'exterior',
      sortOrder: 0,
      isPrimary: true,
    }
    if (existingImage) await prisma.vehicleImage.update({ where: { id: existingImage.id }, data: imageValues })
    else {
      await prisma.vehicleImage.create({ data: imageValues })
      imageCreated = true
    }
  }

  const acquisitionKey = `inventory-intake:${input.rooftopId}:${input.idempotencyKey}`
  if (existingVehicle?.acquisition && existingVehicle.acquisition.idempotencyKey !== acquisitionKey) {
    throw new Error('Vehicle already belongs to a different acquisition lifecycle')
  }
  const purchaseSnapshot = {
    vin: input.vin,
    stockNumber: input.stockNumber,
    acquisitionSource: input.acquisitionSource,
    sourceReference: input.sourceReference,
    purchaseCents: input.purchasePriceCents,
    odometer: input.mileage,
  }
  const acquisitionValues = {
    rooftopId: input.rooftopId,
    reference: existingVehicle?.acquisition
      ? undefined
      : `ACQ-${domainEventRequestHash(acquisitionKey).slice(0, 20).toUpperCase()}`,
    idempotencyKey: existingVehicle?.acquisition ? undefined : acquisitionKey,
    status: ready ? 'frontline' : 'arrived',
    acquisitionSource: input.acquisitionSource,
    sourceReference: input.sourceReference || '',
    vin: input.vin,
    year: input.year,
    make: input.make,
    model: input.model,
    odometer: input.mileage,
    appraisalCents: input.purchasePriceCents,
    purchaseCents: input.purchasePriceCents,
    reconEstimateCents: 0,
    vehicleId: vehicle.id,
    immutablePurchaseSnapshot: purchaseSnapshot,
    purchasedAt: now,
    arrivedAt: now,
    frontlineAt: ready ? now : null,
    requestedById: options.actorId,
    lastTransitionedById: options.actorId,
  }
  const acquisition = existingVehicle?.acquisition
    ? await prisma.inventoryAcquisition.update({
        where: { id: existingVehicle.acquisition.id },
        data: Object.fromEntries(Object.entries(acquisitionValues).filter(([, value]) => value !== undefined)),
        select: { id: true },
      })
    : await prisma.inventoryAcquisition.create({ data: acquisitionValues, select: { id: true } })

  const stockValues = {
    rooftopId: input.rooftopId,
    vehicleId: vehicle.id,
    stockNumber: input.stockNumber,
    stockKey: inventoryStockKey(input.rooftopId, input.stockNumber),
    locationCode: input.locationCode,
    locationLabel: input.locationLabel,
    stockedAt: now,
    frontlineAt: ready ? now : null,
    purchaseCostCents: input.purchasePriceCents,
    reconCostCents: 0,
    otherCostCents: 0,
    totalCostCents: input.purchasePriceCents,
    reconStatus: ready ? 'completed' : 'not-started',
    merchandisingStatus: ready ? 'approved' : 'draft',
    approvedRevisionHash: '',
    feedStatus: ready ? 'succeeded' : 'not-published',
  }
  const stock = existingVehicle?.inventoryStock
    ? await prisma.inventoryStock.update({ where: { id: existingVehicle.inventoryStock.id }, data: stockValues, select: { id: true } })
    : await prisma.inventoryStock.create({ data: stockValues, select: { id: true } })
  await prisma.inventoryAcquisition.update({ where: { id: acquisition.id }, data: { stockId: stock.id } })

  await prisma.inventoryAcquisitionEvent.create({
    data: {
      rooftopId: input.rooftopId,
      acquisitionId: acquisition.id,
      fromStatus: '',
      toStatus: ready ? 'frontline' : 'arrived',
      reason: input.reason,
      evidence: purchaseSnapshot,
      actorId: options.actorId,
      occurredAt: now,
    },
  })
  await prisma.inventoryStockEvent.create({
    data: {
      rooftopId: input.rooftopId,
      stockId: stock.id,
      eventKey: `${eventKey}:stock`,
      eventType: 'vehicle-intake',
      reason: input.reason,
      amountCents: input.purchasePriceCents,
      evidence: { acquisitionId: acquisition.id, vehicleId: vehicle.id, locationCode: input.locationCode },
      actorId: options.actorId,
      occurredAt: now,
    },
  })

  let publicationEvidenceCreated = false
  let merchandisingVersionId: string | null = null
  let feedRunId: string | null = null
  let reconWorkItemId: string | null = null
  if (ready) {
    const reconWorkItem = await prisma.inventoryReconWorkItem.create({
      data: {
        rooftopId: input.rooftopId,
        stockId: stock.id,
        title: 'Onboarding readiness inspection',
        category: 'inspection',
        status: 'completed',
        estimatedCostCents: 0,
        actualCostCents: 0,
        assignedToId: options.actorId,
        completedAt: now,
      },
      select: { id: true },
    })
    reconWorkItemId = reconWorkItem.id
    if (!input.description || !input.imagePath) {
      throw new Error('Onboarding-ready inventory requires a description and primary image')
    }
    const publication = await prisma.inventoryStock.findUnique({
      where: { id: stock.id },
      include: {
        vehicle: { include: { images: true } },
        merchandisingVersions: { orderBy: { version: 'desc' }, take: 1 },
      },
    })
    if (!publication?.vehicle) throw new Error('Onboarding inventory could not be reviewed')
    const approval = await writeOnboardingApproval(prisma, publication, options.actorId, now)
    merchandisingVersionId = approval.merchandisingVersionId
    if (approval.created) publicationEvidenceCreated = true
    const feedRun = await prisma.inventoryFeedRun.create({
      data: {
        rooftopId: input.rooftopId,
        runKey: `${eventKey}:public-feed`,
        channelKey: 'public-inventory-feed',
        status: 'succeeded',
        attemptedCount: 1,
        succeededCount: 1,
        failedCount: 0,
        requestSnapshot: { stockIds: [stock.id] },
        responseSummary: { mode: 'onboarding-internal', externalRequestSent: false },
        startedAt: now,
        completedAt: now,
        recordedById: options.actorId,
      },
      select: { id: true },
    })
    feedRunId = feedRun.id
    publicationEvidenceCreated = true
  }

  const metadata = {
    vehicleId: vehicle.id,
    acquisitionId: acquisition.id,
    stockId: stock.id,
    reconWorkItemId,
    merchandisingVersionId,
    feedRunId,
    imageCreated,
  }
  await recordDomainEventInTransaction(transactionContext, {
    eventKey,
    rooftopId: input.rooftopId,
    aggregateType: 'InventoryStock',
    aggregateId: stock.id,
    action: 'vehicle-intake',
    topic: 'inventory.vehicle-intake',
    actorId: options.actorId,
    afterSnapshot: evidence,
    metadata,
    payload: { rooftopId: input.rooftopId, ...metadata },
  })

  return {
    ...metadata,
    reused: false,
    vehicleCreated: !existingVehicle,
    acquisitionCreated: !existingVehicle?.acquisition,
    stockCreated: !existingVehicle?.inventoryStock,
    publicationEvidenceCreated,
  }
}

async function intakeInventoryVehicleCommand(_root: unknown, { data }: any, context: any) {
  if (!context.session?.itemId || !permissions.canManageInventory({ session: context.session })) {
    throw new Error('Inventory management permission is required')
  }
  const rooftopId = String(data.rooftopId || '')
  await assertSessionRooftopPermission(context, rooftopId, 'canManageInventory')
  const command = await context.transaction(
    (transactionContext: any) => intakeInventoryVehicleInTransaction(transactionContext, data, {
      actorId: context.session.itemId,
      mode: 'operator-intake',
      allowExistingVehicle: false,
    }),
    { timeout: 30_000 }
  )
  const stock = await context.sudo().prisma.inventoryStock.findUnique({
    where: { id: command.stockId },
    select: { id: true, updatedAt: true, reconStatus: true, merchandisingStatus: true, feedStatus: true },
  })
  if (!stock) throw new Error('Inventory intake result no longer exists')
  return {
    id: command.vehicleId,
    vehicleId: command.vehicleId,
    acquisitionId: command.acquisitionId,
    stockId: stock.id,
    status: stock.reconStatus,
    merchandisingStatus: stock.merchandisingStatus,
    feedStatus: stock.feedStatus,
    updatedAt: stock.updatedAt,
    reused: command.reused,
  }
}

export const intakeInventoryVehicle = inventoryCommand(intakeInventoryVehicleCommand)
