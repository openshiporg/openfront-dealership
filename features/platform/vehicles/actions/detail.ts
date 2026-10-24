'use server'

import { revalidatePath } from 'next/cache'

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { ROOFTOP_STAFF_QUERY } from '@/features/platform/lib/rooftopStaffQuery'
import { inventoryCommandRequest, type InventoryCommandResponse } from '../lib/inventoryCommandClient'
import type { InventoryPublicListing, InventoryVehiclePhoto } from './index'

type Person = { id?: string; name: string | null } | null

export type VehicleDetailCore = {
  id: string
  vin: string
  stockNumber: string
  year: number
  make: string
  model: string
  trim: string
  exteriorColor: string
  interiorColor: string
  mileage: number | null
  listPriceCents: number | null
  priceCents: number | null
  condition: string | null
  status: string
  description: string
  features: string[]
  createdAt: string
  updatedAt: string
  rooftopId: string
  rooftopName: string | null
}

export type VehicleDetailStock = {
  id: string
  stockNumber: string
  locationCode: string
  locationLabel: string | null
  stockedAt: string
  frontlineAt: string | null
  updatedAt: string
  reconStatus: string
  merchandisingStatus: string
  feedStatus: string
  daysInStock: number
  cost: { purchaseCostCents: number; reconCostCents: number; otherCostCents: number; totalCostCents: number } | null
  publicListing: InventoryPublicListing
}

export type ConditionReport = {
  id: string
  reportDate: string
  inspector: string
  overallCondition: string | null
  mechanicalRating: string | null
  bodyRating: string | null
  interiorRating: string | null
  issues: Array<{ description: string; severity?: string; location?: string }>
  estimatedRepairs: number | null
  notes: string
  updatedAt: string
}

export type VehicleHistoryRecord = {
  id: string
  acquisitionDate: string | null
  acquisitionSource: string
  previousOwners: number | null
  hasAccidents: boolean
  accidentDetails: string
  serviceRecords: string
  titleStatus: string
  notes: string
  updatedAt: string
}

export type StockEvent = { id: string; eventType: string; reason: string; amountCents: number | null; evidence: Record<string, unknown> | null; occurredAt: string; actor: Person }
export type ReconWorkItem = {
  id: string
  title: string
  category: string
  status: string
  estimatedCostCents: number | null
  actualCostCents: number | null
  vendorName: string
  dueAt: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
  assignedTo: Person
}
export type MerchandisingVersion = {
  id: string
  version: number
  status: string
  submittedAt: string
  decidedAt: string | null
  decisionReason: string
  updatedAt: string
  submittedBy: Person
  decidedBy: Person
  snapshot: { priceCents?: number | null; mileage?: number | null; title?: string; description?: string; images?: unknown[] } | null
}
export type AcquisitionEvent = { id: string; fromStatus: string; toStatus: string; reason: string; occurredAt: string; actor: Person }
export type VehicleAcquisition = {
  id: string
  reference: string
  status: string
  acquisitionSource: string
  sourceReference: string
  appraisalCents: number
  purchaseCents: number | null
  reconEstimateCents: number | null
  odometer: number | null
  purchasedAt: string | null
  arrivedAt: string | null
  frontlineAt: string | null
  updatedAt: string
  events: AcquisitionEvent[]
}
export type PriceHistoryEntry = { id: string; effectiveDate: string; previousPriceCents: number | null; newPriceCents: number; changeReason: string; notes: string; changedBy: Person }
export type VehicleDeal = { id: string; status: string; createdAt: string; vehiclePriceCents: number | null; lead: { firstName: string | null; lastName: string | null } | null; salesperson: Person }
export type StaffOption = { id: string; name: string }

/** Each section loads on its own: a role that cannot read one (dealer cost, deals) still sees the rest. */
export type Section<T> = { ok: true; data: T } | { ok: false; error: string }

