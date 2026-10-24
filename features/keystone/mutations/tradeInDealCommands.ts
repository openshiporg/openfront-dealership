import { permissions, TRADE_IN_ACCESS_PERMISSIONS } from '../access'
import { commandDate } from '../lifecycle/commandDate'
import { amortizedPaymentCents, assertValidDealPrice, calculateDealPrice, checkedCents, repriceRateTaxLines, sumMoneyLines, type MoneyLine } from '../lifecycle/dealPricing'
import { currentDealAuthority, lockDeal } from '../lifecycle/dealFinanceEvidence'
import { recordDomainEventInTransaction } from '../lifecycle/domainEvents'
import { hasPermissionAcrossAllRooftops } from '../tenancy'
import { assertSessionRooftopPermission } from '../tenantRecords'
import { operatorCommand } from './operatorCommandErrors'

const TRADE_IN_CONDITIONS = new Set(['excellent', 'good', 'fair', 'poor'])

function commandKey(value: unknown) {
  const key = String(value || '').trim()
  if (key.length < 8 || key.length > 180) throw new Error('A valid idempotency key is required')
  return key
}

function optionalText(value: unknown, label: string, max: number) {
  const text = String(value ?? '').trim()
  if (text.length > max) throw new Error(`${label} must be at most ${max} characters`)
  return text
}

function requiredText(value: unknown, label: string, max: number) {
  const text = optionalText(value, label, max)
  if (!text) throw new Error(`${label} is required`)
  return text
}

function isUniqueViolation(error: unknown) {
  return Boolean(error && typeof error === 'object' && (error as { code?: unknown }).code === 'P2002')
}

/**
 * Staff create a trade-in for a walk-in or phone customer. The customer lead is linked here because
 * TradeIn.lead is not writable through the open list, and salespeople only see trade-ins on their leads.
 */
async function createWalkInTradeInCommand(_root: unknown, { data }: { data: any }, context: any) {
  if (!context.session?.itemId || !permissions.canAccessTradeIns({ session: context.session })) throw new Error('Trade-in access is required')
  const rooftopId = requiredText(data.rooftopId, 'Rooftop', 100)
  await assertSessionRooftopPermission(context, rooftopId, TRADE_IN_ACCESS_PERMISSIONS)
  const key = commandKey(data.idempotencyKey)
  const leadId = data.leadId ? String(data.leadId) : null
  if (leadId) {
    const lead = await context.query.Lead.findOne({ where: { id: leadId }, query: 'id rooftop { id }' })
    if (!lead || lead.rooftop?.id !== rooftopId) throw new Error('Customer lead must belong to the same rooftop')
  } else if (!hasPermissionAcrossAllRooftops(context.session, ['canManageTradeIns', 'canViewAllLeads'])) {
    throw new Error('Select the customer lead')
  }
  const vin = optionalText(data.vin, 'VIN', 17).toUpperCase()
  if (vin && !/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) throw new Error('VIN must be 17 letters and numbers (no I, O or Q)')
  const year = requiredText(data.year, 'Year', 4)
  const yearNumber = Number(year)
  if (!/^\d{4}$/.test(year) || yearNumber < 1900 || yearNumber > new Date().getFullYear() + 2) throw new Error('Year is invalid')
  const make = requiredText(data.make, 'Make', 100)
  const model = requiredText(data.model, 'Model', 100)
  const trim = optionalText(data.trim, 'Trim', 100)
  const mileage = data.mileage == null ? null : Number(data.mileage)
  if (mileage != null && (!Number.isInteger(mileage) || mileage < 0 || mileage > 2_000_000)) throw new Error('Mileage is invalid')
  const condition = data.condition ? String(data.condition) : null
  if (condition && !TRADE_IN_CONDITIONS.has(condition)) throw new Error('Condition must be excellent, good, fair or poor')
  const values = {
    vin, year, make, model, trim, mileage, condition,
    exteriorCondition: optionalText(data.exteriorCondition, 'Exterior notes', 2000),
    interiorCondition: optionalText(data.interiorCondition, 'Interior notes', 2000),
    mechanicalIssues: optionalText(data.mechanicalIssues, 'Mechanical notes', 2000),
  }
  const eventKey = `trade-in-walk-in:${key}`
  const evidence = { rooftopId, leadId, ...values, source: 'walk-in' }
  const result = await context.transaction(async (tx: any) => {
    await tx.prisma.$queryRaw`SELECT 1 AS "locked" FROM pg_advisory_xact_lock(hashtextextended(${`command:${eventKey}`}, 0))`
    const prior = await tx.prisma.domainAuditEvent.findUnique({ where: { eventKey }, select: { aggregateId: true } })
    if (prior) {
      await recordDomainEventInTransaction(tx, { eventKey, rooftopId, aggregateType: 'TradeIn', aggregateId: prior.aggregateId, action: 'created', topic: 'trade-in.created', actorId: context.session.itemId, afterSnapshot: evidence, payload: { tradeInId: prior.aggregateId, rooftopId, leadId } })
      return { id: prior.aggregateId, reused: true }
    }
    const tradeIn = await tx.prisma.tradeIn.create({ data: { ...values, rooftopId, leadId }, select: { id: true } })
    await recordDomainEventInTransaction(tx, { eventKey, rooftopId, aggregateType: 'TradeIn', aggregateId: tradeIn.id, action: 'created', topic: 'trade-in.created', actorId: context.session.itemId, afterSnapshot: evidence, payload: { tradeInId: tradeIn.id, rooftopId, leadId } })
    return { id: tradeIn.id, reused: false }
  }, { timeout: 30_000 })
  const row = await context.sudo().prisma.tradeIn.findUnique({ where: { id: result.id }, select: { id: true, updatedAt: true } })
  return { id: result.id, status: 'created', updatedAt: row?.updatedAt ?? new Date(), reused: result.reused }
}

