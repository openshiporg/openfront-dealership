'use server'

import { revalidatePath } from 'next/cache'

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { operatorCommandRequest } from '@/features/platform/lib/operatorCommandClient'

import type { FinanceWorkspace } from '../lib/types'

const FINANCE_PATH = '/dashboard/platform/finance'

// Commands return the server's own rejection message ("Record product quotes first") when it refuses.
async function mutate<T = unknown>(query: string, variables: Record<string, unknown>) {
  const response = await operatorCommandRequest<T>(query, variables)
  if (response.success) revalidatePath(FINANCE_PATH)
  return response
}

export async function getFinanceWorkspace() {
  return keystoneClient<{ financeWorkspace: FinanceWorkspace }>(`
    query FinanceWorkspace {
      financeWorkspace(limit: 50) {
        deals { id worksheetVersion financeEvidence rooftop { id name } vehiclePrice tradeInValue downPayment financingAmount monthlyPayment loanTerm apr taxAmount status totalPrice profit createdAt updatedAt salesperson { id name } lead { id firstName lastName } vehicle { id year make model stockNumber vin purchasePrice } approvals { id decision approvalDate notes approver { name } } }
        applications { id reference status applicantName requestedAmountCents submittedAt vehicle { id year make model stockNumber priceCents } lead { id rooftop { id } firstName lastName email phone status createdAt interestedVehicle { id year make model stockNumber priceCents } tasks { id title dueDate completed priority } } submissions { id providerKey providerMode externalRequestSent status externalReference queuedAt } decisions { id providerKey decision approvedAmountCents aprBasisPoints termMonths monthlyPaymentCents reasonCodes decidedAt } }
        products { id rooftop { id } code name category providerKey retailPriceCents costCents }
        productQuotes { id deal { id } product { id code } status }
        productCancellations { id deal { id } productCode status }
        menus { id deal { id } version status optionsSnapshot }
        complianceChecks { id deal { id } checkType status }
        contractPackages { id deal { id } status documentChecklist }
        fundingCases { id deal { id } status exceptions immutableEvidence updatedAt }
      }
    }
  `, {}, { cache: 'no-store' })
}

export async function transitionDeal(input: { id: string; toStatus: string; notes?: string; idempotencyKey: string }) {
  return mutate(`
    mutation TransitionDeal($id: ID!, $toStatus: String!, $notes: String, $idempotencyKey: String!) {
      transitionDeal(id: $id, toStatus: $toStatus, notes: $notes, idempotencyKey: $idempotencyKey) { id status saleDate }
    }
  `, input)
}

export async function openFinanceFollowUp(data: { leadId: string; reason: string; idempotencyKey: string }) {
  return mutate(`
    mutation OpenFinanceFollowUp($data: OpenFinanceFollowUpInput!) {
      openFinanceFollowUp(data: $data) { id status reused }
    }
  `, { data })
}

export async function queueFinancingApplication(input: { applicationId: string; providerKey: string; idempotencyKey: string }) {
  return mutate(`
    mutation QueueFinancingApplication($applicationId: ID!, $providerKey: String!, $idempotencyKey: String!) {
      queueFinancingApplication(applicationId: $applicationId, providerKey: $providerKey, idempotencyKey: $idempotencyKey) { id status responseSummary }
    }
  `, input)
}

export async function presentFinanceMenu(data: { dealId: string; expectedUpdatedAt: string | null; productCodes: string[]; idempotencyKey: string }) {
  return mutate(`
    mutation PresentFinanceMenu($data: PresentFinanceMenuInput!) {
      presentFinanceMenu(data: $data) { id status version }
    }
  `, { data })
}

export async function manageFinanceContractPackage(data: {
  dealId: string
  expectedUpdatedAt: string | null
  action: string
  providerKey?: string
  requiredDocuments?: string[]
  documentChecklist?: Array<{ code: string; status: string }>
  providerStatus?: string
  envelopeReference?: string
  evidenceSource?: string
  evidenceReference?: string
  idempotencyKey: string
}) {
  return mutate(`
    mutation ManageFinanceContract($data: ManageFinanceContractInput!) {
      manageFinanceContractPackage(data: $data) { id status }
    }
  `, { data })
}

