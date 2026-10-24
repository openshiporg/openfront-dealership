import { calculateDealPrice } from './dealPricing'

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
  return { amountDueCents, receivedCents, remainingCents: amountDueCents - receivedCents }
}

export function formatUsdCents(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}
