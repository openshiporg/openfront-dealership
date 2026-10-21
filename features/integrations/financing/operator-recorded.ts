import type { FinancingProviderSubmissionResult } from './index'

export const key = 'operator-recorded'
export const label = 'Operator-recorded external lender review'

export async function submit(): Promise<FinancingProviderSubmissionResult> {
  return {
    status: 'queued',
    externalReference: null,
    responseSummary: {
      mode: 'operator-recorded',
      externalRequestSent: false,
    },
  }
}

// Capability discovery is not provider activation or a legal-validity verdict.
export function prerequisiteCapability(providerKey: string) {
  return { providerKey, configurationVersion: 1, mode: 'operator-recorded' as const,
    humanReviewRequired: true, externalRequestSent: false as const,
    documentSignatureVerified: false as const, legalPolicyVerified: false as const,
    fundingSettlementVerified: false as const }
}
