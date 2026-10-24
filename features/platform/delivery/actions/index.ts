'use server'

import { revalidatePath } from 'next/cache'

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { operatorCommandRequest } from '@/features/platform/lib/operatorCommandClient'

export type DeliveryRecord = {
  id: string
  status: string
  updatedAt: string
  saleDate: string | null
  financeEvidence: unknown
  vehicle: { id: string; vin: string; stockNumber: string; year: number; make: string; model: string; status: string } | null
  lead: { id: string; firstName: string; lastName: string } | null
  salesperson: { id: string; name: string } | null
}

export type DeliveryChecklistItem = { code: string; status: string; evidenceReference?: string; source?: string }
export type WeOwe = { id: string; description: string; status: string; promisedAt: string; owner: { id: string; name: string } | null }
export type DeliveryCase = {
  id: string
  updatedAt: string
  deliverySnapshot: unknown
  deal: { id: string } | null
  status: string
  appointmentAt: string | null
  checklist: DeliveryChecklistItem[] | null
  customerAcknowledgment: string | null
  weOweItems: WeOwe[]
}

export type DeliveryWorkspace = { deliveries: DeliveryRecord[]; cases: DeliveryCase[] }

const DELIVERY_PATH = '/dashboard/platform/delivery'

export async function getDeliveryWorkspace() {
  return keystoneClient<{ deliveryWorkspace: DeliveryWorkspace }>(`
    query DeliveryWorkspace {
      deliveryWorkspace(limit: 100) {
        deliveries { id financeEvidence status updatedAt saleDate vehicle { id vin stockNumber year make model status } lead { id firstName lastName } salesperson { id name } }
        cases { id updatedAt deliverySnapshot deal { id } status appointmentAt checklist customerAcknowledgment weOweItems { id description status promisedAt owner { id name } } }
      }
    }
  `, {}, { cache: 'no-store' })
}

export async function manageDeliveryCase(data: {
  dealId: string
  action: 'schedule' | 'arrive' | 'record-checklist' | 'acknowledge'
  appointmentAt?: string
  checklist?: DeliveryChecklistItem[]
  customerAcknowledgment?: string
  idempotencyKey: string
}) {
  const response = await operatorCommandRequest(`
    mutation ManageDeliveryCase($data: ManageDeliveryCaseInput!) {
      manageDeliveryCase(data: $data) { id status }
    }
  `, { data })
  if (response.success) revalidatePath(DELIVERY_PATH)
  return response
}

export async function completeDealDelivery(data: {
  dealId: string
  expectedUpdatedAt: string
  expectedFundingUpdatedAt: string
  expectedDeliveryCaseUpdatedAt: string
  idempotencyKey: string
}) {
  const response = await operatorCommandRequest(`
    mutation CompleteDealDelivery($data: CompleteDealDeliveryInput!) {
      completeDealDelivery(data: $data) { id status reused updatedAt }
    }
  `, { data })
  if (response.success) revalidatePath(DELIVERY_PATH)
  return response
}

export async function manageWeOweItem(data: {
  dealId: string
  itemId?: string
  action: 'create' | 'fulfill' | 'waive'
  description?: string
  promisedAt?: string
  ownerId?: string
  estimatedCostCents?: number
  fulfillmentEvidence?: string
  customerAcknowledgment?: string
  idempotencyKey: string
}) {
  const response = await operatorCommandRequest(`
    mutation ManageWeOwe($data: ManageWeOweItemInput!) {
      manageWeOweItem(data: $data) { id status }
    }
  `, { data })
  if (response.success) revalidatePath(DELIVERY_PATH)
  return response
}
