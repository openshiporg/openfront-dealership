'use server'

import { revalidatePath } from 'next/cache'

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { inventoryCommandRequest, inventoryCommandUpload, type InventoryCommandResponse } from '../lib/inventoryCommandClient'

export interface InventoryVehicle {
  id: string
  stockNumber: string
  vin: string
  year: number
  make: string
  model: string
  trim: string | null
  color: string | null
  interiorColor: string | null
  mileage: number
  price: number
  purchasePrice: number | null
  description: string
  primaryImagePath: string | null
  /** Primary first, then gallery order. */
  images: InventoryVehiclePhoto[]
  status: string
  condition: string
  dateAcquired: string | null
  createdAt: string
  inventoryStockId: string
  locationCode: string
  locationLabel: string | null
  reconStatus: string
  merchandisingStatus: string
  feedStatus: string
  frontlineAt: string | null
  stockUpdatedAt: string
  latestMerchandisingVersion: { id: string; status: string; updatedAt: string } | null
  reconWorkItems: Array<{ id: string; title: string; status: string; updatedAt: string }>
  acquisition: { id: string; status: string; updatedAt: string } | null
  publicListing: InventoryPublicListing
}

export type InventoryVehiclePhoto = { id: string; url: string | null; isPrimary: boolean; sortOrder: number; uploaded: boolean }

export type InventoryPublicListing = { live: boolean; reason: string | null; action: 'reapprove' | 'resubmit' | null }

export type IntakeRooftop = { id: string; name: string }

type InventoryWorkspaceItem = {
  id: string
  stockNumber: string
  locationCode: string
  locationLabel: string | null
  stockedAt: string
  updatedAt: string
  reconStatus: string
  merchandisingStatus: string
  feedStatus: string
  frontlineAt: string | null
  vehicle: {
    id: string
    vin: string
    stockNumber: string
    year: number
    make: string
    model: string
    trim: string | null
    exteriorColor: string | null
    interiorColor: string | null
    condition: string | null
    mileage: number
    status: string
    priceCents: number | null
    description: string | null
    primaryImagePath: string | null
    images: InventoryVehiclePhoto[] | null
  }
  cost: { purchaseCostCents: number | null; totalCostCents: number | null } | null
  acquisition: { id: string; status: string; updatedAt: string } | null
  reconWorkItems: Array<{ id: string; title: string; status: string; updatedAt: string }> | null
  latestMerchandisingVersion: { id: string; status: string; updatedAt: string } | null
  publicListing: { live: boolean; reason: string | null; action: string | null } | null
}

export type InventoryWorkspaceResult =
  | { success: true; vehicles: InventoryVehicle[]; intakeRooftops: IntakeRooftop[] }
  | { success: false; error: string }

const VEHICLES_PATH = '/dashboard/platform/vehicles'

function toInventoryVehicle(item: InventoryWorkspaceItem): InventoryVehicle {
  return {
    id: item.vehicle.id,
    stockNumber: item.stockNumber,
    vin: item.vehicle.vin,
    year: item.vehicle.year,
    make: item.vehicle.make,
    model: item.vehicle.model,
    trim: item.vehicle.trim,
    color: item.vehicle.exteriorColor || null,
    interiorColor: item.vehicle.interiorColor || null,
    mileage: item.vehicle.mileage,
    price: item.vehicle.priceCents == null ? 0 : item.vehicle.priceCents / 100,
    purchasePrice: item.cost?.purchaseCostCents == null ? null : item.cost.purchaseCostCents / 100,
    description: item.vehicle.description || '',
    primaryImagePath: item.vehicle.primaryImagePath || null,
    images: item.vehicle.images || [],
    status: item.vehicle.status,
    condition: item.vehicle.condition || '',
    dateAcquired: item.stockedAt,
    createdAt: item.stockedAt,
    inventoryStockId: item.id,
    locationCode: item.locationCode,
    locationLabel: item.locationLabel,
    reconStatus: item.reconStatus,
    merchandisingStatus: item.merchandisingStatus,
    feedStatus: item.feedStatus,
    frontlineAt: item.frontlineAt,
    stockUpdatedAt: item.updatedAt,
    latestMerchandisingVersion: item.latestMerchandisingVersion,
    reconWorkItems: item.reconWorkItems || [],
    acquisition: item.acquisition || null,
    publicListing: {
      live: Boolean(item.publicListing?.live),
      reason: item.publicListing?.reason || null,
      action: item.publicListing?.action === 'reapprove' || item.publicListing?.action === 'resubmit' ? item.publicListing.action : null,
    },
  }
}

