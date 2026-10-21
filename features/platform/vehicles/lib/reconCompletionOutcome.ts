export type ReconCompletionAttempt = {
  workItemId: string
  stockId: string
  toStatus: 'completed'
  actualCostCents: number
  expectedUpdatedAt: string
  reason: string
  idempotencyKey: string
}

export type ReconCompletionResult = {
  id: string
  stockId: string
  status: 'not-started' | 'in-progress' | 'completed'
  reused: boolean
}

export function createReconCompletionAttempt(
  workItemId: string,
  stockId: string,
  expectedUpdatedAt: string,
  actualCostCents: number,
  reason: string,
  idempotencyKey: string
): ReconCompletionAttempt {
  return { workItemId, stockId, toStatus: 'completed', expectedUpdatedAt, actualCostCents, reason, idempotencyKey }
}

export function resolveReconCompletionAttempt(
  pending: ReconCompletionAttempt | null,
  createAttempt: () => ReconCompletionAttempt
): ReconCompletionAttempt {
  return pending ?? createAttempt()
}

export function normalizeReconCompletionResult(
  success: boolean,
  value: unknown,
  attempt: ReconCompletionAttempt
): ReconCompletionResult | null {
  if (!success || !value || typeof value !== 'object') return null
  const result = value as Record<string, unknown>
  const { id, stockId, status, reused } = result
  if (typeof id !== 'string' || !id.trim() || id !== attempt.workItemId) return null
  if (typeof stockId !== 'string' || stockId !== attempt.stockId) return null
  if (!['not-started', 'in-progress', 'completed'].includes(String(status))) return null
  if (typeof reused !== 'boolean') return null
  return { id, stockId, status: status as ReconCompletionResult['status'], reused }
}

export function reconCompletionResultMessage(result: ReconCompletionResult) {
  return result.status === 'completed' ? 'Recon completed.' : `Recon status is ${result.status}.`
}

export const UNCONFIRMED_RECON_COMPLETION_MESSAGE = 'We couldn’t confirm the recon was completed. Retry with the same amount to finish.'