export type VehicleDetail = {
  vehicle: VehicleDetailCore
  stock: VehicleDetailStock | null
  images: InventoryVehiclePhoto[]
  conditionReports: ConditionReport[]
  history: VehicleHistoryRecord | null
  stockEvents: Section<StockEvent[]>
  reconWorkItems: Section<ReconWorkItem[]>
  merchandisingVersions: Section<MerchandisingVersion[]>
  acquisition: Section<VehicleAcquisition | null>
  priceHistory: Section<PriceHistoryEntry[]>
  deals: Section<VehicleDeal[]>
}

export type VehicleDetailResult = { success: true; detail: VehicleDetail } | { success: false; error: string; notFound?: boolean }

const VEHICLES_PATH = '/dashboard/platform/vehicles'

function section<T>(response: { success: boolean; error?: string }, pick: () => T): Section<T> {
  return response.success ? { ok: true, data: pick() } : { ok: false, error: response.error || 'Not available' }
}

function featureList(value: unknown): string[] {
  return Array.isArray(value) ? value.map(item => String(item ?? '').trim()).filter(Boolean) : []
}

function issueList(value: unknown): ConditionReport['issues'] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item: any) => {
    if (typeof item === 'string') return item.trim() ? [{ description: item.trim() }] : []
    const description = String(item?.description ?? '').trim()
    return description ? [{ description, severity: item?.severity ? String(item.severity) : undefined, location: item?.location ? String(item.location) : undefined }] : []
  })
}