export async function getInventoryWorkspace(status: string): Promise<InventoryWorkspaceResult> {
  const response = await keystoneClient<{ inventoryWorkspace: { items: InventoryWorkspaceItem[] | null; intakeRooftops: IntakeRooftop[] | null } }>(`
    query InventoryWorkspace($status: String) {
      inventoryWorkspace(status: $status, limit: 100) {
        items {
          id stockNumber locationCode locationLabel stockedAt updatedAt daysInStock reconStatus merchandisingStatus feedStatus frontlineAt
          vehicle { id vin stockNumber year make model trim exteriorColor interiorColor condition mileage status priceCents description primaryImagePath images { id url isPrimary sortOrder uploaded } }
          cost { purchaseCostCents totalCostCents }
          acquisition { id status updatedAt }
          reconWorkItems { id title status updatedAt }
          latestMerchandisingVersion { id status updatedAt }
          publicListing { live reason action }
        }
        intakeRooftops { id name }
      }
    }
  `, { status }, { cache: 'no-store' })

  if (!response.success) return { success: false, error: response.error }
  return {
    success: true,
    vehicles: (response.data.inventoryWorkspace.items || []).map(toInventoryVehicle),
    intakeRooftops: response.data.inventoryWorkspace.intakeRooftops || [],
  }
}

async function runInventoryMutation<T>(mutation: string, variables: Record<string, unknown>): Promise<InventoryCommandResponse<T>> {
  const response = await inventoryCommandRequest<T>(mutation, variables)
  if (response.success) revalidatePath(VEHICLES_PATH)
  return response
}

export async function intakeInventoryVehicle(data: {
  rooftopId: string
  idempotencyKey: string
  reason: string
  acquisitionSource: string
  sourceReference: string
  vin: string
  stockNumber: string
  year: number
  make: string
  model: string
  trim: string
  exteriorColor: string
  interiorColor: string
  mileage: number
  purchasePriceCents: number
  listPriceCents: number
  priceCents: number
  condition: string
  description: string
  features: string[]
  imagePath: string
  locationCode: string
  locationLabel: string
}) {
  return runInventoryMutation<{ intakeInventoryVehicle: { vehicleId: string; acquisitionId: string; stockId: string; reused: boolean; status: string | null } }>(`
    mutation IntakeInventoryVehicle($data: IntakeInventoryVehicleInput!) {
      intakeInventoryVehicle(data: $data) { vehicleId acquisitionId stockId reused status }
    }
  `, { data })
}

export async function updateInventoryMerchandisingDraft(data: {
  stockId: string
  priceCents: number
  listPriceCents: number
  mileage: number
  description: string
  imagePath?: string
  expectedUpdatedAt: string
  reason: string
  idempotencyKey: string
}) {
  return runInventoryMutation(`
    mutation UpdateInventoryMerchandisingDraft($data: UpdateInventoryMerchandisingDraftInput!) {
      updateInventoryMerchandisingDraft(data: $data) { stockId merchandisingStatus feedStatus updatedAt reused }
    }
  `, { data })
}

type PhotoCommandResult = { stockId: string; merchandisingStatus: string; updatedAt: string; reused: boolean }

/** Adds one photo: a file from `formData.photo` uploaded to the bucket, or a typed `imageUrl`. */
export async function addInventoryVehiclePhoto(formData: FormData) {
  const photo = formData.get('photo')
  const data = {
    stockId: String(formData.get('stockId') || ''),
    imageUrl: String(formData.get('imageUrl') || '') || null,
    reason: 'Photo added from inventory operations desk',
    idempotencyKey: String(formData.get('idempotencyKey') || ''),
  }
  const mutation = `
    mutation AddInventoryVehiclePhoto($data: AddInventoryVehiclePhotoInput!) {
      addInventoryVehiclePhoto(data: $data) { id stockId merchandisingStatus updatedAt reused }
    }
  `
  const response = photo instanceof File && photo.size > 0
    ? await inventoryCommandUpload<{ addInventoryVehiclePhoto: PhotoCommandResult }>(mutation, { data: { ...data, photo: { upload: null } } }, 'data.photo.upload', photo)
    : await inventoryCommandRequest<{ addInventoryVehiclePhoto: PhotoCommandResult }>(mutation, { data })
  if (response.success) revalidatePath(VEHICLES_PATH)
  return response
}

export async function arrangeInventoryVehiclePhotos(data: { stockId: string; imageIds: string[]; idempotencyKey: string }) {
  return runInventoryMutation<{ arrangeInventoryVehiclePhotos: PhotoCommandResult }>(`
    mutation ArrangeInventoryVehiclePhotos($data: ArrangeInventoryVehiclePhotosInput!) {
      arrangeInventoryVehiclePhotos(data: $data) { id stockId merchandisingStatus updatedAt reused }
    }
  `, { data: { ...data, reason: 'Photos reordered from inventory operations desk' } })
}

export async function removeInventoryVehiclePhoto(data: { stockId: string; imageId: string; idempotencyKey: string }) {
  return runInventoryMutation<{ removeInventoryVehiclePhoto: PhotoCommandResult }>(`
    mutation RemoveInventoryVehiclePhoto($data: RemoveInventoryVehiclePhotoInput!) {
      removeInventoryVehiclePhoto(data: $data) { id stockId merchandisingStatus updatedAt reused }
    }
  `, { data: { ...data, reason: 'Photo removed from inventory operations desk' } })
}

