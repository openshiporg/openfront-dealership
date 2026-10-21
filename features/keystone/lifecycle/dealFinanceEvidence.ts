import { domainEventRequestHash, stableJson } from './domainEvents'
import { calculateDealPrice } from './dealPricing'
import { buildDealEvidenceSnapshot } from './dealLifecycle'
import { assertSessionRooftopPermission } from '../tenantRecords'
import { assertReviewedPrerequisites, prerequisiteReadiness } from './financePrerequisites'

// Reuse the existing audit/JSON evidence stores; no historical rows are backfilled.
// Old unbound evidence stays readable but must be explicitly reconfirmed.
const TERM_FIELDS = [
  'vehiclePriceCents', 'tradeInValueCents', 'downPaymentCents', 'financingAmountCents',
  'monthlyPaymentCents', 'taxAmountCents', 'loanTerm', 'apr', 'residualValueCents',
  'moneyFactorBasisPoints', 'fees', 'rebates', 'products', 'taxLines', 'grossCents',
] as const

export function worksheetTerms(deal: any) {
  return Object.fromEntries(TERM_FIELDS.map(field => [field, deal[field] ?? null]))
}

export function worksheetBinding(deal: any) {
  const identity = {
    dealId: deal.id, rooftopId: deal.rooftopId, vehicleId: deal.vehicleId,
    leadId: deal.leadId, tradeInVehicleId: deal.tradeInVehicleId ?? null,
    worksheetVersion: deal.worksheetVersion, structureType: deal.structureType,
  }
  return { ...identity, worksheetHash: domainEventRequestHash({ ...identity, terms: worksheetTerms(deal) }) }
}

export function assertAcceptedWorksheet(deal: any) {
  const presented = deal.presentedSnapshot
  const accepted = deal.acceptedSnapshot
  const submitted = deal.evidenceSnapshot
  const expectedSubmitted = buildDealEvidenceSnapshot({ ...deal,
    lead: deal.leadId ? { id: deal.leadId } : null,
    vehicle: submitted?.vehicle, // Keep original vehicle description; identity is checked below.
    salesperson: deal.salespersonId ? { id: deal.salespersonId } : null,
    tradeInVehicle: deal.tradeInVehicleId ? { id: deal.tradeInVehicleId } : null,
    selectedLenderDecision: deal.selectedLenderDecisionId ? { id: deal.selectedLenderDecisionId } : null,
  })
  if (!deal.presentedAt || !deal.acceptedAt || !deal.lockedAt || deal.worksheetVersion < 1 ||
      presented?.dealId !== deal.id || accepted?.dealId !== deal.id ||
      presented?.worksheetVersion !== deal.worksheetVersion || accepted?.worksheetVersion !== deal.worksheetVersion ||
      submitted?.worksheetVersion !== deal.worksheetVersion ||
      presented?.structureType !== deal.structureType || submitted?.structureType !== deal.structureType ||
      presented?.vehicleId !== deal.vehicleId || presented?.leadId !== deal.leadId ||
      submitted?.vehicle?.id !== deal.vehicleId || submitted?.leadId !== deal.leadId ||
      stableJson(worksheetTerms(presented?.terms || {})) !== stableJson(worksheetTerms(deal)) ||
      stableJson(submitted) !== stableJson(expectedSubmitted) ||
      stableJson(presented?.pricing) !== stableJson(calculateDealPrice(deal)) ||
      stableJson(submitted?.pricing) !== stableJson(calculateDealPrice(deal)) ||
      stableJson(accepted?.presentedSnapshot) !== stableJson(presented)) {
    throw new Error('Current presented, accepted, and submitted worksheet evidence is required; reopen and reconfirm')
  }
}

// All funding writers and delivery/transition readers take this same root row lock.
// Worksheet CAS writes also conflict with this row lock. Event-key locks alone do not.
export async function lockDeal(tx: any, dealId: string) {
  await tx.prisma.$queryRaw`SELECT "id" FROM "Deal" WHERE "id" = ${dealId} FOR UPDATE`
}

export async function currentDealAuthority(tx: any, session: any, dealId: string, required: string[]) {
  if (!session?.itemId || session.listKey !== 'User') throw new Error('Authentication required')
  const user = await tx.prisma.user.findUnique({ where: { id: session.itemId }, include: {
    role: true,
    dealerGroupMemberships: { include: { role: true, dealerGroup: { select: { id: true } } } },
    rooftopMemberships: { include: { role: true, rooftop: { include: { dealerGroup: { select: { id: true } } } } } },
  } })
  if (!user) throw new Error('Current actor is unavailable')
  const current = tx.withSession({ ...session, data: { ...session.data, ...user } })
  const visible = await current.query.Deal.findOne({ where: { id: dealId }, query: 'id rooftop { id }' })
  if (!visible?.rooftop?.id) throw new Error('Deal not found or not accessible')
  for (const permission of required) await assertSessionRooftopPermission(current, visible.rooftop.id, permission)
  return { context: current, rooftopId: visible.rooftop.id }
}