export async function getInventoryVehicleDetail(id: string): Promise<VehicleDetailResult> {
  const core = await keystoneClient<{ vehicle: any }>(`
    query InventoryVehicleDetail($id: ID!) {
      vehicle(where: { id: $id }) {
        id vin stockNumber year make model trim exteriorColor interiorColor mileage listPriceCents priceCents condition status description features createdAt updatedAt
        rooftop { id name }
        inventoryStock { id stockNumber locationCode locationLabel stockedAt frontlineAt updatedAt reconStatus merchandisingStatus feedStatus }
        conditionReports(orderBy: { reportDate: desc }, take: 20) { id reportDate inspector overallCondition mechanicalRating bodyRating interiorRating issues estimatedRepairs notes updatedAt }
        history { id acquisitionDate acquisitionSource previousOwners hasAccidents accidentDetails serviceRecords titleStatus notes updatedAt }
      }
    }
  `, { id }, { cache: 'no-store' })
  if (!core.success) return { success: false, error: core.error }
  const raw = core.data.vehicle
  if (!raw) return { success: false, error: 'Vehicle not found', notFound: true }
  const stockId: string | null = raw.inventoryStock?.id ?? null
  const none = Promise.resolve({ success: true as const, data: null as any })

  const [workspace, events, recon, versions, acquisition, prices, deals] = await Promise.all([
    // The workspace computes signed photo URLs, dealer cost and the storefront gate state for the stock row.
    stockId ? keystoneClient<{ inventoryWorkspace: { items: any[] } }>(`
      query InventoryVehicleWorkspaceRow($search: String) {
        inventoryWorkspace(status: "all", search: $search, limit: 100) {
          items { id daysInStock cost { purchaseCostCents reconCostCents otherCostCents totalCostCents } vehicle { id images { id url isPrimary sortOrder uploaded } } publicListing { live reason action } }
        }
      }
    `, { search: raw.inventoryStock.stockNumber }, { cache: 'no-store' }) : none,
    stockId ? keystoneClient<{ inventoryStockEvents: any[] }>(`
      query InventoryStockLedger($stockId: ID!) {
        inventoryStockEvents(where: { stock: { id: { equals: $stockId } } }, orderBy: { occurredAt: desc }, take: 200) { id eventType reason amountCents evidence occurredAt actor { id name } }
      }
    `, { stockId }, { cache: 'no-store' }) : none,
    stockId ? keystoneClient<{ inventoryReconWorkItems: any[] }>(`
      query InventoryReconItems($stockId: ID!) {
        inventoryReconWorkItems(where: { stock: { id: { equals: $stockId } } }, orderBy: { createdAt: desc }, take: 100) {
          id title category status estimatedCostCents actualCostCents vendorName dueAt completedAt createdAt updatedAt assignedTo { id name }
        }
      }
    `, { stockId }, { cache: 'no-store' }) : none,
    stockId ? keystoneClient<{ inventoryMerchandisingVersions: any[] }>(`
      query InventoryMerchandisingHistory($stockId: ID!) {
        inventoryMerchandisingVersions(where: { stock: { id: { equals: $stockId } } }, orderBy: { version: desc }, take: 50) {
          id version status submittedAt decidedAt decisionReason updatedAt snapshot submittedBy { id name } decidedBy { id name }
        }
      }
    `, { stockId }, { cache: 'no-store' }) : none,
    keystoneClient<{ inventoryAcquisitions: any[] }>(`
      query VehicleAcquisition($id: ID!) {
        inventoryAcquisitions(where: { vehicle: { id: { equals: $id } } }, take: 1) {
          id reference status acquisitionSource sourceReference appraisalCents purchaseCents reconEstimateCents odometer purchasedAt arrivedAt frontlineAt updatedAt
          events(orderBy: { occurredAt: desc }, take: 50) { id fromStatus toStatus reason occurredAt actor { id name } }
        }
      }
    `, { id }, { cache: 'no-store' }),
    keystoneClient<{ priceHistories: any[] }>(`
      query VehiclePriceHistory($id: ID!) {
        priceHistories(where: { vehicle: { id: { equals: $id } } }, orderBy: { effectiveDate: desc }, take: 100) { id effectiveDate previousPriceCents newPriceCents changeReason notes changedBy { id name } }
      }
    `, { id }, { cache: 'no-store' }),
    keystoneClient<{ deals: any[] }>(`
      query VehicleDeals($id: ID!) {
        deals(where: { vehicle: { id: { equals: $id } } }, orderBy: { createdAt: desc }, take: 10) { id status createdAt vehiclePriceCents lead { firstName lastName } salesperson { id name } }
      }
    `, { id }, { cache: 'no-store' }),
  ])

  const row = workspace.success ? (workspace.data?.inventoryWorkspace?.items || []).find((item: any) => item.id === stockId) : null
  const stock: VehicleDetailStock | null = raw.inventoryStock ? {
    ...raw.inventoryStock,
    locationLabel: raw.inventoryStock.locationLabel || null,
    daysInStock: row?.daysInStock ?? Math.max(0, Math.floor((Date.now() - new Date(raw.inventoryStock.stockedAt).getTime()) / 86_400_000)),
    cost: row?.cost ?? null,
    publicListing: {
      live: Boolean(row?.publicListing?.live),
      reason: row?.publicListing?.reason || (row ? null : 'Not available'),
      action: row?.publicListing?.action === 'reapprove' || row?.publicListing?.action === 'resubmit' ? row.publicListing.action : null,
    },
  } : null

  return {
    success: true,
    detail: {
      vehicle: {
        id: raw.id,
        vin: raw.vin,
        stockNumber: raw.stockNumber,
        year: raw.year,
        make: raw.make,
        model: raw.model,
        trim: raw.trim || '',
        exteriorColor: raw.exteriorColor || '',
        interiorColor: raw.interiorColor || '',
        mileage: raw.mileage ?? null,
        listPriceCents: raw.listPriceCents ?? null,
        priceCents: raw.priceCents ?? null,
        condition: raw.condition ?? null,
        status: raw.status || 'available',
        description: raw.description || '',
        features: featureList(raw.features),
        createdAt: raw.createdAt,
        updatedAt: raw.updatedAt,
        rooftopId: raw.rooftop?.id || '',
        rooftopName: raw.rooftop?.name || null,
      },
      stock,
      images: row?.vehicle?.images || [],
      conditionReports: (raw.conditionReports || []).map((report: any) => ({ ...report, inspector: report.inspector || '', notes: report.notes || '', issues: issueList(report.issues) })),
      history: raw.history ? { ...raw.history, acquisitionSource: raw.history.acquisitionSource || '', accidentDetails: raw.history.accidentDetails || '', serviceRecords: raw.history.serviceRecords || '', titleStatus: raw.history.titleStatus || '', notes: raw.history.notes || '' } : null,
      stockEvents: section(events, () => (events.data?.inventoryStockEvents || []) as StockEvent[]),
      reconWorkItems: section(recon, () => (recon.data?.inventoryReconWorkItems || []).map((item: any) => ({ ...item, vendorName: item.vendorName || '' })) as ReconWorkItem[]),
      merchandisingVersions: section(versions, () => (versions.data?.inventoryMerchandisingVersions || []).map((version: any) => ({ ...version, decisionReason: version.decisionReason || '' })) as MerchandisingVersion[]),
      acquisition: section(acquisition, () => {
        const item = acquisition.data?.inventoryAcquisitions?.[0]
        return item ? { ...item, sourceReference: item.sourceReference || '', events: item.events || [] } as VehicleAcquisition : null
      }),
      priceHistory: section(prices, () => (prices.data?.priceHistories || []).map((entry: any) => ({ ...entry, changeReason: entry.changeReason || '', notes: entry.notes || '' })) as PriceHistoryEntry[]),
      deals: section(deals, () => (deals.data?.deals || []) as VehicleDeal[]),
    },
  }
}