export async function moveInventoryStock(data: {
  stockId: string
  locationCode: string
  locationLabel: string
  expectedUpdatedAt: string
  reason: string
  idempotencyKey: string
}) {
  return runInventoryMutation(`
    mutation MoveInventoryStock($data: MoveInventoryStockInput!) {
      moveInventoryStock(data: $data) { stockId updatedAt reused }
    }
  `, { data })
}

export async function recordInventoryCost(data: {
  stockId: string
  costType: string
  amountCents: number
  reference?: string
  reason: string
  idempotencyKey: string
}) {
  return runInventoryMutation(`
    mutation RecordInventoryCost($data: RecordInventoryCostInput!) {
      recordInventoryCost(data: $data) { stockId updatedAt reused }
    }
  `, { data })
}

export async function openInventoryReconWorkItem(data: {
  stockId: string
  title: string
  category: string
  estimatedCostCents: number
  vendorName?: string
  assignedToId?: string | null
  dueAt?: string | null
  reason: string
  idempotencyKey: string
}) {
  return runInventoryMutation(`
    mutation OpenInventoryRecon($data: CreateInventoryReconWorkInput!) {
      openInventoryReconWorkItem(data: $data) { id stockId reused }
    }
  `, { data })
}

export async function transitionInventoryReconWorkItem(data: {
  id: string
  toStatus: string
  actualCostCents?: number
  expectedUpdatedAt: string
  reason: string
  idempotencyKey: string
}) {
  return runInventoryMutation<{ transitionInventoryReconWorkItem?: unknown }>(`
    mutation TransitionInventoryRecon($data: TransitionInventoryReconWorkInput!) {
      transitionInventoryReconWorkItem(data: $data) { id stockId reused status }
    }
  `, { data })
}

export async function transitionInventoryAcquisition(variables: {
  id: string
  toStatus: string
  expectedUpdatedAt: string
  reason: string
  idempotencyKey: string
  purchaseCents?: number | null
  reconEstimateCents?: number | null
}) {
  return runInventoryMutation(`
    mutation TransitionInventoryAcquisition($id: ID!, $toStatus: String!, $expectedUpdatedAt: DateTime!, $reason: String!, $purchaseCents: Int, $reconEstimateCents: Int, $idempotencyKey: String!) {
      transitionInventoryAcquisition(id: $id, toStatus: $toStatus, expectedUpdatedAt: $expectedUpdatedAt, reason: $reason, purchaseCents: $purchaseCents, reconEstimateCents: $reconEstimateCents, idempotencyKey: $idempotencyKey) { id status updatedAt }
    }
  `, { ...variables, purchaseCents: variables.purchaseCents ?? null, reconEstimateCents: variables.reconEstimateCents ?? null })
}

export async function decideInventoryMerchandising(data: {
  id: string
  decision: string
  reason: string
  expectedUpdatedAt: string
  idempotencyKey: string
}) {
  return runInventoryMutation<Record<string, unknown>>(`
    mutation DecideInventoryMerchandising($data: DecideInventoryMerchandisingInput!) {
      decideInventoryMerchandising(data: $data) { id stockId reused merchandisingStatus }
    }
  `, { data })
}

export async function submitInventoryMerchandising(data: {
  stockId: string
  reason: string
  idempotencyKey: string
}) {
  return runInventoryMutation<Record<string, unknown>>(`
    mutation SubmitInventoryMerchandising($data: SubmitInventoryMerchandisingInput!) {
      submitInventoryMerchandising(data: $data) { id stockId reused merchandisingStatus }
    }
  `, { data })
}

export async function recordInventoryFeedRun(data: {
  channelKey: string
  stockIds: string[]
  errors: Array<Record<string, string>>
  idempotencyKey: string
}) {
  return runInventoryMutation<{ recordInventoryFeedRun?: unknown }>(`
    mutation RecordInventoryFeedRun($data: RecordInventoryFeedRunInput!) {
      recordInventoryFeedRun(data: $data) { id status attemptedCount failedCount reused }
    }
  `, { data })
}

export async function getDealershipCurrencyCode() {
  const response = await keystoneClient<{ dealershipProfile: { currencyCode: string | null } | null }>(`
    query DealershipCurrencyCode {
      dealershipProfile { currencyCode }
    }
  `, {}, { cache: 'no-store' })
  return (response.success && response.data.dealershipProfile?.currencyCode) || 'USD'
}

export type InventoryMake = { id: string; name: string; models: Array<{ id: string; name: string }> }

export async function getInventoryMakes(): Promise<InventoryMake[]> {
  const response = await keystoneClient<{ makes: InventoryMake[] | null }>(`
    query InventoryMakes {
      makes(orderBy: { name: asc }, take: 200) { id name models(orderBy: { name: asc }) { id name } }
    }
  `, {}, { cache: 'no-store' })
  return response.success ? (response.data.makes || []).map(make => ({ ...make, models: make.models || [] })) : []
}
