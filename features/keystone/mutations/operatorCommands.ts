import { randomUUID } from 'node:crypto'

import { permissions } from '../access'
import { commandDate } from '../lifecycle/commandDate'
import { amortizedPaymentCents, assertValidDealPrice, calculateDealPrice, checkedCents, normalizeMoneyLines, repriceRateTaxLines, sumMoneyLines } from '../lifecycle/dealPricing'
import { domainEventRequestHash, recordDomainEventInTransaction, stableJson, type DomainEventInput } from '../lifecycle/domainEvents'
import { assertSessionRooftopPermission, assertUserRooftopAccess } from '../tenantRecords'
import { assertCurrentFunding, currentDealAuthority, lockDeal, readLockedFunding, worksheetBinding } from '../lifecycle/dealFinanceEvidence'
import { recomputeServiceOrderTotals } from './serviceOrderLineCommands'

function idempotencyKey(value: unknown) {
  const key = String(value || '').trim()
  if (key.length < 8 || key.length > 180) throw new Error('A valid idempotency key is required')
  return key
}

function required(value: unknown, label: string, max = 500) {
  const result = String(value || '').trim()
  if (!result || result.length > max) throw new Error(`${label} is required and must be at most ${max} characters`)
  return result
}

const cents = checkedCents

async function replayExists(context: any, eventKey: string) {
  return Boolean(await context.sudo().prisma.domainAuditEvent.findUnique({ where: { eventKey }, select: { id: true } }))
}

export async function transferLeadOwnership(_root: unknown, { data }: any, context: any) {
  if (!context.session?.itemId || !permissions.canManageLeads({ session: context.session })) throw new Error('Lead management permission is required')
  const lead = await context.query.Lead.findOne({ where: { id: String(data.leadId || '') }, query: 'id status updatedAt rooftop { id } assignedSalesperson { id }' })
  if (!lead?.rooftop?.id) throw new Error('Lead not found or not accessible')
  await assertSessionRooftopPermission(context, lead.rooftop.id, 'canManageLeads')
  const assignedToId = String(data.assignedToId || '')
  await assertUserRooftopAccess(context, assignedToId, lead.rooftop.id)
  const expectedUpdatedAt = commandDate(data.expectedUpdatedAt)
  const reason = required(data.reason, 'Transfer reason')
  const eventKey = `lead-owner-transfer:${idempotencyKey(data.idempotencyKey)}`
  const assignedAt = new Date()
  const firstResponseDueAt = new Date(assignedAt.getTime() + 30 * 60_000)
  const evidence = { leadId: lead.id, assignedToId, expectedUpdatedAt: expectedUpdatedAt.toISOString(), reason, assignedAt, firstResponseDueAt }
  const reused = await context.transaction(async (tx: any) => {
    const event: DomainEventInput = { eventKey, rooftopId: lead.rooftop.id, aggregateType: 'Lead', aggregateId: lead.id, action: 'ownership-transferred', topic: 'lead.ownership-transferred', actorId: context.session.itemId, afterSnapshot: evidence, payload: { rooftopId: lead.rooftop.id, leadId: lead.id, assignedToId } }
    const recorded = await recordDomainEventInTransaction(tx, event)
    if (recorded.reused) return true
    const changed = await tx.prisma.lead.updateMany({ where: { id: lead.id, rooftopId: lead.rooftop.id, updatedAt: expectedUpdatedAt }, data: { assignedSalespersonId: assignedToId, assignedAt, firstResponseDueAt } })
    if (changed.count !== 1) throw new Error('Lead changed concurrently; reload and retry')
    await tx.prisma.leadAssignmentEvent.create({
      data: {
        rooftopId: lead.rooftop.id,
        leadId: lead.id,
        fromUserId: lead.assignedSalesperson?.id || null,
        toUserId: assignedToId,
        actorId: context.session.itemId,
        reason,
        routeKey: 'manual-transfer',
        assignedAt,
        firstResponseDueAt,
      },
    })
    return false
  }, { timeout: 30_000 })
  const current = await context.query.Lead.findOne({ where: { id: lead.id }, query: 'id status updatedAt assignedSalesperson { id name }' })
  return { id: current.id, status: current.status, updatedAt: current.updatedAt, reused }
}

