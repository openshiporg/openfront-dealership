import * as operatorRecorded from './operator-recorded'

export type FinancingProviderSubmission = {
  applicationReference: string
  idempotencyKey: string
  requestedAmountCents: number
  vehicleVin?: string | null
}

export type FinancingProviderSubmissionResult = {
  status: 'queued'
  externalReference: null
  responseSummary: {
    mode: 'operator-recorded'
    externalRequestSent: false
  }
}

export type FinancingProviderAdapter = {
  key: string
  label: string
  submit(input: FinancingProviderSubmission): Promise<FinancingProviderSubmissionResult>
}

export const financingProviderAdapters = {
  'operator-recorded': () => import('./operator-recorded'),
}

const FINANCING_PROVIDER_ADAPTERS: Readonly<Record<string, FinancingProviderAdapter>> = Object.freeze({
  [operatorRecorded.key]: Object.freeze({
    key: operatorRecorded.key,
    label: operatorRecorded.label,
    submit: operatorRecorded.submit,
  }),
})

export function resolveFinancingProviderAdapter(providerKey: string) {
  const adapter = FINANCING_PROVIDER_ADAPTERS[providerKey]
  if (!adapter) throw new Error('Unsupported financing provider')
  return adapter
}

// Only the operator-recorded adapter is available for prerequisite review.
export function financingPrerequisiteCapability(providerKey: string) {
  resolveFinancingProviderAdapter(providerKey)
  if (providerKey !== operatorRecorded.key) throw new Error('Configured provider prerequisite verification is unavailable')
  return operatorRecorded.prerequisiteCapability(providerKey)
}

export function financingProviderKeys() {
  return Object.keys(FINANCING_PROVIDER_ADAPTERS)
}
