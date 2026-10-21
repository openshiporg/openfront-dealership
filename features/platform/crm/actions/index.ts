'use server'

import { revalidatePath } from 'next/cache'

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'

export type CrmLeadSummary = {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  source: string
  status: string
  temperature: string | null
  createdAt: string
  firstResponseDueAt: string | null
  firstResponseAt: string | null
  lastContact: string | null
  assignedSalesperson: { id: string; name: string } | null
  interestedVehicle: { id: string; year: number; make: string; model: string } | null
}

export type LeadDetail = {
  id: string
  rooftop: { id: string }
  customer: {
    id: string
    updatedAt: string
    emailConsent: boolean | null
    smsConsent: boolean | null
    phoneConsent: boolean | null
    emailSuppressed: boolean | null
    smsSuppressed: boolean | null
    phoneSuppressed: boolean | null
    preferredChannel: string | null
    household: { id: string; displayName: string | null } | null
  } | null
  firstName: string | null
  lastName: string | null
  email: string | null
  phone: string | null
  source: string | null
  budgetRange: string | null
  tradeInVehicle: string | null
  timeframe: string | null
  status: string | null
  campaignKey: string | null
  cadenceKey: string | null
  cadenceStatus: string | null
  cadenceStep: string | null
  cadenceDueAt: string | null
  lostReasonCode: string | null
  lostReason: string | null
  notes: string | null
  createdAt: string | null
  updatedAt: string
  assignedAt: string | null
  firstResponseDueAt: string | null
  firstResponseAt: string | null
  lastContact: string | null
  assignedSalesperson: { id: string; name: string | null; email: string | null } | null
  interestedVehicle: { id: string; year: number | null; make: string | null; model: string | null; stockNumber: string | null; price: number | null } | null
  interactions: { id: string; interactionType: string | null; date: string | null; outcome: string | null; notes: string | null; followUpDate: string | null; performedBy: { name: string | null } | null }[]
  tasks: { id: string; title: string | null; description: string | null; dueDate: string | null; priority: string | null; completed: boolean | null }[]
  testDrives: { id: string; scheduledTime: string | null; completed: boolean | null; vehicle: { year: number | null; make: string | null; model: string | null } | null }[]
  deals: { id: string; status: string | null; vehiclePrice: number | null; monthlyPayment: number | null; vehicle: { year: number | null; make: string | null; model: string | null } | null }[]
  salesVisits: { id: string; kind: string | null; status: string | null; scheduledAt: string | null; updatedAt: string; manager: { name: string | null } | null }[]
}

const CRM_PATH = '/dashboard/platform/crm'

function revalidateLead(leadId?: string) {
  revalidatePath(CRM_PATH)
  if (leadId) revalidatePath(`${CRM_PATH}/${leadId}`)
}

export async function getCrmLeads() {
  return keystoneClient<{ crmWorkspace: { leads: CrmLeadSummary[] } }>(`
    query CRMWorkspace {
      crmWorkspace(limit: 100) {
        leads {
          id firstName lastName email phone source status temperature createdAt
          firstResponseDueAt firstResponseAt lastContact
          assignedSalesperson { id name }
          interestedVehicle { id year make model }
        }
      }
    }
  `, {}, { cache: 'no-store' })
}

export async function getLead(id: string) {
  return keystoneClient<{ lead: LeadDetail | null }>(`
    query LeadDetail($id: ID!) {
      lead(where: { id: $id }) {
        id
        rooftop { id }
        customer { id updatedAt emailConsent smsConsent phoneConsent emailSuppressed smsSuppressed phoneSuppressed preferredChannel household { id displayName } }
        firstName
        lastName
        email
        phone
        source
        budgetRange
        tradeInVehicle
        timeframe
        status
        campaignKey
        cadenceKey
        cadenceStatus
        cadenceStep
        cadenceDueAt
        lostReasonCode
        lostReason
        notes
        createdAt
        updatedAt
        assignedAt
        firstResponseDueAt
        firstResponseAt
        lastContact
        assignedSalesperson { id name email }
        interestedVehicle { id year make model stockNumber price }
        interactions(orderBy: { date: desc }) { id interactionType date outcome notes followUpDate performedBy { name } }
        tasks(orderBy: { dueDate: asc }) { id title description dueDate priority completed }
        testDrives(orderBy: { scheduledTime: desc }) { id scheduledTime completed vehicle { year make model } }
        deals(orderBy: { createdAt: desc }) { id status vehiclePrice monthlyPayment vehicle { year make model } }
        salesVisits(orderBy: { createdAt: desc }) { id kind status scheduledAt updatedAt manager { name } }
      }
    }
  `, { id }, { cache: 'no-store' })
}