export async function saveDealWorksheet(_root: unknown, { data }: any, context: any) {
  if (!context.session?.itemId || !permissions.canManageDeals({ session: context.session })) throw new Error('Deal management permission is required')
  const deal = await context.query.Deal.findOne({ where: { id: String(data.dealId || '') }, query: 'id status updatedAt worksheetVersion structureType tradeInValueCents downPaymentCents taxAmountCents fees rebates products taxLines rooftop { id } vehicle { id vin stockNumber year make model trim purchasePriceCents } lead { id customer { id firstName lastName } } tradeInVehicle { id vin year make model mileage }' })
  if (!deal?.rooftop?.id) throw new Error('Deal not found or not accessible')
  await assertSessionRooftopPermission(context, deal.rooftop.id, 'canManageDeals')
  const expectedUpdatedAt = data.expectedUpdatedAt instanceof Date
    ? new Date(data.expectedUpdatedAt.getTime()) : new Date(String(data.expectedUpdatedAt || ''))
  if (Number.isNaN(expectedUpdatedAt.getTime())) throw new Error('expectedUpdatedAt is invalid')
  const reason = required(data.reason, 'Worksheet reason')
  const structureType = String(data.structureType || deal.structureType || 'cash')
  if (!['cash', 'finance', 'lease'].includes(structureType)) throw new Error('Deal structure must be cash, finance, or lease')
  // Omission preserves retained lines; only an explicit [] clears a category.
  const fees = normalizeMoneyLines(data.fees === undefined ? deal.fees ?? [] : data.fees, 'Fee')
  const rebates = normalizeMoneyLines(data.rebates === undefined ? deal.rebates ?? [] : data.rebates, 'Rebate')
  const products = normalizeMoneyLines(data.products === undefined ? deal.products ?? [] : data.products, 'Product')
  const retainedTax = deal.taxLines?.length ? deal.taxLines : Number(deal.taxAmountCents || 0) > 0
    ? [{ code: 'legacy-tax', name: 'Retained operator-recorded tax', amountCents: deal.taxAmountCents, source: 'operator-recorded' }] : []
  const vehiclePriceCents = cents(data.vehiclePriceCents, 'Vehicle price')
  const tradeInValueCents = cents(data.tradeInValueCents === undefined ? deal.tradeInValueCents : data.tradeInValueCents, 'Trade-in value')
  // Rate-based tax lines are repriced here so the server, not the client, owns the tax amount.
  const taxLines = repriceRateTaxLines(normalizeMoneyLines(data.taxLines === undefined ? retainedTax : data.taxLines, 'Tax'), { vehiclePriceCents, tradeInValueCents, fees, rebates })
  const downPaymentCents = cents(data.downPaymentCents === undefined ? deal.downPaymentCents : data.downPaymentCents, 'Down payment')
  const taxAmountCents = sumMoneyLines(taxLines)
  const pricing = calculateDealPrice({ vehiclePriceCents, tradeInValueCents, downPaymentCents, fees, rebates, products, taxLines, taxAmountCents })
  assertValidDealPrice(pricing)
  const { balanceCents } = pricing
  const loanTerm = data.loanTerm == null ? null : Number(data.loanTerm)
  const apr = data.apr == null ? null : Number(data.apr)
  const residualValueCents = data.residualValueCents == null ? null : cents(data.residualValueCents, 'Residual value')
  const moneyFactorBasisPoints = data.moneyFactorBasisPoints == null ? null : cents(data.moneyFactorBasisPoints, 'Money factor')
  if (structureType === 'cash' && (loanTerm || apr || residualValueCents || moneyFactorBasisPoints)) throw new Error('Cash structures cannot contain finance or lease terms')
  if (structureType === 'finance' && (!loanTerm || apr == null)) throw new Error('Finance structures require term and APR')
  if (structureType === 'lease' && (!loanTerm || residualValueCents == null || moneyFactorBasisPoints == null)) throw new Error('Lease structures require term, residual, and money factor')
  if (loanTerm != null && (!Number.isInteger(loanTerm) || loanTerm < 1 || loanTerm > 120)) throw new Error('Loan term is invalid')
  if (apr != null && (!Number.isFinite(apr) || apr < 0 || apr > 100)) throw new Error('APR is invalid')
  const monthlyPaymentCents = structureType === 'cash'
    ? 0
    : structureType === 'finance'
      ? amortizedPaymentCents(balanceCents, apr!, loanTerm!)
      : cents(data.monthlyPaymentCents, 'Monthly payment')
  const terms = {
    structureType, vehiclePriceCents, tradeInValueCents, downPaymentCents,
    financingAmountCents: structureType === 'cash' ? 0 : balanceCents,
    monthlyPaymentCents,
    taxAmountCents, loanTerm, apr, residualValueCents, moneyFactorBasisPoints,
    fees, rebates, products, taxLines,
    worksheetVersion: Number(deal.worksheetVersion || 0) + 1,
    // Product margin/fees/recon are not inferred from retail product prices.
    grossCents: deal.vehicle?.purchasePriceCents == null ? null : checkedCents(vehiclePriceCents - pricing.rebatesCents - deal.vehicle.purchasePriceCents, 'Front gross estimate', true),
  }
  const eventKey = `deal-worksheet:${idempotencyKey(data.idempotencyKey)}`
  const evidence = { dealId: deal.id, expectedUpdatedAt: expectedUpdatedAt.toISOString(), reason, terms, pricing: calculateDealPrice(terms), vehicle: deal.vehicle, customer: deal.lead?.customer || null, tradeIn: deal.tradeInVehicle || null }
  const priorEvent = await context.sudo().prisma.domainAuditEvent.findUnique({ where: { eventKey }, select: { afterSnapshot: true } })
  if (priorEvent) {
    const priorTerms = (priorEvent.afterSnapshot as any)?.terms
    const comparable = { ...terms, worksheetVersion: priorTerms?.worksheetVersion }
    if (stableJson(priorTerms) !== stableJson(comparable)) throw new Error('Deal worksheet idempotency key was reused with different evidence')
    terms.worksheetVersion = priorTerms.worksheetVersion
  }
  if (!priorEvent && deal.status !== 'pencil') throw new Error('Only pencil deals can be reworked')
  const reused = await context.transaction(async (tx: any) => {
    await lockDeal(tx, deal.id)
    await currentDealAuthority(tx, context.session, deal.id, ['canManageDeals'])
    const event: DomainEventInput = { eventKey, rooftopId: deal.rooftop.id, aggregateType: 'Deal', aggregateId: deal.id, action: 'worksheet-saved', topic: 'deal.worksheet-saved', actorId: context.session.itemId, afterSnapshot: evidence, payload: { rooftopId: deal.rooftop.id, dealId: deal.id, terms } }
    const recorded = await recordDomainEventInTransaction(tx, event)
    if (recorded.reused) return true
    const changed = await tx.prisma.deal.updateMany({
      where: { id: deal.id, rooftopId: deal.rooftop.id, status: 'pencil', updatedAt: expectedUpdatedAt },
      data: { ...terms, selectedLenderDecisionId: null, presentedAt: null, presentedSnapshot: {}, acceptedAt: null, acceptedSnapshot: {} },
    })
    if (changed.count !== 1) throw new Error('Deal changed concurrently; reload and retry')
    return false
  }, { timeout: 30_000 })
  const current = await context.query.Deal.findOne({ where: { id: deal.id }, query: 'id status updatedAt' })
  return { id: current.id, status: current.status, updatedAt: current.updatedAt, reused }
}