export async function readLockedFunding(tx: any, dealId: string) {
  await tx.prisma.$queryRaw`SELECT "id" FROM "FinanceFundingCase" WHERE "deal" = ${dealId} FOR UPDATE`
  return tx.prisma.financeFundingCase.findFirst({ where: { dealId } })
}

export async function assertCurrentSelectedOffer(tx: any, deal: any) {
  if (deal.structureType === 'cash') return null
  if (!deal.selectedLenderDecisionId) throw new Error('Select and reconfirm a lender offer for the current worksheet')
  const decision = await tx.prisma.lenderDecision.findUnique({ where: { id: deal.selectedLenderDecisionId }, include: { application: { select: { id: true, leadId: true, rooftopId: true } } } })
  if (!decision || decision.rooftopId !== deal.rooftopId || decision.application?.rooftopId !== deal.rooftopId || decision.application?.leadId !== deal.leadId ||
      !['approved', 'conditional'].includes(decision.decision) || Number(decision.approvedAmountCents || 0) < Number(deal.financingAmountCents || 0)) {
    throw new Error('Selected lender offer no longer covers the current worksheet or authority')
  }
  const event = await tx.prisma.domainAuditEvent.findFirst({
    where: { rooftopId: deal.rooftopId, aggregateType: 'Deal', aggregateId: deal.id, action: 'lender-offer-selected' },
    orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
  })
  if (event?.afterSnapshot?.lenderDecisionId !== decision.id ||
      stableJson(event?.afterSnapshot?.binding) !== stableJson(worksheetBinding(deal))) {
    throw new Error('Selected lender evidence is unbound or stale; reconfirm it for the current worksheet')
  }
  // Term/APR equality and conditional-offer satisfaction are lender policy, not inferred here.
  return event.eventKey as string
}

export async function fundingBinding(tx: any, deal: any) {
  assertAcceptedWorksheet(deal)
  const [vehicle, lead] = await Promise.all([
    tx.prisma.vehicle.findUnique({ where: { id: deal.vehicleId }, select: { id: true, rooftopId: true } }),
    tx.prisma.lead.findUnique({ where: { id: deal.leadId }, select: { id: true, rooftopId: true } }),
  ])
  if (vehicle?.id !== deal.vehicleId || vehicle?.rooftopId !== deal.rooftopId || lead?.id !== deal.leadId || lead?.rooftopId !== deal.rooftopId) throw new Error('Current financing deal/vehicle/lead parent authority changed')
  const selectionEventKey = await assertCurrentSelectedOffer(tx, deal)
  return { ...worksheetBinding(deal), selectedLenderDecisionId: deal.selectedLenderDecisionId ?? null,
    selectionEventKey, acceptedHash: domainEventRequestHash(deal.acceptedSnapshot),
    submittedHash: domainEventRequestHash(deal.evidenceSnapshot) }
}

export async function assertCurrentFunding(tx: any, deal: any, funding: any, currentPrerequisites = true) {
  const binding = await fundingBinding(tx, deal)
  if (!funding || funding.dealId !== deal.id || funding.rooftopId !== deal.rooftopId ||
      funding.status !== 'funded' || !String(funding.fundingReference || '').trim() || !funding.fundedAt ||
      funding.immutableEvidence?.version !== 2 || stableJson(funding.immutableEvidence?.binding) !== stableJson(binding) ||
      funding.immutableEvidence?.status !== 'funded' || funding.immutableEvidence?.fundedAt !== funding.fundedAt.toISOString() ||
      funding.immutableEvidence?.fundingReference !== funding.fundingReference) {
    throw new Error('Current worksheet-bound funded evidence and reference are required; reconfirm funding')
  }
  if (currentPrerequisites) {
    if (!funding.immutableEvidence.prerequisites?.reviewEventKey) throw new Error('Historical funding prerequisites are unbound; explicitly review and reconfirm')
    await assertReviewedPrerequisites(tx, deal, funding.immutableEvidence.prerequisites)
  }
  return binding
}

export async function financeEvidenceReadiness(tx: any, deal: any) {
  const funding = await tx.prisma.financeFundingCase.findFirst({ where: { dealId: deal.id, rooftopId: deal.rooftopId } })
  let selectedOfferCurrent = deal.structureType === 'cash'
  let fundingCurrent = false
  let issue: string | null = null
  try { await assertCurrentSelectedOffer(tx, deal); selectedOfferCurrent = true } catch (error) { issue = (error as Error).message }
  try { await assertCurrentFunding(tx, deal, funding); fundingCurrent = true } catch (error) { issue ||= (error as Error).message }
  return { worksheetVersion: deal.worksheetVersion, selectedOfferCurrent, fundingCurrent,
    fundingStatus: funding?.status ?? null, fundingReference: funding?.fundingReference ?? null,
    fundingUpdatedAt: funding?.updatedAt?.toISOString() ?? null,
    fundingWorksheetVersion: funding?.immutableEvidence?.binding?.worksheetVersion ?? null,
    prerequisites: await prerequisiteReadiness(tx, deal), issue }
}