export async function recordLenderDecision(data: {
  applicationId: string
  submissionId?: string
  providerKey: string
  idempotencyKey: string
  externalReference?: string
  decision: string
  approvedAmountCents: number | null
  aprBasisPoints: number | null
  termMonths: number | null
  monthlyPaymentCents: number | null
  reasonCodes: string[]
}) {
  return mutate(`
    mutation RecordLenderDecision($data: RecordLenderDecisionInput!) {
      recordLenderDecision(data: $data) { id decision externalReference }
    }
  `, { data })
}

export async function configureFinanceProduct(data: {
  rooftopId: string
  code: string
  name: string
  category: string
  providerKey: string
  retailPriceCents: number
  costCents: number
  active?: boolean
  idempotencyKey: string
}) {
  return mutate(`
    mutation ConfigureFinanceProduct($data: ConfigureFinanceProductInput!) {
      configureFinanceProduct(data: $data) { id code }
    }
  `, { data })
}

export async function recordFinanceProductQuote(data: {
  dealId: string
  productId: string
  status: string
  retailPriceCents?: number | null
  costCents?: number | null
  evidenceReference?: string
  idempotencyKey: string
}) {
  return mutate(`
    mutation RecordFinanceProductQuote($data: RecordFinanceProductQuoteInput!) {
      recordFinanceProductQuote(data: $data) { id status }
    }
  `, { data })
}

export async function decideFinanceMenu(data: {
  dealId: string
  expectedUpdatedAt: string | null
  menuId: string
  selectedProductCodes: string[]
  declinedProductCodes: string[]
  disclosureAcknowledgment: string
  idempotencyKey: string
}) {
  return mutate(`
    mutation DecideFinanceMenu($data: DecideFinanceMenuInput!) {
      decideFinanceMenu(data: $data) { id status }
    }
  `, { data })
}

export async function recordFinanceComplianceCheck(data: {
  dealId: string
  expectedUpdatedAt: string | null
  checkType: string
  providerKey: string
  status: string
  resultCode?: string | null
  evidenceReference?: string
  idempotencyKey: string
}) {
  return mutate(`
    mutation RecordFinanceCompliance($data: RecordFinanceComplianceInput!) {
      recordFinanceComplianceCheck(data: $data) { id status }
    }
  `, { data })
}

export async function reviewFinancePrerequisites(data: {
  dealId: string
  worksheetVersion: number
  expectedUpdatedAt: string | null
  expectedPrerequisiteDigest: string
  providerKey: string
  reviewReference: string
  policyReference: string
  policyVersion: string
  reviewerAuthorityReference: string
  idempotencyKey: string
}) {
  return mutate(`
    mutation ReviewFinancePrerequisites($data: ReviewFinancePrerequisitesInput!) {
      reviewFinancePrerequisites(data: $data) { id status reused updatedAt }
    }
  `, { data })
}

export async function manageFinanceFundingCase(data: {
  dealId: string
  worksheetVersion: number
  expectedUpdatedAt: string | null
  expectedFundingUpdatedAt: string | null
  status: string
  checklist: Array<{ code: string; status: string }>
  exceptions: Array<{ code: string; status: string; notes: string }>
  fundingReference?: string
  paymentAmountCents?: number
  idempotencyKey: string
}) {
  return mutate(`
    mutation ManageFinanceFunding($data: ManageFinanceFundingInput!) {
      manageFinanceFundingCase(data: $data) { id status }
    }
  `, { data })
}

export async function recordFinanceProductCancellation(data: {
  dealId: string
  menuId: string
  productCode: string
  status: string
  reason: string
  refundCents: number
  evidenceReference?: string
  idempotencyKey: string
}) {
  return mutate(`
    mutation RecordFinanceProductCancellation($data: RecordFinanceProductCancellationInput!) {
      recordFinanceProductCancellation(data: $data) { id status }
    }
  `, { data })
}
