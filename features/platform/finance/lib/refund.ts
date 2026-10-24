/** Whole months between two instants, counting a started month as used. */
export function monthsBetween(from: string | Date, to: string | Date) {
  const start = new Date(from)
  const end = new Date(to)
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) return 0
  let months = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + (end.getUTCMonth() - start.getUTCMonth())
  if (end.getUTCDate() > start.getUTCDate()) months += 1
  return Math.max(0, months)
}

export type RefundBasis = {
  method: 'pro-rata-months' | 'flat'
  retailPriceCents: number
  termMonths: number
  monthsUsed: number
  cancellationFeeCents: number
}

/**
 * Pro-rata refund: the unused share of the retail price, less the cancellation fee, never below zero.
 * Without a term the product refunds flat (full price less the fee).
 */
export function calculateRefund(basis: RefundBasis) {
  const { retailPriceCents, termMonths, monthsUsed, cancellationFeeCents } = basis
  const unusedMonths = basis.method === 'pro-rata-months' && termMonths > 0 ? Math.max(0, termMonths - Math.min(monthsUsed, termMonths)) : null
  const unusedCents = unusedMonths == null ? retailPriceCents : Math.round((retailPriceCents * unusedMonths) / termMonths)
  return { unusedMonths, unusedCents, refundCents: Math.max(0, unusedCents - cancellationFeeCents) }
}