/**
 * Attach (tradeInId) or detach (no tradeInId) a trade-in on a pencil deal. The trade credit becomes the
 * trade-in's recorded offer (zero on detach), rate-based tax and the finance payment are repriced, and
 * the presentation, acceptance and lender selection are cleared like a worksheet save.
 */
async function setDealTradeInCommand(_root: unknown, { data }: { data: any }, context: any) {
  if (!context.session?.itemId || !permissions.canManageDeals({ session: context.session })) throw new Error('Deal management permission is required')
  const dealId = requiredText(data.dealId, 'Deal', 100)
  const tradeInId = data.tradeInId ? String(data.tradeInId) : null
  const visible = await context.query.Deal.findOne({ where: { id: dealId }, query: 'id rooftop { id }' })
  if (!visible?.rooftop?.id) throw new Error('Deal not found or not accessible')
  await assertSessionRooftopPermission(context, visible.rooftop.id, 'canManageDeals')
  if (tradeInId) {
    const tradeIn = await context.query.TradeIn.findOne({ where: { id: tradeInId }, query: 'id' })
    if (!tradeIn) throw new Error('Trade-in not found or not accessible')
  }
  const expectedUpdatedAt = commandDate(data.expectedUpdatedAt)
  const reason = optionalText(data.reason, 'Reason', 500)
  const eventKey = `deal-trade-in:${commandKey(data.idempotencyKey)}`

  try {
    return await context.transaction(async (tx: any) => {
      await lockDeal(tx, dealId)
      const authority = await currentDealAuthority(tx, context.session, dealId, ['canManageDeals'])
      const deal = await tx.prisma.deal.findUnique({ where: { id: dealId } })
      if (!deal || deal.rooftopId !== authority.rooftopId) throw new Error('Deal authority changed')
      const prior = await tx.prisma.domainAuditEvent.findUnique({ where: { eventKey }, select: { aggregateId: true } })
      if (prior) {
        if (prior.aggregateId !== dealId) throw new Error('Trade-in idempotency key belongs to another deal')
        return { id: deal.id, status: deal.status, updatedAt: deal.updatedAt, reused: true }
      }
      if (deal.status !== 'pencil') throw new Error('Trade-ins can only be changed while the deal is in pencil')
      if (deal.updatedAt.getTime() !== expectedUpdatedAt.getTime()) throw new Error('Deal changed concurrently; reload and retry')

      let tradeIn: any = null
      if (tradeInId) {
        if (deal.tradeInVehicleId === tradeInId) throw new Error('This trade-in is already on the deal')
        tradeIn = await tx.prisma.tradeIn.findUnique({ where: { id: tradeInId }, include: { deal: { select: { id: true, status: true } } } })
        if (!tradeIn || tradeIn.rooftopId !== deal.rooftopId) throw new Error('Trade-in must belong to the same rooftop')
        if (tradeIn.leadId && deal.leadId && tradeIn.leadId !== deal.leadId) throw new Error('Deal and trade-in must belong to the same lead')
        if (tradeIn.deal && tradeIn.deal.status !== 'cancelled') throw new Error('Trade-in is already attached to another deal')
        if (tradeIn.offerAmountCents == null) throw new Error('Record an appraisal offer before attaching the trade-in')
        // A trade-in left on a cancelled deal is released to this one.
        if (tradeIn.deal) await tx.prisma.deal.update({ where: { id: tradeIn.deal.id }, data: { tradeInVehicleId: null } })
      } else if (!deal.tradeInVehicleId) {
        throw new Error('No trade-in is attached to this deal')
      }

      const tradeInValueCents = tradeIn ? checkedCents(tradeIn.offerAmountCents, 'Trade-in offer') : 0
      const fees = Array.isArray(deal.fees) ? deal.fees as MoneyLine[] : []
      const rebates = Array.isArray(deal.rebates) ? deal.rebates as MoneyLine[] : []
      const priorTaxLines = Array.isArray(deal.taxLines) ? deal.taxLines as MoneyLine[] : []
      const taxLines = repriceRateTaxLines(priorTaxLines, { vehiclePriceCents: deal.vehiclePriceCents, tradeInValueCents, fees, rebates })
      const taxAmountCents = taxLines.length ? sumMoneyLines(taxLines) : checkedCents(deal.taxAmountCents, 'Tax')
      const pricing = calculateDealPrice({ ...deal, tradeInValueCents, taxLines, taxAmountCents, financingAmountCents: 0 })
      assertValidDealPrice(pricing)
      const financingAmountCents = deal.structureType === 'cash' ? 0 : pricing.balanceCents
      const monthlyPaymentCents = deal.structureType === 'cash'
        ? 0
        : deal.structureType === 'finance' && deal.loanTerm && deal.apr != null
          ? amortizedPaymentCents(financingAmountCents, Number(deal.apr), Number(deal.loanTerm))
          : deal.monthlyPaymentCents
      const tradeInDetails = tradeIn
        ? { tradeInId: tradeIn.id, vin: tradeIn.vin || null, year: tradeIn.year || null, make: tradeIn.make || null, model: tradeIn.model || null, trim: tradeIn.trim || null, mileage: tradeIn.mileage ?? null, offerAmountCents: tradeIn.offerAmountCents }
        : {}
      // An unsaved pencil stays unsaved; a saved worksheet gets a new version because its terms changed.
      const worksheetVersion = Number(deal.worksheetVersion || 0) > 0 ? Number(deal.worksheetVersion) + 1 : 0
      const action = tradeIn ? 'trade-in-attached' : 'trade-in-detached'
      const affectedTradeInId = tradeIn?.id ?? deal.tradeInVehicleId
      const evidence = {
        dealId, reason: reason || null, expectedUpdatedAt: expectedUpdatedAt.toISOString(),
        previousTradeInId: deal.tradeInVehicleId ?? null, tradeInId: tradeIn?.id ?? null,
        previousTradeInValueCents: deal.tradeInValueCents ?? 0, tradeInValueCents, worksheetVersion,
        terms: { tradeInValueCents, taxLines, taxAmountCents, financingAmountCents, monthlyPaymentCents },
        pricing: calculateDealPrice({ ...deal, tradeInValueCents, taxLines, taxAmountCents, financingAmountCents }),
      }
      const changed = await tx.prisma.deal.updateMany({
        where: { id: dealId, rooftopId: deal.rooftopId, status: 'pencil', updatedAt: deal.updatedAt },
        data: {
          tradeInVehicleId: tradeIn?.id ?? null, tradeInValueCents, tradeInDetails, taxLines, taxAmountCents,
          financingAmountCents, monthlyPaymentCents, worksheetVersion,
          selectedLenderDecisionId: null, presentedAt: null, presentedSnapshot: {}, acceptedAt: null, acceptedSnapshot: {},
        },
      })
      if (changed.count !== 1) throw new Error('Deal changed concurrently; reload and retry')
      await recordDomainEventInTransaction(tx, { eventKey, rooftopId: deal.rooftopId, aggregateType: 'Deal', aggregateId: dealId, action, topic: `deal.${action}`, actorId: context.session.itemId, afterSnapshot: evidence, payload: { rooftopId: deal.rooftopId, dealId, tradeInId: affectedTradeInId, tradeInValueCents } })
      await recordDomainEventInTransaction(tx, { eventKey: `${eventKey}:trade-in`, rooftopId: deal.rooftopId, aggregateType: 'TradeIn', aggregateId: affectedTradeInId, action: tradeIn ? 'attached-to-deal' : 'detached-from-deal', topic: `trade-in.${tradeIn ? 'attached' : 'detached'}`, actorId: context.session.itemId, afterSnapshot: { tradeInId: affectedTradeInId, dealId, reason: reason || null, tradeInValueCents }, payload: { rooftopId: deal.rooftopId, dealId, tradeInId: affectedTradeInId } })
      const current = await tx.prisma.deal.findUnique({ where: { id: dealId }, select: { id: true, status: true, updatedAt: true } })
      return { id: current.id, status: current.status, updatedAt: current.updatedAt, reused: false }
    }, { timeout: 30_000, isolationLevel: 'Serializable' })
  } catch (error) {
    if (isUniqueViolation(error)) throw new Error('Trade-in is already attached to another deal')
    throw error
  }
}

export const createWalkInTradeIn = operatorCommand(createWalkInTradeInCommand)
export const setDealTradeIn = operatorCommand(setDealTradeInCommand)