export async function presentDealWorksheet(_root: unknown, { data }: any, context: any) {
  if (!context.session?.itemId || !permissions.canManageDeals({ session: context.session })) throw new Error('Deal management permission is required')
  const deal = await context.query.Deal.findOne({ where: { id: String(data.dealId || '') }, query: 'id status updatedAt worksheetVersion structureType vehiclePriceCents tradeInValueCents downPaymentCents financingAmountCents monthlyPaymentCents taxAmountCents loanTerm apr residualValueCents moneyFactorBasisPoints fees rebates products taxLines grossCents rooftop { id } vehicle { id vin stockNumber } lead { id customer { id } } tradeInVehicle { id }' })
  if (!deal?.rooftop?.id) throw new Error('Deal not found or not accessible')
  await assertSessionRooftopPermission(context, deal.rooftop.id, 'canManageDeals')
  if (deal.status !== 'pencil' || Number(deal.worksheetVersion || 0) < 1) throw new Error('A saved pencil worksheet is required before presentation')
  const expectedUpdatedAt = commandDate(data.expectedUpdatedAt)
  const eventKey = `deal-present:${idempotencyKey(data.idempotencyKey)}`
  const snapshot = { pricing: calculateDealPrice(deal), dealId: deal.id, worksheetVersion: deal.worksheetVersion, structureType: deal.structureType, vehicleId: deal.vehicle?.id, leadId: deal.lead?.id, customerId: deal.lead?.customer?.id, tradeInId: deal.tradeInVehicle?.id, terms: { vehiclePriceCents: deal.vehiclePriceCents, tradeInValueCents: deal.tradeInValueCents, downPaymentCents: deal.downPaymentCents, financingAmountCents: deal.financingAmountCents, monthlyPaymentCents: deal.monthlyPaymentCents, taxAmountCents: deal.taxAmountCents, loanTerm: deal.loanTerm, apr: deal.apr, residualValueCents: deal.residualValueCents, moneyFactorBasisPoints: deal.moneyFactorBasisPoints, fees: deal.fees, rebates: deal.rebates, products: deal.products, taxLines: deal.taxLines, grossCents: deal.grossCents }, expectedUpdatedAt: expectedUpdatedAt.toISOString() }
  const reused = await context.transaction(async (tx: any) => {
    await lockDeal(tx, deal.id)
    await currentDealAuthority(tx, context.session, deal.id, ['canManageDeals'])
    const event: DomainEventInput = { eventKey, rooftopId: deal.rooftop.id, aggregateType: 'Deal', aggregateId: deal.id, action: 'worksheet-presented', topic: 'deal.worksheet-presented', actorId: context.session.itemId, afterSnapshot: snapshot, payload: { rooftopId: deal.rooftop.id, dealId: deal.id, worksheetVersion: deal.worksheetVersion } }
    const recorded = await recordDomainEventInTransaction(tx, event)
    if (recorded.reused) return true
    const changed = await tx.prisma.deal.updateMany({ where: { id: deal.id, status: 'pencil', updatedAt: expectedUpdatedAt }, data: { presentedSnapshot: snapshot, presentedAt: new Date() } })
    if (changed.count !== 1) throw new Error('Deal changed concurrently; reload and retry')
    return false
  }, { timeout: 30_000 })
  const current = await context.query.Deal.findOne({ where: { id: deal.id }, query: 'id status updatedAt' })
  return { id: current.id, status: 'presented', updatedAt: current.updatedAt, reused }
}