export async function getCustomerDuplicateCount(customerId: string) {
  const response = await keystoneClient<{ customerDuplicateCandidates: Array<{ id: string }> }>(`
    query CustomerDuplicates($customerId: ID!) {
      customerDuplicateCandidates(customerId: $customerId) { id }
    }
  `, { customerId }, { cache: 'no-store' })
  return response.success ? response.data.customerDuplicateCandidates.length : 0
}

export async function transitionLead(input: {
  id: string
  toStatus: string
  lostReasonCode?: string
  lostReasonDetails?: string
  idempotencyKey: string
}) {
  const response = await keystoneClient(`
    mutation TransitionLead($id: ID!, $toStatus: String!, $lostReasonCode: String, $lostReasonDetails: String, $idempotencyKey: String!) {
      transitionLead(id: $id, toStatus: $toStatus, lostReasonCode: $lostReasonCode, lostReasonDetails: $lostReasonDetails, idempotencyKey: $idempotencyKey) { id status }
    }
  `, input)
  if (response.success) revalidateLead(input.id)
  return response
}

export async function recordLeadInteraction(data: {
  leadId: string
  interactionType: string
  outcome?: string
  notes: string
  date?: string
  followUpDate?: string
  idempotencyKey: string
}) {
  const response = await keystoneClient(`
    mutation RecordLeadInteraction($data: RecordLeadInteractionInput!) {
      recordLeadInteraction(data: $data) { id leadId }
    }
  `, { data })
  if (response.success) revalidateLead(data.leadId)
  return response
}

export async function routeLead(data: { leadId: string; expectedUpdatedAt: string; idempotencyKey: string }) {
  const response = await keystoneClient(`
    mutation RouteLead($data: RouteLeadInput!) {
      routeLead(data: $data) { id status updatedAt reused }
    }
  `, { data })
  if (response.success) revalidateLead(data.leadId)
  return response
}

export async function createLeadTask(data: {
  leadId: string
  title: string
  description?: string
  priority?: string
  dueDate?: string
  communicationChannel?: string
  idempotencyKey: string
}) {
  const response = await keystoneClient(`
    mutation CreateLeadTask($data: CreateLeadTaskInput!) {
      createLeadTask(data: $data) { id }
    }
  `, { data })
  if (response.success) revalidateLead(data.leadId)
  return response
}

export async function updateCustomerCommunicationPreferences(leadId: string, data: {
  customerId: string
  expectedUpdatedAt: string
  emailConsent: boolean
  smsConsent: boolean
  phoneConsent: boolean
  emailSuppressed: boolean
  smsSuppressed: boolean
  phoneSuppressed: boolean
  preferredChannel: string
  source: string
  reason: string
  idempotencyKey: string
}) {
  const response = await keystoneClient(`
    mutation UpdatePreferences($data: UpdateCustomerCommunicationPreferencesInput!) {
      updateCustomerCommunicationPreferences(data: $data) { id status reused }
    }
  `, { data })
  if (response.success) revalidateLead(leadId)
  return response
}

export async function enrollLeadCadence(data: {
  leadId: string
  expectedUpdatedAt: string
  cadenceKey: string
  campaignKey: string
  idempotencyKey: string
}) {
  const response = await keystoneClient(`
    mutation EnrollCadence($data: EnrollLeadCadenceInput!) {
      enrollLeadCadence(data: $data) { id status reused }
    }
  `, { data })
  if (response.success) revalidateLead(data.leadId)
  return response
}

export async function advanceLeadCadence(data: { leadId: string; expectedUpdatedAt: string; idempotencyKey: string }) {
  const response = await keystoneClient(`
    mutation AdvanceCadence($data: AdvanceLeadCadenceInput!) {
      advanceLeadCadence(data: $data) { id status reused }
    }
  `, { data })
  if (response.success) revalidateLead(data.leadId)
  return response
}

export async function manageSalesVisit(leadId: string, data: {
  action: string
  visitId?: string
  leadId?: string
  kind?: string
  vehicleId?: string
  scheduledAt?: string
  expectedUpdatedAt?: string
  outcome?: string
  notes?: string
  idempotencyKey: string
}) {
  const response = await keystoneClient(`
    mutation ManageVisit($data: ManageSalesVisitInput!) {
      manageSalesVisit(data: $data) { id status reused }
    }
  `, { data })
  if (response.success) revalidateLead(leadId)
  return response
}

export async function completeLeadTask(leadId: string, taskId: string) {
  const response = await keystoneClient(`
    mutation CompleteTask($id: ID!, $idempotencyKey: String!) {
      completeTask(id: $id, idempotencyKey: $idempotencyKey) { id completed completedDate }
    }
  `, { id: taskId, idempotencyKey: `task-complete:${taskId}` })
  if (response.success) revalidateLead(leadId)
  return response
}
