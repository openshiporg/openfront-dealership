export type ReconStartAttempt = {
  workItemId: string
  stockId: string
  toStatus: 'in-progress'
  expectedUpdatedAt: string
  reason: string
  idempotencyKey: string
}

export type ReconStartResult = {
  id: string
  stockId: string
  status: 'not-started' | 'in-progress' | 'completed'
  reused: boolean
}

export function createReconStartAttempt(
  workItemId: string,
  stockId: string,
  expectedUpdatedAt: string,
  createUuid: () => string
): ReconStartAttempt {
  return {
    workItemId,
    stockId,
    toStatus: 'in-progress',
    expectedUpdatedAt,
    reason: 'Started from inventory operations desk',
    idempotencyKey: `recon-transition:${workItemId}:${createUuid()}`,
  }
}

export function resolveReconStartAttempt(
  pending: ReconStartAttempt | null,
  createAttempt: () => ReconStartAttempt | null
): ReconStartAttempt | null {
  return pending ?? createAttempt()
}

export function normalizeReconStartResult(success: boolean, value: unknown, attempt: ReconStartAttempt): ReconStartResult | null {
  if (!success || !value || typeof value !== 'object') return null
  const result = value as Record<string, unknown>
  const { id, stockId, status, reused } = result
  if (typeof id !== 'string' || !id.trim() || id !== attempt.workItemId) return null
  if (typeof stockId !== 'string' || stockId !== attempt.stockId) return null
  if (!['not-started', 'in-progress', 'completed'].includes(String(status))) return null
  if (typeof reused !== 'boolean') return null
  return { id, stockId, status: status as ReconStartResult['status'], reused }
}

export function reconStartResultMessage(result: ReconStartResult) {
  if (result.status === 'in-progress') {
    return 'Recon started.'
  }
  return `Recon status is ${result.status}. Refresh and review before continuing.`
}

export const UNCONFIRMED_RECON_START_MESSAGE = 'We couldn’t confirm the recon was started. Retry to finish.'
