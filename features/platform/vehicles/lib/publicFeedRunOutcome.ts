export type PublicFeedRunAttempt = {
  stockIds: string[]
  idempotencyKey: string
}

export type PublicFeedRunResult = {
  id: string
  status: 'succeeded' | 'partial' | 'failed'
  attemptedCount: number
  failedCount: number
  reused: boolean
}

export function resolvePublicFeedRunAttempt(
  pending: PublicFeedRunAttempt | null,
  candidateStockIds: readonly string[],
  createIdempotencyKey: () => string
): PublicFeedRunAttempt | null {
  if (pending) return pending
  if (!candidateStockIds.length) return null
  return { stockIds: [...candidateStockIds], idempotencyKey: createIdempotencyKey() }
}

export function normalizePublicFeedRunResult(value: unknown, expectedAttemptedCount: number): PublicFeedRunResult | null {
  if (!value || typeof value !== 'object') return null
  const result = value as Record<string, unknown>
  const { id, status, attemptedCount, failedCount, reused } = result
  if (typeof id !== 'string' || !id.trim()) return null
  if (!['succeeded', 'partial', 'failed'].includes(String(status))) return null
  if (!Number.isSafeInteger(attemptedCount) || attemptedCount !== expectedAttemptedCount) return null
  if (!Number.isSafeInteger(failedCount) || Number(failedCount) < 0 || Number(failedCount) > Number(attemptedCount)) return null
  if (typeof reused !== 'boolean') return null

  const expectedStatus = failedCount === 0 ? 'succeeded' : failedCount === attemptedCount ? 'failed' : 'partial'
  if (status !== expectedStatus) return null

  return { id, status: status as PublicFeedRunResult['status'], attemptedCount: Number(attemptedCount), failedCount: Number(failedCount), reused }
}

export function publicFeedRunResultMessage(result: PublicFeedRunResult) {
  const prefix = result.reused ? 'Feed already published' : 'Feed published'
  return `${prefix}: ${result.attemptedCount} vehicles, ${result.failedCount} failed.`
}

export const UNCONFIRMED_PUBLIC_FEED_RUN_MESSAGE = 'We couldn’t confirm the feed was published. Retry to finish.'