export async function acceptDealWorksheet(_root: unknown, { data }: any, context: any) {
  if (!context.session?.itemId || !permissions.canManageDeals({ session: context.session })) throw new Error('Deal management permission is required')
  const deal = await context.query.Deal.findOne({ where: { id: String(data.dealId || '') }, query: 'id status updatedAt worksheetVersion presentedAt presentedSnapshot rooftop { id }' })
  if (!deal?.rooftop?.id) throw new Error('Deal not found or not accessible')
  await assertSessionRooftopPermission(context, deal.rooftop.id, 'canManageDeals')
  if (deal.status !== 'pencil' || !deal.presentedAt || !deal.presentedSnapshot || Object.keys(deal.presentedSnapshot).length === 0) throw new Error('Presented worksheet evidence is required before acceptance')
  const expectedUpdatedAt = commandDate(data.expectedUpdatedAt)
  const acknowledgment = required(data.acknowledgment, 'Acceptance acknowledgment', 1000)
  const eventKey = `deal-accept:${idempotencyKey(data.idempotencyKey)}`
  const snapshot = { dealId: deal.id, worksheetVersion: deal.worksheetVersion, presentedSnapshot: deal.presentedSnapshot, acknowledgment, expectedUpdatedAt: expectedUpdatedAt.toISOString() }
  const reused = await context.transaction(async (tx: any) => {
    await lockDeal(tx, deal.id)
    await currentDealAuthority(tx, context.session, deal.id, ['canManageDeals'])
    const event: DomainEventInput = { eventKey, rooftopId: deal.rooftop.id, aggregateType: 'Deal', aggregateId: deal.id, action: 'worksheet-accepted', topic: 'deal.worksheet-accepted', actorId: context.session.itemId, afterSnapshot: snapshot, payload: { rooftopId: deal.rooftop.id, dealId: deal.id, worksheetVersion: deal.worksheetVersion } }
    const recorded = await recordDomainEventInTransaction(tx, event)
    if (recorded.reused) return true
    const changed = await tx.prisma.deal.updateMany({ where: { id: deal.id, status: 'pencil', updatedAt: expectedUpdatedAt }, data: { acceptedSnapshot: snapshot, acceptedAt: new Date() } })
    if (changed.count !== 1) throw new Error('Deal changed concurrently; reload and retry')
    return false
  }, { timeout: 30_000 })
  const current = await context.query.Deal.findOne({ where: { id: deal.id }, query: 'id status updatedAt' })
  return { id: current.id, status: 'accepted', updatedAt: current.updatedAt, reused }
}

export async function selectDealLenderOffer(_root: unknown, { data }: any, context: any) {
  if (!context.session?.itemId || !permissions.canManageFinancing({ session: context.session }) || !permissions.canManageDeals({ session: context.session })) throw new Error('Deal and financing permissions are required')
  const visible = await context.query.Deal.findOne({ where: { id: String(data.dealId || '') }, query: 'id rooftop { id }' })
  if (!visible?.rooftop?.id) throw new Error('Deal not found or not accessible')
  await assertSessionRooftopPermission(context, visible.rooftop.id, 'canManageDeals')
  await assertSessionRooftopPermission(context, visible.rooftop.id, 'canManageFinancing')
  const expectedUpdatedAt = commandDate(data.expectedUpdatedAt)
  const eventKey = `deal-lender-select:${idempotencyKey(data.idempotencyKey)}`
  const request = { dealId: visible.id, lenderDecisionId: required(data.lenderDecisionId, 'Lender decision ID', 100), expectedUpdatedAt: expectedUpdatedAt.toISOString() }
  return context.transaction(async (tx: any) => {
    await lockDeal(tx, visible.id)
    const authority = await currentDealAuthority(tx, context.session, visible.id, ['canManageDeals', 'canManageFinancing'])
    const deal = await tx.prisma.deal.findUnique({ where: { id: visible.id } })
    if (!deal || deal.rooftopId !== authority.rooftopId || !deal.leadId || !['finance', 'lease'].includes(deal.structureType)) throw new Error('Finance or lease deal is required')
    const decision = await authority.context.query.LenderDecision.findOne({ where: { id: request.lenderDecisionId }, query: 'id decision approvedAmountCents aprBasisPoints termMonths monthlyPaymentCents providerKey rooftop { id } application { id lead { id } }' })
    if (!decision || decision.rooftop?.id !== deal.rooftopId || decision.application?.lead?.id !== deal.leadId) throw new Error('Lender offer must belong to the same rooftop and lead')
    if (!['approved', 'conditional'].includes(decision.decision)) throw new Error('Only approved or conditional lender offers can be selected')
    if (Number(decision.approvedAmountCents || 0) < Number(deal.financingAmountCents || 0)) throw new Error('Selected lender offer does not cover the financed amount')
    const binding = worksheetBinding(deal)
    const evidence = { request, dealId: deal.id, lenderDecisionId: decision.id, binding, offer: { providerKey: decision.providerKey, decision: decision.decision, approvedAmountCents: decision.approvedAmountCents, aprBasisPoints: decision.aprBasisPoints, termMonths: decision.termMonths, monthlyPaymentCents: decision.monthlyPaymentCents } }
    const prior = await tx.prisma.domainAuditEvent.findUnique({ where: { eventKey } })
    if (!prior && deal.status !== 'pencil') throw new Error('Only pencil finance or lease deals can select lender offers')
    const recorded = await recordDomainEventInTransaction(tx, { eventKey, rooftopId: deal.rooftopId, aggregateType: 'Deal', aggregateId: deal.id, action: 'lender-offer-selected', topic: 'deal.lender-offer-selected', actorId: context.session.itemId, afterSnapshot: evidence, payload: { rooftopId: deal.rooftopId, dealId: deal.id, lenderDecisionId: decision.id } })
    if (recorded.reused) {
      if (deal.selectedLenderDecisionId !== decision.id) throw new Error('Lender selection was superseded; select with a new request')
    } else {
      const changed = await tx.prisma.deal.updateMany({ where: { id: deal.id, rooftopId: deal.rooftopId, status: 'pencil', worksheetVersion: binding.worksheetVersion, updatedAt: expectedUpdatedAt }, data: { selectedLenderDecisionId: decision.id } })
      if (changed.count !== 1) throw new Error('Deal changed concurrently; reload and retry')
    }
    const current = await authority.context.query.Deal.findOne({ where: { id: deal.id }, query: 'id status updatedAt' })
    return { ...current, reused: recorded.reused }
  }, { timeout: 30_000, isolationLevel: 'Serializable' })
}

