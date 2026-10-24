'use server'

import { revalidatePath } from 'next/cache'

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { operatorCommandRequest } from '@/features/platform/lib/operatorCommandClient'

import type { ApplicationDetail } from '../lib/applicationTypes'

export async function getFinancingApplication(id: string) {
  return keystoneClient<{ financingApplication: ApplicationDetail | null }>(`
    query FinancingApplicationDetail($id: ID!) {
      financingApplication(where: { id: $id }) {
        id reference status applicantName applicantEmail applicantPhone employmentStatus annualIncomeCents selfReportedCreditTier
        requestedAmountCents plannedMonthlyPaymentCents plannedDownPaymentCents tradeInValueCents aprBasisPoints loanTermMonths
        consentAt submittedAt lockedAt
        rooftop { id name }
        lead {
          id firstName lastName status
          tasks(orderBy: [{ dueDate: desc }], take: 20) { id title dueDate completed priority }
          deals(orderBy: [{ updatedAt: desc }], take: 10) { id status updatedAt }
        }
        vehicle { id year make model trim stockNumber vin priceCents }
        submissions(orderBy: [{ queuedAt: desc }]) { id providerKey status externalReference errorCode queuedAt submittedAt }
        decisions(orderBy: [{ decidedAt: desc }]) {
          id providerKey decision externalReference approvedAmountCents aprBasisPoints termMonths monthlyPaymentCents reasonCodes decidedAt
          submission { id } recordedBy { id name }
        }
      }
    }
  `, { id }, { cache: 'no-store' })
}

async function mutate<T>(id: string, query: string, variables: Record<string, unknown>) {
  const response = await operatorCommandRequest<T>(query, variables)
  if (response.success) {
    revalidatePath(`/dashboard/platform/finance/applications/${id}`)
    revalidatePath('/dashboard/platform/finance')
  }
  return response
}

export async function queueApplicationToLender(input: { applicationId: string; providerKey: string; idempotencyKey: string }) {
  return mutate(input.applicationId, `
    mutation QueueApplicationToLender($applicationId: ID!, $providerKey: String!, $idempotencyKey: String!) {
      queueFinancingApplication(applicationId: $applicationId, providerKey: $providerKey, idempotencyKey: $idempotencyKey) { id status }
    }
  `, input)
}

export async function recordSubmissionStatus(applicationId: string, data: { submissionId: string; status: 'submitted' | 'failed'; externalReference?: string; errorCode?: string; idempotencyKey: string }) {
  return mutate(applicationId, `
    mutation RecordLenderSubmissionStatus($data: RecordLenderSubmissionStatusInput!) {
      recordLenderSubmissionStatus(data: $data) { id status }
    }
  `, { data })
}

export async function recordApplicationDecision(data: {
  applicationId: string
  submissionId?: string
  providerKey: string
  idempotencyKey: string
  externalReference: string
  decision: string
  approvedAmountCents: number | null
  aprBasisPoints: number | null
  termMonths: number | null
  monthlyPaymentCents: number | null
  reasonCodes: string[]
}) {
  return mutate(data.applicationId, `
    mutation RecordApplicationDecision($data: RecordLenderDecisionInput!) {
      recordLenderDecision(data: $data) { id decision }
    }
  `, { data })
}

export async function openApplicationFollowUp(applicationId: string, data: { leadId: string; reason: string; idempotencyKey: string }) {
  return mutate(applicationId, `
    mutation OpenApplicationFollowUp($data: OpenFinanceFollowUpInput!) {
      openFinanceFollowUp(data: $data) { id status reused }
    }
  `, { data })
}
