import { assertStorefrontRooftopSlug, resolvePublicRooftopId, storefrontRooftopSlug } from '../../tenantRecords'
import { assertPublishableInventory } from '../../lifecycle/inventoryPublication'
import { loadPublicInventoryImageUrls, lockPublicInventoryRows } from './publicStorefrontInventory'

const MAX_REVIEW_VALIDATION_CANDIDATES = 5_000
const MAX_PUBLIC_PAGE_SIZE = 200

export type PublicInventoryFeedQuery = {
  rooftopSlug?: string
  condition?: 'new' | 'used' | 'certified'
  createdSince?: string
  updatedSince?: string
  take: number
  skip: number
}

function optionalDate(value: string | undefined, label: string) {
  if (!value) return undefined
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) throw new Error(`Invalid ${label} inventory feed filter`)
  return parsed
}

export async function getPublicInventoryFeed(context: any, input: PublicInventoryFeedQuery) {
  const rooftopSlug = await assertStorefrontRooftopSlug(context, input.rooftopSlug)
  const rooftopId = await resolvePublicRooftopId(context, rooftopSlug)
  const createdSince = optionalDate(input.createdSince, 'createdSince')
  const updatedSince = optionalDate(input.updatedSince, 'updatedSince')
  const sudo = context.sudo()
  const [validated, rooftop, profile] = await Promise.all([
    sudo.prisma.$transaction(async (tx: any) => {
      const rooftopState = await tx.rooftop.findUnique({
        where: { id: rooftopId },
        select: { id: true, status: true, dealerGroupId: true, dealerGroup: { select: { status: true } } },
      })
      if (!rooftopState || rooftopState.status !== 'active' || rooftopState.dealerGroup?.status !== 'active' || !rooftopState.dealerGroupId) {
        throw new Error('The requested public dealership location is unavailable')
      }
      await lockPublicInventoryRows(tx, rooftopId, rooftopState.dealerGroupId, [])
      const candidates = await tx.inventoryStock.findMany({
        where: {
          rooftopId,
          reconStatus: 'completed',
          merchandisingStatus: 'approved',
          feedStatus: 'succeeded',
          frontlineAt: { not: null },
          approvedRevisionHash: { not: '' },
          ...(updatedSince ? { updatedAt: { gte: updatedSince } } : {}),
          vehicle: { is: {
            status: 'available',
            ...(input.condition ? { condition: input.condition } : {}),
            ...(createdSince ? { createdAt: { gte: createdSince } } : {}),
          } },
        },
        orderBy: [{ updatedAt: 'desc' }, { stockedAt: 'desc' }],
        take: MAX_REVIEW_VALIDATION_CANDIDATES + 1,
        include: {
          rooftop: { include: { dealerGroup: true } },
          merchandisingVersions: { orderBy: { version: 'desc' }, take: 1 },
          vehicle: { include: { images: { orderBy: { sortOrder: 'asc' } } } },
        },
      })
      if (candidates.length > MAX_REVIEW_VALIDATION_CANDIDATES) {
        throw new Error('Public inventory review validation capacity exceeded; refusing to emit an incomplete feed.')
      }
      await lockPublicInventoryRows(tx, rooftopId, rooftopState.dealerGroupId, candidates)
      const valid = candidates.flatMap((stock: any) => {
        if (stock.rooftop?.status !== 'active' || stock.rooftop?.dealerGroup?.status !== 'active') return []
        try { return [{ ...stock, approvedRevision: assertPublishableInventory(stock) }] }
        catch { return [] }
      })
      const imageIds = valid.flatMap((stock: any) => (stock.vehicle?.images || []).map((image: any) => image.id))
      const imageUrlById = await loadPublicInventoryImageUrls(sudo, imageIds)
      return valid.map((stock: any) => ({
        ...stock,
        vehicle: {
          ...stock.vehicle,
          images: (stock.vehicle.images || []).map((image: any) => ({
            ...image,
            image: image.image_id ? { url: imageUrlById.get(image.id) || null } : null,
          })),
        },
      }))
    }, { isolationLevel: 'RepeatableRead', timeout: 30_000 }),
    sudo.query.Rooftop.findOne({ where: { id: rooftopId }, query: 'id name publicSlug currencyCode' }),
    sudo.query.DealershipProfile.findOne({ where: { id: 1 }, query: 'id name websiteUrl' }),
  ])
  const take = Math.min(MAX_PUBLIC_PAGE_SIZE, Math.max(1, Number.isFinite(input.take) ? Math.trunc(input.take) : 100))
  const skip = Math.max(0, Number.isFinite(input.skip) ? Math.trunc(input.skip) : 0)
  return {
    rooftopId,
    rooftopSlug,
    dealershipName: String(profile?.name || rooftop?.name || ''),
    dealershipWebsite: String(profile?.websiteUrl || ''),
    currencyCode: String(rooftop?.currencyCode || 'USD').toUpperCase(),
    stocks: validated.slice(skip, skip + take),
    totalCount: validated.length,
  }
}

const FEED_SCHEMA = 'openfront.inventory.v1'
const DEFAULT_TAKE = 100
const MAX_TAKE = 200
const CONDITIONS = new Set(['new', 'used', 'certified'])

export type PublicInventoryFeedRequest = {
  baseUrl: string
  pathname: string
  search: string
  searchParams: URLSearchParams
}

export type PublicInventoryFeedResponse = {
  status: number
  body: Record<string, unknown>
}

