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
      action: 'cash-deposit-recorded', topic: 'deal.cash-deposit-recorded', actorId,
      afterSnapshot: { version: 1, request, paymentId: payment.id, worksheetVersion: deal.worksheetVersion, acceptedHash: domainEventRequestHash(deal.acceptedSnapshot),
        amountDueCents: before.amountDueCents, previouslyReceivedCents: before.receivedCents, remainingCents, cashReceivedCents, form8300Required },
      payload: { rooftopId: deal.rooftopId, dealId: deal.id, paymentId: payment.id, amountCents, paymentMethod, remainingCents, form8300Required },
    })
    return { id: payment.id, dealId: deal.id, amountCents, paymentMethod, receiptReference, remainingCents, form8300Required, reused: false }
  }, { timeout: 30_000, isolationLevel: 'Serializable' })
}

export const recordCashDealDeposit = operatorCommand(recordCashDealDepositCommand)