export async function reopenDealWorksheet(_root: unknown, { data }: any, context: any) {
  if (!context.session?.itemId || !permissions.canManageDeals({ session: context.session }) || !permissions.canApproveDeals({ session: context.session })) throw new Error('Deal management and approval permissions are required')
  const deal = await context.query.Deal.findOne({ where: { id: String(data.dealId || '') }, query: 'id status updatedAt worksheetVersion acceptedSnapshot presentedSnapshot evidenceSnapshot rooftop { id } vehicle { id status }' })
  if (!deal?.rooftop?.id || !['submitted', 'approved'].includes(deal.status)) throw new Error('Only submitted or approved deals can be reopened')
  await assertSessionRooftopPermission(context, deal.rooftop.id, 'canManageDeals')
  await assertSessionRooftopPermission(context, deal.rooftop.id, 'canApproveDeals')
  const rawDeal = await context.sudo().prisma.deal.findUnique({ where: { id: deal.id }, select: { vehicleId: true, rooftopId: true } })
  const reservedVehicle = rawDeal?.vehicleId ? await context.sudo().prisma.vehicle.findUnique({ where: { id: rawDeal.vehicleId }, select: { status: true, rooftopId: true } }) : null
  if (rawDeal?.rooftopId !== deal.rooftop.id || reservedVehicle?.status !== 'pending' || reservedVehicle.rooftopId !== deal.rooftop.id) throw new Error('Reserved vehicle is required to reopen a deal')
  const expectedUpdatedAt = commandDate(data.expectedUpdatedAt)
  const reason = required(data.reason, 'Reopen reason', 1000)
  const eventKey = `deal-reopen:${idempotencyKey(data.idempotencyKey)}`
  const evidence = { dealId: deal.id, priorStatus: deal.status, worksheetVersion: deal.worksheetVersion, expectedUpdatedAt: expectedUpdatedAt.toISOString(), reason, supersededPresentedHash: domainEventRequestHash(deal.presentedSnapshot || {}), supersededAcceptedHash: domainEventRequestHash(deal.acceptedSnapshot || {}), supersededSubmissionHash: domainEventRequestHash(deal.evidenceSnapshot || {}) }
  const reused = await context.transaction(async (tx: any) => {
    await lockDeal(tx, deal.id)
    await currentDealAuthority(tx, context.session, deal.id, ['canManageDeals', 'canApproveDeals'])
    const currentVehicle = await tx.prisma.vehicle.findUnique({ where: { id: rawDeal.vehicleId } })
    if (currentVehicle?.status !== 'pending' || currentVehicle.rooftopId !== deal.rooftop.id) throw new Error('Reserved vehicle is required to reopen a deal')
    const event: DomainEventInput = { eventKey, rooftopId: deal.rooftop.id, aggregateType: 'Deal', aggregateId: deal.id, action: 'worksheet-reopened', topic: 'deal.worksheet-reopened', actorId: context.session.itemId, afterSnapshot: evidence, payload: { rooftopId: deal.rooftop.id, dealId: deal.id, priorStatus: deal.status, status: 'pencil' } }
    const recorded = await recordDomainEventInTransaction(tx, event)
    if (recorded.reused) return true
    const changed = await tx.prisma.deal.updateMany({ where: { id: deal.id, status: deal.status, updatedAt: expectedUpdatedAt }, data: { status: 'pencil', lockedAt: null, evidenceSnapshot: {}, presentedAt: null, presentedSnapshot: {}, acceptedAt: null, acceptedSnapshot: {}, selectedLenderDecisionId: null } })
    if (changed.count !== 1) throw new Error('Deal changed concurrently; reload and retry')
    await tx.prisma.dealApproval.create({ data: { rooftopId: deal.rooftop.id, dealId: deal.id, approverId: context.session.itemId, decision: 'changes-requested', notes: reason, approvalDate: new Date() } })
    return false
  }, { timeout: 30_000 })
  const current = await context.query.Deal.findOne({ where: { id: deal.id }, query: 'id status updatedAt' })
  return { id: current.id, status: current.status, updatedAt: current.updatedAt, reused }
}

