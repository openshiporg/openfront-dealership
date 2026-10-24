'use server'

import { revalidatePath } from 'next/cache'

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { ROOFTOP_STAFF_QUERY } from '@/features/platform/lib/rooftopStaffQuery'

import type { FixedOpsWorkspace } from '../lib/types'

const SERVICE_PATH = '/dashboard/platform/service'

async function mutate<T = unknown>(query: string, variables: Record<string, unknown>) {
  const response = await keystoneClient<T>(query, variables)
  if (response.success) revalidatePath(SERVICE_PATH)
  return response
}

export async function getFixedOpsWorkspace() {
  return keystoneClient<{ fixedOpsWorkspace: FixedOpsWorkspace }>(`
    query FixedOpsWorkspace {
      fixedOpsWorkspace(limit: 100) {
        serviceRooftops { id name }
        appointments { id rooftop { id } appointmentDate serviceType status customerVehicleDescription description estimatedDuration mileageIn advisorNotes lead { id firstName lastName email phone } assignedTech { id name } serviceOrder { id status grandTotalCents } }
        orders { id rooftop { id name } status concern cause correction payType authorizationEvidence authorizationStatus invoiceNumber laborOperations { id operationCode description status technician { id name } } lineItems { id itemType description partNumber quantity unitPriceCents priceCents } laborTotalCents partsTotalCents taxCents grandTotalCents completedAt updatedAt appointment { id appointmentDate serviceType customerVehicleDescription assignedTech { name } } }
        parts { id partNumber description quantity minimumQuantity priceCents supplier }
      }
    }
  `, {}, { cache: 'no-store' })
}

export async function getRooftopStaff(rooftopId: string) {
  return keystoneClient<{ users: Array<{ id: string; name: string }> }>(ROOFTOP_STAFF_QUERY, { rooftopId })
}

export async function transitionServiceAppointment(input: { id: string; toStatus: string; idempotencyKey: string }) {
  return mutate(`
    mutation TransitionServiceAppointment($id: ID!, $toStatus: String!, $idempotencyKey: String!) {
      transitionServiceAppointment(id: $id, toStatus: $toStatus, idempotencyKey: $idempotencyKey) { id status }
    }
  `, input)
}

export async function transitionServiceOrder(input: { id: string; toStatus: string; idempotencyKey: string }) {
  return mutate(`
    mutation TransitionServiceOrder($id: ID!, $toStatus: String!, $idempotencyKey: String!) {
      transitionServiceOrder(id: $id, toStatus: $toStatus, idempotencyKey: $idempotencyKey) { id status completedAt lockedAt settledAt }
    }
  `, input)
}

export async function openServiceOrder(data: {
  appointmentId: string
  idempotencyKey: string
  diagnosis: string
  laborTotalCents: number
  partsTotalCents: number
  taxCents: number
  grandTotalCents: number
}) {
  return mutate(`
    mutation OpenServiceOrder($data: OpenServiceOrderInput!) {
      openServiceOrder(data: $data) { id }
    }
  `, { data })
}

export async function recordServiceOrderEvidence(data: Record<string, unknown>) {
  return mutate(`
    mutation RecordServiceOrderEvidence($data: RecordServiceOrderEvidenceInput!) {
      recordServiceOrderEvidence(data: $data) { id }
    }
  `, { data })
}

export async function addServiceOrderLineItem(data: Record<string, unknown>) {
  return mutate(`
    mutation AddServiceOrderLineItem($data: AddServiceOrderLineInput!) {
      addServiceOrderLineItem(data: $data) { id }
    }
  `, { data })
}

export async function manageLaborOperation(data: Record<string, unknown>) {
  return mutate(`
    mutation ManageLaborOperation($data: ManageLaborOperationInput!) {
      manageLaborOperation(data: $data) { id }
    }
  `, { data })
}

export async function configurePart(data: Record<string, unknown>) {
  return mutate(`
    mutation ConfigurePart($data: ConfigurePartInput!) {
      configurePart(data: $data) { id }
    }
  `, { data })
}

export async function recordPartsMovement(data: Record<string, unknown>) {
  return mutate(`
    mutation RecordPartsMovement($data: RecordPartsMovementInput!) {
      recordPartsMovement(data: $data) { id }
    }
  `, { data })
}

type BookingPayload = { ok: boolean; errorCode?: string | null; errorMessage?: string | null; serviceAppointmentId?: string | null }

/** Books a phone or walk-in customer through the same command the storefront uses. */
export async function bookServiceAppointment(data: {
  customerName: string
  customerEmail: string
  customerPhone: string
  appointmentDate: string
  appointmentTime: string
  serviceType: string
  vehicleYear: number
  vehicleMake: string
  vehicleModel: string
  description?: string
  idempotencyKey: string
}) {
  const response = await keystoneClient<{ submitServiceBooking: BookingPayload }>(`
    mutation BookServiceAppointment($data: SubmitServiceBookingInput!) {
      submitServiceBooking(data: $data) { ok errorCode errorMessage serviceAppointmentId }
    }
  `, { data })
  if (!response.success) return response
  const payload = response.data.submitServiceBooking
  if (!payload?.ok) return { success: false as const, error: payload?.errorMessage || 'Unable to book appointment' }
  revalidatePath(SERVICE_PATH)
  return { success: true as const, data: payload }
}
