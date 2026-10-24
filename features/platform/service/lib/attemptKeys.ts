/**
 * One idempotency key per attempt. A retry of the same attempt after an unconfirmed failure
 * (network, timeout) reuses its key so the server replays instead of applying twice; a confirmed
 * success or a server rejection retires it, so the next identical move (say a second
 * in-progress -> waiting-parts) gets a fresh key instead of silently replaying the first one.
 */
export function createAttemptKeys(prefix: string) {
  const pending = new Map<string, string>()
  return {
    key(scope: string) {
      const existing = pending.get(scope)
      if (existing) return existing
      const next = `${prefix}:${crypto.randomUUID()}`
      pending.set(scope, next)
      return next
    },
    settle(scope: string, response: { success: boolean; rejected?: boolean }) {
      if (response.success || response.rejected) pending.delete(scope)
    },
  }
}