export async function getInventoryStaff(rooftopId: string): Promise<StaffOption[]> {
  if (!rooftopId) return []
  const response = await keystoneClient<{ users: Array<{ id: string; name: string | null }> }>(ROOFTOP_STAFF_QUERY, { rooftopId }, { cache: 'no-store' })
  return response.success ? (response.data.users || []).map(user => ({ id: user.id, name: user.name || 'Unnamed' })) : []
}

function revalidateVehicle(vehicleId?: string) {
  revalidatePath(VEHICLES_PATH)
  if (vehicleId) revalidatePath(`${VEHICLES_PATH}/${vehicleId}`)
}

export async function updateInventoryVehicleDetails(data: {
  stockId: string
  vehicleId: string
  vin: string
  year: number
  make: string
  model: string
  trim: string
  exteriorColor: string
  interiorColor: string
  condition: string
  mileage: number | null
  features: string[]
  listPriceCents: number
  priceCents: number
  description: string
  priceChangeReason: string
  expectedUpdatedAt: string
  idempotencyKey: string
}): Promise<InventoryCommandResponse<{ updateInventoryVehicleDetails: { id: string; merchandisingStatus: string; updatedAt: string; reused: boolean } }>> {
  const { vehicleId, ...input } = data
  const response = await inventoryCommandRequest<{ updateInventoryVehicleDetails: { id: string; merchandisingStatus: string; updatedAt: string; reused: boolean } }>(`
    mutation UpdateInventoryVehicleDetails($data: UpdateInventoryVehicleDetailsInput!) {
      updateInventoryVehicleDetails(data: $data) { id stockId merchandisingStatus feedStatus updatedAt reused }
    }
  `, { data: { ...input, reason: 'Vehicle details edited from the vehicle page' } })
  if (response.success) revalidateVehicle(vehicleId)
  return response
}

const RATINGS = new Set(['excellent', 'good', 'fair', 'poor'])

export type ConditionReportInput = {
  id?: string
  vehicleId: string
  rooftopId: string
  reportDate: string
  inspector: string
  overallCondition: string
  mechanicalRating: string
  bodyRating: string
  interiorRating: string
  issues: string[]
  estimatedRepairs: number | null
  notes: string
}