export async function completeDealDelivery(_root: unknown, { data }: any, context: any) {
  if (!context.session?.itemId || !permissions.canManageDeals({ session: context.session }) || !permissions.canManageFinancing({ session: context.session })) {
    throw new Error('Deal and financing permissions are required for delivery')
  }
  const visible = await context.query.Deal.findOne({ where: { id: String(data.dealId || '') }, query: 'id rooftop { id }' })
  if (!visible?.rooftop?.id) throw new Error('Deal not found or not accessible')
  await assertSessionRooftopPermission(context, visible.rooftop.id, 'canManageDeals')
  await assertSessionRooftopPermission(context, visible.rooftop.id, 'canManageFinancing')
  const expectedUpdatedAt = commandDate(data.expectedUpdatedAt)
  const expectedFundingUpdatedAt = commandDate(data.expectedFundingUpdatedAt)
  const expectedDeliveryCaseUpdatedAt = commandDate(data.expectedDeliveryCaseUpdatedAt)
  const eventKey = `deal-delivery:${idempotencyKey(data.idempotencyKey)}`
  // Retain the entire submitted payload, including legacy flags/notes, for exact retries.
  const request = { ...data, idempotencyKey: undefined, dealId: visible.id,
    expectedUpdatedAt: expectedUpdatedAt.toISOString(), expectedFundingUpdatedAt: expectedFundingUpdatedAt.toISOString(),
    expectedDeliveryCaseUpdatedAt: expectedDeliveryCaseUpdatedAt.toISOString() }
  return context.transaction(async (tx: any) => {
    await lockDeal(tx, visible.id)
    const authority = await currentDealAuthority(tx, context.session, visible.id, ['canManageDeals', 'canManageFinancing'])
    const deal = await tx.prisma.deal.findUnique({ where: { id: visible.id }, include: { vehicle: true } })
    if (!deal?.vehicle || deal.rooftopId !== authority.rooftopId || deal.vehicle.rooftopId !== deal.rooftopId) throw new Error('Same-rooftop deal and vehicle are required')
    const header = await tx.prisma.domainAuditEvent.findUnique({ where: { eventKey }, select: { id: true, actorId: true, rooftopId: true, aggregateType: true, aggregateId: true, action: true } })
    if (header) {
      if (header.actorId !== context.session.itemId || header.rooftopId !== authority.rooftopId || header.aggregateType !== 'Deal' || header.aggregateId !== deal.id || header.action !== 'delivery-completed') throw new Error('Delivery receipt is outside original actor/purpose scope')
      const lead = await tx.prisma.lead.findUnique({ where: { id: deal.leadId }, select: { id: true, rooftopId: true } })
      if (!lead || lead.rooftopId !== deal.rooftopId) throw new Error('Committed delivery related identity is unavailable in current scope')
      const prior = await tx.prisma.domainAuditEvent.findUnique({ where: { eventKey } })
      if (stableJson(prior.afterSnapshot?.request) !== stableJson(request) || prior.afterSnapshot?.binding?.leadId !== deal.leadId || prior.afterSnapshot?.vehicleId !== deal.vehicleId ||
          prior.afterSnapshot?.binding?.rooftopId !== authority.rooftopId || deal.status !== 'delivered' || deal.vehicle.status !== 'sold') throw new Error('Delivery retry is changed, superseded, or inconsistent; reload and reconcile')
      // Already committed is a historical fact, not NEW admission against today's artifacts.
      // Scoped readback cannot retrospectively undo its original audit/outbox or sold VIN.
      const current = await authority.context.query.Deal.findOne({ where: { id: deal.id }, query: 'id status updatedAt' })
      if (!current) throw new Error('Committed delivery receipt readback is unavailable in current scope')
      return { ...current, reused: true }
    }
    const funding = await readLockedFunding(tx, deal.id)
    const binding = await assertCurrentFunding(tx, deal, funding)
    await tx.prisma.$queryRaw`SELECT "id" FROM "DeliveryCase" WHERE "deal" = ${deal.id} FOR UPDATE`
    const deliveryCase = await tx.prisma.deliveryCase.findFirst({ where: { dealId: deal.id, rooftopId: deal.rooftopId }, include: { weOweItems: { orderBy: { promisedAt: 'asc' } } } })
    if (!deliveryCase?.acknowledgedAt || !deliveryCase.customerAcknowledgment) throw new Error('Ready customer-acknowledged delivery case is required')
    const checklist = Array.isArray(deliveryCase.checklist) ? deliveryCase.checklist : []
    const required = ['identity', 'insurance', 'registration', 'title-handoff', 'funding']
    if (!required.every(code => checklist.some((item: any) => item.code === code && ['complete', 'waived'].includes(item.status) && String(item.evidenceReference || '').trim()))) throw new Error('Server-verified delivery checklist is incomplete')
    if (stableJson(deliveryCase.deliverySnapshot?.checklist) !== stableJson(checklist) ||
        deliveryCase.deliverySnapshot?.customerAcknowledgment !== deliveryCase.customerAcknowledgment ||
        deliveryCase.deliverySnapshot?.acknowledgedAt !== deliveryCase.acknowledgedAt.toISOString()) throw new Error('Delivery acknowledgment no longer matches its recorded checklist evidence')
    const payload = { rooftopId: deal.rooftopId, dealId: deal.id, vehicleId: deal.vehicleId, status: 'delivered' }
    if (deal.status !== 'financed') throw new Error('Only financed deals can be delivered')
    if (deliveryCase.status !== 'ready') throw new Error('Ready customer-acknowledged delivery case is required')
    if (stableJson(deliveryCase.deliverySnapshot?.binding) !== stableJson({ ...worksheetBinding(deal), acceptedHash: domainEventRequestHash(deal.acceptedSnapshot) })) throw new Error('Delivery acknowledgment is unbound or stale; record it for the current worksheet')
    if (funding.updatedAt.getTime() !== expectedFundingUpdatedAt.getTime() || deliveryCase.updatedAt.getTime() !== expectedDeliveryCaseUpdatedAt.getTime()) throw new Error('Funding or delivery case changed; reload and review before completion')
    const evidence = { version: 2, request, binding, dealId: deal.id, deliveryCaseId: deliveryCase.id, vehicleId: deal.vehicleId,
      funding: { id: funding.id, fundingReference: funding.fundingReference, updatedAt: funding.updatedAt.toISOString(), immutableEvidence: funding.immutableEvidence },
      checklist, customerAcknowledgment: deliveryCase.customerAcknowledgment, acknowledgedAt: deliveryCase.acknowledgedAt.toISOString(),
      weOweItems: deliveryCase.weOweItems.map((item: any) => ({ id: item.id, description: item.description, status: item.status, promisedAt: item.promisedAt, ownerId: item.ownerId, estimatedCostCents: item.estimatedCostCents })) }
    const delivered = await tx.prisma.deal.updateMany({ where: { id: deal.id, rooftopId: deal.rooftopId, status: 'financed', worksheetVersion: binding.worksheetVersion, updatedAt: expectedUpdatedAt }, data: { status: 'delivered', saleDate: new Date() } })
    if (delivered.count !== 1) throw new Error('Deal changed concurrently; reload and retry')
    const sold = await tx.prisma.vehicle.updateMany({ where: { id: deal.vehicleId, rooftopId: deal.rooftopId, status: 'pending' }, data: { status: 'sold' } })
    if (sold.count !== 1) throw new Error('Reserved vehicle could not be released for delivery')
    const completedCase = await tx.prisma.deliveryCase.updateMany({ where: { id: deliveryCase.id, dealId: deal.id, rooftopId: deal.rooftopId, status: 'ready', updatedAt: expectedDeliveryCaseUpdatedAt }, data: { status: 'delivered', deliverySnapshot: evidence } })
    if (completedCase.count !== 1) throw new Error('Delivery case changed concurrently')
    await recordDomainEventInTransaction(tx, { eventKey, rooftopId: deal.rooftopId, aggregateType: 'Deal', aggregateId: deal.id, action: 'delivery-completed', topic: 'deal.delivery-completed', actorId: context.session.itemId, afterSnapshot: evidence, payload })
    const current = await authority.context.query.Deal.findOne({ where: { id: deal.id }, query: 'id status updatedAt' })
    return { ...current, reused: false }
  }, { timeout: 30_000, isolationLevel: 'Serializable' })
}

