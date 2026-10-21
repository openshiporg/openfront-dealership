import { assertSessionRooftopPermission } from '../tenantRecords'

// Adapt the existing dealFinanceEvidence authority/root-lock pattern. All labor
// writers and terminal service readers share this lock; no provider I/O here.
export async function lockServiceOrder(tx: any, id: string) {
  const locked = await tx.prisma.$queryRaw`SELECT "id" FROM "ServiceOrder" WHERE "id" = ${id} FOR UPDATE`
  if (!Array.isArray(locked)) throw new Error('Service lock is unavailable')
}

export async function currentServiceOrderAuthority(tx: any, session: any, id: string) {
  if (!session?.itemId || session.listKey !== 'User') throw new Error('Authentication required')
  const user = await tx.prisma.user.findUnique({ where: { id: session.itemId }, include: {
    role: true,
    dealerGroupMemberships: { include: { role: true, dealerGroup: { select: { id: true } } } },
    rooftopMemberships: { include: { role: true, rooftop: { include: { dealerGroup: { select: { id: true } } } } } },
  } })
  if (!user || user.id !== session.itemId) throw new Error('Current actor is unavailable')
  const context = tx.withSession({ ...session, data: { ...session.data, ...user } })
  const visible = await context.query.ServiceOrder.findOne({ where: { id }, query: 'id rooftop { id }' })
  if (!visible?.rooftop?.id) throw new Error('Service order not found or not accessible')
  await assertSessionRooftopPermission(context, visible.rooftop.id, 'canManageService')
  return { context, rooftopId: visible.rooftop.id }
}

export async function serviceSettlementEvidence(tx: any, id: string, rooftopId: string, totalCents: number) {
  if (!Number.isSafeInteger(totalCents) || totalCents < 0) throw new Error('Invalid service invoice total')
  // Capture/refund writers update these same rows. Retain net settlement IDs,
  // never invent a provider payment from an operator status click.
  await tx.prisma.$queryRaw`SELECT "id" FROM "PaymentTransaction" WHERE "serviceOrder" = ${id} ORDER BY "id" FOR UPDATE`
  const payments = await tx.prisma.paymentTransaction.findMany({ where: { serviceOrderId: id, rooftopId, sourceType: 'service', status: { in: ['captured', 'partially-refunded'] } }, select: { id: true, capturedCents: true, refundedCents: true, providerTransactionId: true } })
  const verified = payments.filter((payment: any) => payment.providerTransactionId && Number.isSafeInteger(payment.capturedCents) && Number.isSafeInteger(payment.refundedCents) && payment.refundedCents >= 0 && payment.capturedCents >= payment.refundedCents)
  const netCents = verified.reduce((sum: number, payment: any) => sum + payment.capturedCents - payment.refundedCents, 0)
  if (netCents < totalCents) throw new Error('Verified net payment settlement is required before marking this invoice paid')
  return { totalCents, netCents, zeroBalance: totalCents === 0, paymentIds: verified.map((payment: any) => payment.id) }
}
