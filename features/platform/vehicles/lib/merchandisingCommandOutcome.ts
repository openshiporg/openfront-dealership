export type MerchandisingRevisionRef = { id: string; status: string; updatedAt: string } | null

export type MerchandisingCommandAttempt =
  | { kind: 'submit'; stockId: string; reason: string; idempotencyKey: string }
  | { kind: 'approve'; stockId: string; versionId: string; decision: 'approved'; reason: string; expectedUpdatedAt: string; idempotencyKey: string }

export type MerchandisingCommandResult = {
  id: string
  stockId: string
  merchandisingStatus: 'draft' | 'submitted' | 'approved' | 'rejected'
  reused: boolean
}

export function createMerchandisingCommandAttempt(
  stockId: string,
  latestRevision: MerchandisingRevisionRef,
  createUuid: () => string
): MerchandisingCommandAttempt {
  if (latestRevision?.status === 'submitted') {
    return {
      kind: 'approve',
      stockId,
      versionId: latestRevision.id,
      decision: 'approved',
      reason: 'Approved from inventory operations desk',
      expectedUpdatedAt: latestRevision.updatedAt,
      idempotencyKey: `merch-approve:${latestRevision.id}`,
    }
  }

  return {
    kind: 'submit',
    stockId,
    reason: 'Submitted from inventory operations desk',
    idempotencyKey: `merch-submit:${stockId}:${createUuid()}`,
  }
}

export function resolveMerchandisingCommandAttempt(
  pending: MerchandisingCommandAttempt | null,
  createAttempt: () => MerchandisingCommandAttempt | null
): MerchandisingCommandAttempt | null {
  return pending ?? createAttempt()
}

export function normalizeMerchandisingCommandResult(value: unknown, attempt: MerchandisingCommandAttempt): MerchandisingCommandResult | null {
  if (!value || typeof value !== 'object') return null
  const result = value as Record<string, unknown>
  const { id, stockId, merchandisingStatus, reused } = result
  if (typeof id !== 'string' || !id.trim()) return null
  if (stockId !== attempt.stockId) return null
  if (!['draft', 'submitted', 'approved', 'rejected'].includes(String(merchandisingStatus))) return null
  if (typeof reused !== 'boolean') return null
  if (attempt.kind === 'approve' && id !== attempt.versionId) return null

  return {
    id,
    stockId: String(stockId),
    merchandisingStatus: merchandisingStatus as MerchandisingCommandResult['merchandisingStatus'],
    reused,
  }
}

export function resolveMerchandisingCommandResponse(success: boolean, value: unknown, attempt: MerchandisingCommandAttempt) {
  return success ? normalizeMerchandisingCommandResult(value, attempt) : null
}

export function merchandisingCommandResultMessage(attempt: MerchandisingCommandAttempt, result: MerchandisingCommandResult) {
  const expectedStatus = attempt.kind === 'approve' ? 'approved' : 'submitted'

  if (result.merchandisingStatus === expectedStatus) {
    return attempt.kind === 'approve' ? 'Listing approved.' : 'Listing submitted for approval.'
  }

  return `Listing status is ${result.merchandisingStatus}. Refresh and review before continuing.`
}

export const UNCONFIRMED_MERCHANDISING_COMMAND_MESSAGE = 'We couldn’t confirm the listing change. Retry to finish.'