function parseInteger(value: string | null, fallback: number) {
  if (!value) return fallback
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

function parseDate(value: string | null, label: string) {
  if (!value) return undefined
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) throw new Error(`${label} must be a valid ISO date.`)
  return parsed.toISOString()
}

function absoluteUrl(baseUrl: string, path: string) {
  return new URL(path, `${baseUrl.replace(/\/$/, '')}/`).toString()
}

function normalizeStock(stock: any, baseUrl: string, currency: string) {
  const vehicle = stock.vehicle
  const price = vehicle.priceCents == null ? (vehicle.price ?? vehicle.listPrice ?? 0) : vehicle.priceCents / 100
  const primaryImage = vehicle.images?.find((image: any) => image.isPrimary) || vehicle.images?.[0]
  return {
    id: vehicle.id,
    vin: vehicle.vin,
    stockNumber: stock.stockNumber,
    status: vehicle.status,
    condition: vehicle.condition,
    year: vehicle.year,
    make: vehicle.make,
    model: vehicle.model,
    trim: vehicle.trim,
    exteriorColor: vehicle.exteriorColor,
    interiorColor: vehicle.interiorColor,
    mileage: vehicle.mileage,
    price,
    currency,
    description: vehicle.description,
    features: vehicle.features || [],
    primaryImageUrl: primaryImage?.imagePath || primaryImage?.image?.url || null,
    images: (vehicle.images || []).map((image: any) => ({
      id: image.id,
      url: image.imagePath || image.image?.url || null,
      caption: image.caption,
      category: image.category,
      isPrimary: image.isPrimary,
      sortOrder: image.sortOrder,
    })),
    publication: {
      stockedAt: stock.stockedAt,
      frontlineAt: stock.frontlineAt,
      reconStatus: stock.reconStatus,
      merchandisingStatus: stock.merchandisingStatus,
      feedStatus: stock.feedStatus,
      approvedVersion: stock.approvedRevision?.version ?? null,
      updatedAt: stock.updatedAt,
    },
    vehicleUrl: absoluteUrl(baseUrl, `/inventory/${vehicle.id}`),
    createdAt: vehicle.createdAt,
    updatedAt: vehicle.updatedAt,
  }
}

export async function getPublicInventoryFeedResponse(
  context: any,
  request: PublicInventoryFeedRequest
): Promise<PublicInventoryFeedResponse> {
  const { baseUrl, pathname, search, searchParams } = request
  try {
    if (searchParams.has('includeUnavailable')) {
      return { status: 400, body: { error: 'Unavailable inventory is never exposed by the public feed.' } }
    }
    const rooftopSlug = await storefrontRooftopSlug(context)
    if (!rooftopSlug) {
      return { status: 503, body: { error: 'Public inventory is not available.' } }
    }
    const requestedRooftop = (searchParams.get('rooftop') || rooftopSlug).trim().toLowerCase()
    if (requestedRooftop !== rooftopSlug) {
      return { status: 404, body: { error: 'This dealership location is not available.' } }
    }
    const condition = searchParams.get('condition')
    if (condition && !CONDITIONS.has(condition)) {
      return { status: 400, body: { error: 'Condition filter is invalid.' } }
    }
    const updatedSince = parseDate(searchParams.get('updatedSince'), 'updatedSince')
    const createdSince = parseDate(searchParams.get('createdSince'), 'createdSince')
    const take = Math.min(Math.max(parseInteger(searchParams.get('take'), DEFAULT_TAKE), 1), MAX_TAKE)
    const skip = Math.max(parseInteger(searchParams.get('skip'), 0), 0)
    const result = await getPublicInventoryFeed(context, {
      rooftopSlug,
      condition: condition as 'new' | 'used' | 'certified' | undefined,
      updatedSince,
      createdSince,
      take,
      skip,
    })
    const hasMore = skip + result.stocks.length < result.totalCount
    return {
      status: 200,
      body: {
        schema: FEED_SCHEMA,
        generatedAt: new Date().toISOString(),
        dealership: {
          rooftop: result.rooftopSlug,
          name: result.dealershipName,
          website: result.dealershipWebsite || absoluteUrl(baseUrl, '/'),
          feedUrl: absoluteUrl(baseUrl, `${pathname}${search}`),
        },
        sync: {
          incrementalUpdatesSupported: false,
          freshnessField: 'publication.updatedAt',
          createdSinceParam: 'createdSince',
          updatedSinceParam: 'updatedSince',
          note: 'Date filters return matching current eligible inventory only; removals require a full reconciliation.',
        },
        sort: { field: 'publication.updatedAt', direction: 'desc' },
        filters: {
          rooftop: result.rooftopSlug,
          condition: condition || null,
          createdSince: createdSince || null,
          updatedSince: updatedSince || null,
        },
        pagination: {
          take,
          skip,
          count: result.stocks.length,
          totalCount: result.totalCount,
          hasMore,
          next: hasMore
            ? absoluteUrl(baseUrl, `${pathname}?${new URLSearchParams({
                ...Object.fromEntries(searchParams.entries()),
                rooftop: result.rooftopSlug,
                skip: String(skip + result.stocks.length),
                take: String(take),
              }).toString()}`)
            : null,
        },
        vehicles: result.stocks.map((stock: any) => normalizeStock(stock, baseUrl, result.currencyCode)),
      },
    }
  } catch (error) {
    if (error instanceof Error && /must be a valid ISO date/.test(error.message)) {
      return { status: 400, body: { error: error.message } }
    }
    console.error('Inventory feed generation failed:', error)
    return { status: 500, body: { error: 'Unable to generate inventory feed.' } }
  }
}
