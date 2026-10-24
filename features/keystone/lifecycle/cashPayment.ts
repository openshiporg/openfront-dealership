import { calculateDealPrice } from './dealPricing'
import { FORM_8300_THRESHOLD_CENTS } from './paymentMethods'

type PaymentStore = { prisma: { paymentTransaction: { findMany(input: {
  where: { dealId: string; rooftopId: string; status: { in: string[] } }
  select: { capturedCents: true; refundedCents: true }
  take: number
}): Promise<Array<{ capturedCents: number | null; refundedCents: number | null }>> } } }

/** Net money already taken on a deal: captured minus refunded, across every recorded payment. */
export async function dealReceivedCents(tx: PaymentStore, deal: { id: string; rooftopId: string }) {
  const payments = await tx.prisma.paymentTransaction.findMany({
    where: { dealId: deal.id, rooftopId: deal.rooftopId, status: { in: ['captured', 'partially-refunded', 'refunded'] } },
    select: { capturedCents: true, refundedCents: true },
    take: 200,
  })
  return payments.reduce((sum, payment) => sum + Number(payment.capturedCents || 0) - Number(payment.refundedCents || 0), 0)
}

/**
 * What a cash buyer still owes. Server math: a cash structure finances nothing, so the whole total
 * (down payment included) is due; recorded payments reduce it.
 */
export async function cashPaymentState(tx: PaymentStore, deal: { id: string; rooftopId: string; structureType?: unknown } & Record<string, unknown>) {
  if (deal.structureType !== 'cash') return null
  let amountDueCents: number
  try {
    amountDueCents = calculateDealPrice(deal as Parameters<typeof calculateDealPrice>[0]).cashPayableCents
  } catch {
    return null
  }
  const receivedCents = await dealReceivedCents(tx, deal)
  const payments = await dealPaymentLedger(tx as unknown as LedgerStore, deal)
  const cashReceivedCents = payments.filter(payment => payment.method === 'cash').reduce((sum, payment) => sum + payment.netCents, 0)
  return { amountDueCents, receivedCents, remainingCents: amountDueCents - receivedCents, payments, cashReceivedCents,
    form8300Required: cashReceivedCents > FORM_8300_THRESHOLD_CENTS }
}

type LedgerStore = { prisma: { paymentTransaction: { findMany(input: unknown): Promise<Array<{
  id: string; capturedCents: number | null; refundedCents: number | null; paymentMethod: string | null
  providerKey: string; providerTransactionId: string | null; status: string; createdAt: Date
}>> } } }

/** Money taken on a deal, oldest first: what the finance desk lists as payments received. */
export async function dealPaymentLedger(tx: LedgerStore, deal: { id: string; rooftopId: string }) {
  const rows = await tx.prisma.paymentTransaction.findMany({
    where: { dealId: deal.id, rooftopId: deal.rooftopId, status: { in: ['captured', 'partially-refunded', 'refunded'] } },
    select: { id: true, capturedCents: true, refundedCents: true, paymentMethod: true, providerKey: true, providerTransactionId: true, status: true, createdAt: true },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: 200,
  })
  if (!Array.isArray(rows)) return []
  return rows.map(row => ({
    id: row.id,
    netCents: Number(row.capturedCents || 0) - Number(row.refundedCents || 0),
    capturedCents: Number(row.capturedCents || 0),
    refundedCents: Number(row.refundedCents || 0),
    method: row.paymentMethod || '',
    providerKey: row.providerKey,
    reference: row.providerTransactionId || null,
    status: row.status,
    receivedAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
  }))
}

export function formatUsdCents(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}