export async function openFinanceFollowUp(_root: unknown, { data }: any, context: any) {
  if (!context.session?.itemId || !permissions.canManageFinancing({ session: context.session })) throw new Error('Financing management permission is required')
  const lead = await context.query.Lead.findOne({ where: { id: String(data.leadId || '') }, query: 'id firstName lastName rooftop { id } tasks(where: { completed: { equals: false } }) { id }' })
  if (!lead?.rooftop?.id) throw new Error('Lead not found or not accessible')
  await assertSessionRooftopPermission(context, lead.rooftop.id, 'canManageFinancing')
  const eventKey = `finance-follow-up:${idempotencyKey(data.idempotencyKey)}`
  const evidence = { leadId: lead.id, priority: 'high', reason: required(data.reason, 'Follow-up reason') }
  const taskId = randomUUID()
  const resolved = await context.transaction(async (tx: any) => {
    await tx.prisma.$queryRaw`SELECT 1 AS "locked" FROM pg_advisory_xact_lock(hashtextextended(${`command:${eventKey}`}, 0))`
    const replay = await tx.prisma.domainAuditEvent.findUnique({ where: { eventKey }, select: { metadata: true } })
    if (replay) {
      const priorTaskId = String((replay.metadata as any)?.taskId || '')
      await recordDomainEventInTransaction(tx, { eventKey, rooftopId: lead.rooftop.id, aggregateType: 'Lead', aggregateId: lead.id, action: 'finance-follow-up-opened', topic: 'financing.follow-up-opened', actorId: context.session.itemId, afterSnapshot: evidence, metadata: { taskId: priorTaskId }, payload: { rooftopId: lead.rooftop.id, leadId: lead.id, taskId: priorTaskId } })
      return { id: priorTaskId, reused: true }
    }
    if (lead.tasks.length) {
      const existingTaskId = lead.tasks[0].id
      await recordDomainEventInTransaction(tx, { eventKey, rooftopId: lead.rooftop.id, aggregateType: 'Lead', aggregateId: lead.id, action: 'finance-follow-up-opened', topic: 'financing.follow-up-opened', actorId: context.session.itemId, afterSnapshot: evidence, metadata: { taskId: existingTaskId }, payload: { rooftopId: lead.rooftop.id, leadId: lead.id, taskId: existingTaskId } })
      return { id: existingTaskId, reused: true }
    }
    const dueDate = new Date(Date.now() + 86_400_000)
    await tx.prisma.task.create({ data: { id: taskId, rooftopId: lead.rooftop.id, leadId: lead.id, title: `F&I follow-up: ${`${lead.firstName || ''} ${lead.lastName || ''}`.trim() || 'Finance applicant'}`, description: evidence.reason, priority: 'high', completed: false, dueDate } })
    await recordDomainEventInTransaction(tx, { eventKey, rooftopId: lead.rooftop.id, aggregateType: 'Lead', aggregateId: lead.id, action: 'finance-follow-up-opened', topic: 'financing.follow-up-opened', actorId: context.session.itemId, afterSnapshot: evidence, metadata: { taskId }, payload: { rooftopId: lead.rooftop.id, leadId: lead.id, taskId } })
    return { id: taskId, reused: false }
  }, { timeout: 30_000 })
  return { id: resolved.id, status: 'open', updatedAt: new Date(), reused: resolved.reused }
}

