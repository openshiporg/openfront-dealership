import { permissions } from '../access'
import { cashPaymentState, formatUsdCents } from '../lifecycle/cashPayment'
import { currentDealAuthority, lockDeal } from '../lifecycle/dealFinanceEvidence'
import { domainEventRequestHash, recordDomainEventInTransaction } from '../lifecycle/domainEvents'
import { dealPaymentMethod } from '../lifecycle/paymentMethods'
import { assertSessionRooftopPermission } from '../tenantRecords'
import { operatorCommand } from './operatorCommandErrors'

function text(value: unknown, label: string, max: number) {
  const result = String(value ?? '').trim()
  if (!result) throw new Error(`${label} is required`)
  if (result.length > max) throw new Error(`${label} is too long`)
  return result
}

// Keystone 6.5's Prisma extension resolves a failed query to an error object instead of throwing.
function failed(result: unknown) {
  return !result || result instanceof Error || (typeof result === 'object' && (result as any).extensions?.code === 'KS_PRISMA_ERROR')
}

/**
 * A deposit or partial payment on an approved cash deal, recorded by staff (cash, check, card,
 * wire, ACH taken at the dealership). It reduces the amount still due; the final "Record payment"
 * takes the balance and funds the deal. It never funds the deal itself.
 */
async function recordCashDealDepositCommand(_root: unknown, { data }: any, context: any) {
  if (!context.session?.itemId || !permissions.canManageFinancing({ session: context.session })) throw new Error('Financing permission is required')
  const dealId = text(data?.dealId, 'Deal', 100)
  const idempotencyKey = text(data?.idempotencyKey, 'Idempotency key', 200)
  const amountCents = Number(data?.amountCents)
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0 || amountCents > 2_147_483_647) throw new Error('Enter an amount greater than $0')
  const paymentMethod = dealPaymentMethod(data?.paymentMethod)
  const receiptReference = text(data?.receiptReference, 'Receipt reference', 200)
  const visible = await context.query.Deal.findOne({ where: { id: dealId }, query: 'id rooftop { id }' })
  if (!visible?.rooftop?.id) throw new Error('Deal not found or not accessible')
  await assertSessionRooftopPermission(context, visible.rooftop.id, 'canManageFinancing')

  const actorId = context.session.itemId
  const eventKey = `cash-deal-deposit:${idempotencyKey}`
  const paymentIdempotencyKey = `cash-deposit:${idempotencyKey}`
  const request = { dealId, amountCents, paymentMethod, receiptReference }

  return context.transaction(async (tx: any) => {
    await lockDeal(tx, dealId)
    const authority = await currentDealAuthority(tx, context.session, dealId, ['canManageFinancing'])
    const deal = await tx.prisma.deal.findUnique({ where: { id: dealId } })
    if (failed(deal) || deal.rooftopId !== authority.rooftopId) throw new Error('Deal authority changed')

    // Same key, same request: return the recorded deposit instead of taking the money twice.
    const prior = await tx.prisma.domainAuditEvent.findUnique({ where: { eventKey }, select: { actorId: true, aggregateId: true, requestHash: true, afterSnapshot: true } })
    if (prior && !failed(prior)) {
      if (prior.actorId !== actorId || prior.aggregateId !== deal.id || JSON.stringify(prior.afterSnapshot?.request) !== JSON.stringify(request)) {
        throw new Error('This deposit was already recorded with different details; reload and try again')
      }
      const state = await cashPaymentState(tx, deal)
      return { id: prior.afterSnapshot?.paymentId, dealId: deal.id, amountCents, paymentMethod, receiptReference,
        remainingCents: state?.remainingCents ?? 0, form8300Required: state?.form8300Required ?? false, reused: true }
    }

    if (deal.structureType !== 'cash') throw new Error('Deposits are recorded on cash deals; finance deals are funded by the lender')
    if (deal.status !== 'approved') throw new Error(deal.status === 'pencil' || deal.status === 'submitted' ? 'Approve the deal before taking a deposit' : 'Deposits can only be recorded on an approved deal')
    const before = await cashPaymentState(tx, deal)
    if (!before) throw new Error('The deal price is incomplete; save the worksheet first')
    if (before.remainingCents <= 0) throw new Error('This deal is already paid in full')
    if (amountCents > before.remainingCents) throw new Error(`The deposit can't be more than the ${formatUsdCents(before.remainingCents)} still due`)
    if ((await tx.prisma.paymentTransaction.findFirst({ where: { providerTransactionId: receiptReference }, select: { id: true } }))?.id) {
      throw new Error('That receipt reference is already recorded on another payment')
    }

    const payment = await tx.prisma.paymentTransaction.create({
      data: { rooftopId: deal.rooftopId, dealId: deal.id, sourceType: 'deal', amountCents, currency: 'usd', providerKey: 'operator-recorded', paymentMethod,
        providerTransactionId: receiptReference, status: 'captured', capturedCents: amountCents, idempotencyKey: paymentIdempotencyKey },
      select: { id: true },
    })
    if (failed(payment) || !payment.id) throw new Error('Nothing was saved: the deposit could not be recorded')

    const remainingCents = before.remainingCents - amountCents
    const cashReceivedCents = before.cashReceivedCents + (paymentMethod === 'cash' ? amountCents : 0)
    const after = await cashPaymentState(tx, deal)
    const form8300Required = after?.form8300Required ?? false
    await recordDomainEventInTransaction(tx, {
      eventKey, rooftopId: deal.rooftopId, aggregateType: 'Deal', aggregateId: deal.id,
      action: 'cash-deposit-recorded', actorId,
      afterSnapshot: { version: 1, request, paymentId: payment.id, worksheetVersion: deal.worksheetVersion, acceptedHash: domainEventRequestHash(deal.acceptedSnapshot),
        amountDueCents: before.amountDueCents, previouslyReceivedCents: before.receivedCents, remainingCents, cashReceivedCents, form8300Required },
     })
    return { id: payment.id, dealId: deal.id, amountCents, paymentMethod, receiptReference, remainingCents, form8300Required, reused: false }
  }, { timeout: 30_000, isolationLevel: 'Serializable' })
}