/** VehicleConditionReport is open CRUD gated by canManageInventory and the rooftop scope. */
export async function saveConditionReport(input: ConditionReportInput): Promise<{ success: true } | { success: false; error: string }> {
  const date = new Date(input.reportDate)
  if (Number.isNaN(date.getTime())) return { success: false, error: 'Report date is invalid' }
  for (const [label, value] of [['Overall', input.overallCondition], ['Mechanical', input.mechanicalRating], ['Body', input.bodyRating], ['Interior', input.interiorRating]]) {
    if (value && !RATINGS.has(value)) return { success: false, error: `${label} rating is invalid` }
  }
  if (input.estimatedRepairs != null && (!Number.isSafeInteger(input.estimatedRepairs) || input.estimatedRepairs < 0)) return { success: false, error: 'Estimated repairs must be a whole dollar amount' }
  const data: Record<string, unknown> = {
    reportDate: date.toISOString(),
    inspector: input.inspector.trim().slice(0, 200),
    overallCondition: input.overallCondition || null,
    mechanicalRating: input.mechanicalRating || null,
    bodyRating: input.bodyRating || null,
    interiorRating: input.interiorRating || null,
    issues: input.issues.map(issue => issue.trim()).filter(Boolean).slice(0, 100).map(description => ({ description: description.slice(0, 500) })),
    estimatedRepairs: input.estimatedRepairs,
    notes: input.notes.trim().slice(0, 4_000),
  }
  const response = input.id
    ? await keystoneClient(`mutation UpdateConditionReport($id: ID!, $data: VehicleConditionReportUpdateInput!) { updateVehicleConditionReport(where: { id: $id }, data: $data) { id } }`, { id: input.id, data })
    : await keystoneClient(`mutation CreateConditionReport($data: VehicleConditionReportCreateInput!) { createVehicleConditionReport(data: $data) { id } }`, {
      data: { ...data, rooftop: { connect: { id: input.rooftopId } }, vehicle: { connect: { id: input.vehicleId } } },
    })
  if (!response.success) return { success: false, error: response.error }
  revalidateVehicle(input.vehicleId)
  return { success: true }
}

export type VehicleHistoryInput = {
  id?: string
  vehicleId: string
  rooftopId: string
  acquisitionDate: string
  acquisitionSource: string
  previousOwners: number | null
  hasAccidents: boolean
  accidentDetails: string
  serviceRecords: string
  titleStatus: string
  notes: string
}

/** VehicleHistory is one-to-one with the vehicle and open CRUD gated by canManageInventory. */
export async function saveVehicleHistory(input: VehicleHistoryInput): Promise<{ success: true } | { success: false; error: string }> {
  const acquisitionDate = input.acquisitionDate ? new Date(input.acquisitionDate) : null
  if (acquisitionDate && Number.isNaN(acquisitionDate.getTime())) return { success: false, error: 'Acquisition date is invalid' }
  if (input.previousOwners != null && (!Number.isSafeInteger(input.previousOwners) || input.previousOwners < 0 || input.previousOwners > 99)) return { success: false, error: 'Previous owners must be 0 to 99' }
  const data: Record<string, unknown> = {
    acquisitionDate: acquisitionDate ? acquisitionDate.toISOString() : null,
    acquisitionSource: input.acquisitionSource.trim().slice(0, 200),
    previousOwners: input.previousOwners,
    hasAccidents: input.hasAccidents,
    accidentDetails: input.hasAccidents ? input.accidentDetails.trim().slice(0, 4_000) : '',
    serviceRecords: input.serviceRecords.trim().slice(0, 4_000),
    titleStatus: input.titleStatus.trim().slice(0, 100),
    notes: input.notes.trim().slice(0, 4_000),
  }
  const response = input.id
    ? await keystoneClient(`mutation UpdateVehicleHistory($id: ID!, $data: VehicleHistoryUpdateInput!) { updateVehicleHistory(where: { id: $id }, data: $data) { id } }`, { id: input.id, data })
    : await keystoneClient(`mutation CreateVehicleHistory($data: VehicleHistoryCreateInput!) { createVehicleHistory(data: $data) { id } }`, {
      data: { ...data, rooftop: { connect: { id: input.rooftopId } }, vehicle: { connect: { id: input.vehicleId } } },
    })
  if (!response.success) return { success: false, error: response.error }
  revalidateVehicle(input.vehicleId)
  return { success: true }
}