export async function addServiceOrderLineItem(_root: unknown, { data }: any, context: any) {
  if (!context.session?.itemId || !permissions.canManageService({ session: context.session })) throw new Error('Service management permission is required')
  const order = await context.query.ServiceOrder.findOne({ where: { id: String(data.serviceOrderId || '') }, query: 'id status updatedAt rooftop { id }' })
  if (!order?.rooftop?.id) throw new Error('Service order not found or not accessible')
  await assertSessionRooftopPermission(context, order.rooftop.id, 'canManageService')
  const itemType = String(data.itemType || '')
  if (!['labor', 'part', 'sublet'].includes(itemType)) throw new Error('Service line type must be labor, part, or sublet')
  const description = required(data.description, 'Line description', 500)
  const quantity = Number(data.quantity)
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 10_000) throw new Error('Quantity must be greater than zero')
  const unitPriceCents = cents(data.unitPriceCents, 'Unit price')
  const priceCents = Math.round(unitPriceCents * quantity)
  const costCents = data.costCents == null ? null : cents(data.costCents, 'Line cost')
  if (costCents != null) await assertSessionRooftopPermission(context, order.rooftop.id, 'canViewDealerCost')
  const expectedUpdatedAt = commandDate(data.expectedUpdatedAt)
  const eventKey = `service-line-add:${idempotencyKey(data.idempotencyKey)}`
  const evidence = { serviceOrderId: order.id, itemType, description, partNumber: String(data.partNumber || '').trim().slice(0, 100), quantity, unitPriceCents, priceCents, costCents, expectedUpdatedAt: expectedUpdatedAt.toISOString() }
  const lineId = randomUUID()
  const resolved = await context.transaction(async (tx: any) => {
    await tx.prisma.$queryRaw`SELECT 1 AS "locked" FROM pg_advisory_xact_lock(hashtextextended(${`command:${eventKey}`}, 0))`
    const replay = await tx.prisma.domainAuditEvent.findUnique({ where: { eventKey }, select: { metadata: true } })
    if (replay) {
      const priorLineId = String((replay.metadata as any)?.lineItemId || '')
      await recordDomainEventInTransaction(tx, { eventKey, rooftopId: order.rooftop.id, aggregateType: 'ServiceOrder', aggregateId: order.id, action: 'line-item-added', topic: 'service-order.line-item-added', actorId: context.session.itemId, afterSnapshot: evidence, metadata: { lineItemId: priorLineId }, payload: { rooftopId: order.rooftop.id, serviceOrderId: order.id, lineItemId: priorLineId, priceCents } })
      return { id: priorLineId, reused: true }
    }
    if (!['estimate', 'approved', 'in-progress'].includes(order.status)) throw new Error('Service order lines are locked at completion')
    const current = await tx.prisma.serviceOrder.findUnique({ where: { id: order.id }, select: { updatedAt: true, taxCents: true } })
    if (!current || current.updatedAt.getTime() !== expectedUpdatedAt.getTime()) throw new Error('Service order changed concurrently; reload and retry')
    await tx.prisma.repairOrderLineItem.create({ data: { id: lineId, rooftopId: order.rooftop.id, serviceOrderId: order.id, itemType, description, partNumber: evidence.partNumber, quantity, unitPriceCents, priceCents, costCents } })
    await recomputeServiceOrderTotals(tx, order.id, current.taxCents ?? 0)
    await recordDomainEventInTransaction(tx, { eventKey, rooftopId: order.rooftop.id, aggregateType: 'ServiceOrder', aggregateId: order.id, action: 'line-item-added', topic: 'service-order.line-item-added', actorId: context.session.itemId, afterSnapshot: evidence, metadata: { lineItemId: lineId }, payload: { rooftopId: order.rooftop.id, serviceOrderId: order.id, lineItemId: lineId, priceCents } })
    return { id: lineId, reused: false }
  }, { timeout: 30_000 })
  const current = await context.query.ServiceOrder.findOne({ where: { id: order.id }, query: 'id status updatedAt' })
  return { id: resolved.id, status: current.status, updatedAt: current.updatedAt, reused: resolved.reused }
}
