export function financingIdempotencyKey(value: unknown, prefix: string) {
  const provided = String(value || '').trim()
  if (!provided) return `${prefix}_${crypto.randomUUID()}`
  if (provided.length < 16 || provided.length > 200 || !/^[A-Za-z0-9._:-]+$/.test(provided)) {
    throw new Error('Idempotency key must be 16-200 URL-safe characters')
  }
  return provided
}

export function financingReference() {
  return `FIN-${crypto.randomUUID().replaceAll('-', '').slice(0, 16).toUpperCase()}`
}

export function dollarsToCents(value: unknown, label: string, required = false) {
  const amount = Number(value || 0)
  if (!Number.isFinite(amount) || amount < 0 || (required && amount <= 0)) {
    throw new Error(`${label} must be a valid non-negative amount`)
  }
  return Math.round(amount * 100)
}
