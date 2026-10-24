'use server'

import { revalidatePath } from 'next/cache'

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { inventoryCommandRequest } from '../lib/inventoryCommandClient'
import { ACQUISITION_STATUSES } from '../lib/inventoryLabels'

type Person = { id?: string; name: string | null } | null

export type AcquisitionRow = {
  id: string
  reference: string
  status: string
  acquisitionSource: string
  sourceReference: string
  vin: string
  year: number
  make: string
  model: string
  odometer: number | null
  appraisalCents: number
  purchaseCents: number | null
  reconEstimateCents: number | null
  purchasedAt: string | null
  arrivedAt: string | null
  frontlineAt: string | null
  createdAt: string
  updatedAt: string
  rooftop: { id: string; name: string | null } | null
  vehicle: { id: string; stockNumber: string | null } | null
  stock: { id: string } | null
  requestedBy: Person
  events: Array<{ id: string; fromStatus: string; toStatus: string; reason: string; occurredAt: string; actor: Person }>
}

export type AcquisitionListResult =
  | { success: true; acquisitions: AcquisitionRow[]; counts: Record<string, number>; rooftops: Array<{ id: string; name: string }> }
  | { success: false; error: string }

const ACQUISITIONS_PATH = '/dashboard/platform/vehicles/acquisitions'

export async function getAcquisitions(status: string, search: string): Promise<AcquisitionListResult> {
  const filters: Record<string, unknown>[] = []
  if (status === 'active') filters.push({ status: { in: ['appraised', 'approved', 'purchased', 'arrived', 'reconditioning'] } })
  else if (status && status !== 'all') filters.push({ status: { equals: status } })
  const term = search.trim().slice(0, 100)
  if (term) filters.push({ OR: [
    { reference: { contains: term, mode: 'insensitive' } },
    { vin: { contains: term.toUpperCase() } },
    { make: { contains: term, mode: 'insensitive' } },
    { model: { contains: term, mode: 'insensitive' } },
    { sourceReference: { contains: term, mode: 'insensitive' } },
  ] })
  const countFields = ACQUISITION_STATUSES.map(value => `${value.replace(/-/g, '_')}: inventoryAcquisitionsCount(where: { status: { equals: "${value}" } })`).join('\n')
  const response = await keystoneClient<Record<string, any>>(`
    query InventoryAcquisitions($where: InventoryAcquisitionWhereInput!) {
      inventoryAcquisitions(where: $where, orderBy: { updatedAt: desc }, take: 200) {
        id reference status acquisitionSource sourceReference vin year make model odometer appraisalCents purchaseCents reconEstimateCents
        purchasedAt arrivedAt frontlineAt createdAt updatedAt
        rooftop { id name }
        vehicle { id stockNumber }
        stock { id }
        requestedBy { id name }
        events(orderBy: { occurredAt: desc }, take: 50) { id fromStatus toStatus reason occurredAt actor { id name } }
      }
      ${countFields}
      rooftops(where: { status: { equals: "active" } }, orderBy: { name: asc }, take: 100) { id name }
    }
  `, { where: filters.length ? { AND: filters } : {} }, { cache: 'no-store' })
  if (!response.success) return { success: false, error: response.error }
  const counts = Object.fromEntries(ACQUISITION_STATUSES.map(value => [value, Number(response.data[value.replace(/-/g, '_')] || 0)]))
  return {
    success: true,
    acquisitions: (response.data.inventoryAcquisitions || []).map((row: any) => ({ ...row, sourceReference: row.sourceReference || '', events: row.events || [] })),
    counts,
    rooftops: response.data.rooftops || [],
  }
}

function revalidate() {
  revalidatePath(ACQUISITIONS_PATH)
  revalidatePath('/dashboard/platform/vehicles')
}

export async function startInventoryAcquisition(data: {
  rooftopId: string
  acquisitionSource: string
  sourceReference: string
  vin: string
  year: number
  make: string
  model: string
  odometer: number | null
  appraisalCents: number
  reconEstimateCents: number | null
  idempotencyKey: string
}) {
  const response = await inventoryCommandRequest<{ startInventoryAcquisition: { id: string; reference: string; status: string } | null }>(`
    mutation StartInventoryAcquisition($data: StartInventoryAcquisitionInput!) {
      startInventoryAcquisition(data: $data) { id reference status }
    }
  `, { data: { ...data, reason: 'Appraisal recorded from the acquisitions desk' } })
  if (response.success) revalidate()
  return response
}

/** Receives a purchased acquisition into stock: creates the vehicle from the acquisition and stocks it. */
export async function receiveAcquisitionIntoStock(data: {
  acquisitionId: string
  /** Set when the acquisition already has a vehicle; the stock is then established for that vehicle. */
  vehicleId?: string
  stockNumber: string
  locationCode: string
  condition: string
  trim: string
  exteriorColor: string
  interiorColor: string
  idempotencyKey: string
}) {
  const response = await inventoryCommandRequest<{ establishInventoryStock: { id: string; stockId: string; reused: boolean } }>(`
    mutation EstablishInventoryStock($data: EstablishInventoryStockInput!) {
      establishInventoryStock(data: $data) { id stockId reused }
    }
  `, { data: { ...data, locationLabel: data.locationCode, reason: 'Acquisition received into stock from the acquisitions desk' } })
  if (response.success) revalidate()
  return response
}