export const recordCashDealDeposit = operatorCommand(recordCashDealDepositCommand)

/**
 * A repair order paid at the service counter (cash, check, card terminal), recorded by staff with its receipt
 * reference, the same way a cash deal deposit is. It is the settlement "Mark paid" checks; it never marks the order
 * paid by itself.
 */
async function recordServiceCounterPaymentCommand(_root: unknown, { data }: any, context: any) {
  if (!context.session?.itemId || !permissions.canManagePayments({ session: context.session })) throw new Error('Payment permission is required')
  const serviceOrderId = text(data?.serviceOrderId, 'Repair order', 100)
  const idempotencyKey = text(data?.idempotencyKey, 'Idempotency key', 200)
  const amountCents = Number(data?.amountCents)
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0 || amountCents > 2_147_483_647) throw new Error('Enter an amount greater than $0')
  const paymentMethod = dealPaymentMethod(data?.paymentMethod)
  const receiptReference = text(data?.receiptReference, 'Receipt reference', 200)
  const visible = await context.query.ServiceOrder.findOne({ where: { id: serviceOrderId }, query: 'id rooftop { id }' })
  if (!visible?.rooftop?.id) throw new Error('Repair order not found or not accessible')
  await assertSessionRooftopPermission(context, visible.rooftop.id, 'canManagePayments')
  const paymentIdempotencyKey = `service-counter:${idempotencyKey}`

  return context.transaction(async (tx: any) => {
    await tx.prisma.$queryRaw`SELECT "id" FROM "ServiceOrder" WHERE "id" = ${serviceOrderId} FOR UPDATE`
    const order = await tx.prisma.serviceOrder.findUnique({ where: { id: serviceOrderId }, select: { id: true, rooftopId: true, status: true, grandTotalCents: true } })
    if (failed(order) || order.rooftopId !== visible.rooftop.id) throw new Error('Repair order changed; reload and try again')
    // Same key, same request: return the recorded payment instead of taking the money twice.
    const prior = await tx.prisma.paymentTransaction.findUnique({ where: { idempotencyKey: paymentIdempotencyKey }, select: { id: true, serviceOrderId: true, amountCents: true, paymentMethod: true, providerTransactionId: true } })
    if (prior && !failed(prior)) {
      if (prior.serviceOrderId !== order.id || prior.amountCents !== amountCents || prior.paymentMethod !== paymentMethod || prior.providerTransactionId !== receiptReference) throw new Error('This payment was already recorded with different details; reload and try again')
      return { id: prior.id, serviceOrderId: order.id, amountCents, remainingCents: await serviceRemainingCents(tx, order), reused: true }
    }
    if (order.status !== 'invoiced') throw new Error('Counter payments are recorded on an invoiced repair order')
    const remainingCents = await serviceRemainingCents(tx, order)
    if (remainingCents <= 0) throw new Error('This invoice is already paid in full')
    if (amountCents > remainingCents) throw new Error(`The payment can't be more than the ${formatUsdCents(remainingCents)} still due`)
    if ((await tx.prisma.paymentTransaction.findFirst({ where: { providerTransactionId: receiptReference }, select: { id: true } }))?.id) {
      throw new Error('That receipt reference is already recorded on another payment')
    }
    const payment = await tx.prisma.paymentTransaction.create({
      data: { rooftopId: order.rooftopId, serviceOrderId: order.id, sourceType: 'service', amountCents, currency: 'usd', providerKey: 'operator-recorded', paymentMethod,
        providerTransactionId: receiptReference, status: 'captured', capturedCents: amountCents, idempotencyKey: paymentIdempotencyKey },
      select: { id: true },
    })
    if (failed(payment) || !payment.id) throw new Error('Nothing was saved: the payment could not be recorded')
    await recordDomainEventInTransaction(tx, {
      eventKey: `service-counter-payment:${idempotencyKey}`, rooftopId: order.rooftopId, aggregateType: 'ServiceOrder', aggregateId: order.id,
      action: 'counter-payment-recorded', actorId: context.session.itemId,
      afterSnapshot: { version: 1, request: { serviceOrderId, amountCents, paymentMethod, receiptReference }, paymentId: payment.id, remainingCents: remainingCents - amountCents },
    })
    return { id: payment.id, serviceOrderId: order.id, amountCents, remainingCents: remainingCents - amountCents, reused: false }
  }, { timeout: 30_000, isolationLevel: 'Serializable' })
}

async function serviceRemainingCents(tx: any, order: { id: string; grandTotalCents: number | null }) {
  const settled = await tx.prisma.paymentTransaction.findMany({ where: { serviceOrderId: order.id, status: { in: ['captured', 'partially-refunded', 'refunded'] } }, select: { capturedCents: true, refundedCents: true } })
  const net = settled.reduce((sum: number, row: any) => sum + Number(row.capturedCents || 0) - Number(row.refundedCents || 0), 0)
  return Math.max(0, Number(order.grandTotalCents || 0) - net)
}

export const recordServiceCounterPayment = operatorCommand(recordServiceCounterPaymentCommand)
