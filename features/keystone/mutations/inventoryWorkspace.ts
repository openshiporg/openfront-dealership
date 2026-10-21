import { permissions } from '../access'
import { inventoryChannelKeys } from '../../integrations/inventory-channel'

function boundedPage(limitValue: unknown, offsetValue: unknown) {
  const limit = Math.max(1, Math.min(100, Number(limitValue) || 50))
  const offset = Math.max(0, Math.min(10_000, Number(offsetValue) || 0))
  return { limit, offset }
}

export async function inventoryWorkspace(_root: unknown, args: any, context: any) {
  if (!context.session?.itemId || !permissions.canViewInventory({ session: context.session })) {
    throw new Error('Inventory access is required')
  }
  const { limit, offset } = boundedPage(args.limit, args.offset)
  const status = String(args.status || '').trim()
  const search = String(args.search || '').trim().slice(0, 100)
  const filters: any[] = []
  if (status && status !== 'all') filters.push({ vehicle: { status: { equals: status } } })
  if (search) filters.push({ OR: [
    { stockNumber: { contains: search } },
    { vehicle: { vin: { contains: search } } },
    { vehicle: { make: { contains: search } } },
    { vehicle: { model: { contains: search } } },
  ] })
  const accessible = await context.query.InventoryStock.findMany({
    where: filters.length ? { AND: filters } : {},
    orderBy: { stockedAt: 'asc' },
    take: limit + 1,
    skip: offset,
    query: 'id',
  })
  const hasMore = accessible.length > limit
  const ids: string[] = accessible.slice(0, limit).map((item: any) => String(item.id))
  const canViewCost = permissions.canViewDealerCost({ session: context.session })
  const rows = ids.length ? await context.sudo().prisma.inventoryStock.findMany({
    where: { id: { in: ids } },
    include: {
      rooftop: { select: { id: true, name: true } },
      vehicle: { select: { id: true, vin: true, stockNumber: true, year: true, make: true, model: true, trim: true, mileage: true, status: true, priceCents: true, description: true, images: { where: { isPrimary: true }, take: 1, select: { imagePath: true } } } },
      acquisition: { select: { id: true, reference: true, status: true, vin: true, year: true, make: true, model: true, acquisitionSource: true, appraisalCents: true, purchaseCents: true, reconEstimateCents: true, updatedAt: true, vehicleId: true } },
      reconWorkItems: { orderBy: { createdAt: 'desc' }, take: 20, select: { id: true, title: true, category: true, status: true, estimatedCostCents: true, actualCostCents: true, dueAt: true, updatedAt: true } },
      merchandisingVersions: { orderBy: { version: 'desc' }, take: 1, select: { id: true, version: true, status: true, submittedAt: true, decidedAt: true, decisionReason: true, updatedAt: true } },
    },
  }) : []
  const byId = new Map(rows.map((row: any) => [row.id, row]))
  const now = Date.now()
  const items: any[] = ids.flatMap((id: string) => {
    const row: any = byId.get(id)
    if (!row?.vehicle) return []
    const daysInStock = Math.max(0, Math.floor((now - new Date(row.stockedAt).getTime()) / 86_400_000))
    return [{
      id: row.id,
      rooftop: row.rooftop,
      vehicle: { ...row.vehicle, primaryImagePath: row.vehicle.images[0]?.imagePath ?? null, images: undefined },
      acquisition: row.acquisition ?? null,
      stockNumber: row.stockNumber,
      locationCode: row.locationCode,
      locationLabel: row.locationLabel || null,
      stockedAt: row.stockedAt,
      updatedAt: row.updatedAt,
      frontlineAt: row.frontlineAt,
      daysInStock,
      isAged: daysInStock >= 60,
      reconStatus: row.reconStatus,
      merchandisingStatus: row.merchandisingStatus,
      feedStatus: row.feedStatus,
      cost: canViewCost ? { purchaseCostCents: row.purchaseCostCents ?? 0, reconCostCents: row.reconCostCents ?? 0, otherCostCents: row.otherCostCents ?? 0, totalCostCents: row.totalCostCents ?? 0 } : null,
      reconWorkItems: row.reconWorkItems.map((work: any) => ({ ...work, estimatedCostCents: canViewCost ? work.estimatedCostCents : null, actualCostCents: canViewCost ? work.actualCostCents : null })),
      latestMerchandisingVersion: row.merchandisingVersions[0] ?? null,
    }]
  })
  const canManageInventory = permissions.canManageInventory({ session: context.session })
  const intakeRooftops = canManageInventory
    ? await context.query.Rooftop.findMany({ where: { status: { equals: 'active' } }, orderBy: { name: 'asc' }, take: 100, query: 'id name' })
    : []
  const acquisitionIds: string[] = canManageInventory
    ? (await context.query.InventoryAcquisition.findMany({ where: { status: { in: ['appraised', 'approved', 'purchased', 'arrived', 'reconditioning'] } }, orderBy: { updatedAt: 'asc' }, take: 50, query: 'id' })).map((item: any) => item.id)
    : []
  const acquisitions = acquisitionIds.length ? await context.sudo().prisma.inventoryAcquisition.findMany({
    where: { id: { in: acquisitionIds } },
    select: { id: true, reference: true, status: true, vin: true, year: true, make: true, model: true, acquisitionSource: true, appraisalCents: true, purchaseCents: true, reconEstimateCents: true, updatedAt: true, vehicleId: true },
  }) : []
  const feedRunIds: string[] = permissions.canManageInventory({ session: context.session })
    ? (await context.query.InventoryFeedRun.findMany({ orderBy: { completedAt: 'desc' }, take: 10, query: 'id' })).map((item: any) => item.id)
    : []
  const feedRuns = feedRunIds.length ? await context.sudo().prisma.inventoryFeedRun.findMany({ where: { id: { in: feedRunIds } }, orderBy: { completedAt: 'desc' }, select: { id: true, channelKey: true, status: true, attemptedCount: true, succeededCount: true, failedCount: true, completedAt: true, _count: { select: { errors: true } } } }) : []
  return {
    items,
    acquisitions,
    feedRuns: feedRuns.map((run: any) => ({ ...run, errorCount: run._count.errors, _count: undefined })),
    channels: inventoryChannelKeys(),
    intakeRooftops,
    summary: {
      visibleCount: items.length,
      availableCount: items.filter(item => item.vehicle.status === 'available').length,
      agedCount: items.filter(item => item.isAged).length,
      reconOpenCount: items.reduce((count, item) => count + item.reconWorkItems.filter((work: any) => ['open', 'in-progress'].includes(work.status)).length, 0),
      totalRetailValueCents: items.reduce((total, item) => total + (item.vehicle.priceCents ?? 0), 0),
      totalCostCents: canViewCost ? items.reduce((total, item) => total + (item.cost?.totalCostCents ?? 0), 0) : null,
    },
    pageInfo: { limit, offset, hasMore },
  }
}
