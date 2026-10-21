import { permissions } from '../access'
import { recordDomainEventInTransaction } from '../lifecycle/domainEvents'
import {
  assertDealTransition,
  buildDealEvidenceSnapshot,
  type DealStatus,
} from '../lifecycle/dealLifecycle'
import { assertSessionRooftopPermission } from '../tenantRecords'
import { domainEventRequestHash } from '../lifecycle/domainEvents'
import { assertAcceptedWorksheet, assertCurrentFunding, assertCurrentSelectedOffer, currentDealAuthority, lockDeal, readLockedFunding, worksheetBinding } from '../lifecycle/dealFinanceEvidence'

function transitionPermissions(session: any) {
  return {
    canManageDeals: permissions.canManageDeals({ session }),
    canApproveDeals: permissions.canApproveDeals({ session }),
    canManageFinancing: permissions.canManageFinancing({ session }),
  }
}

const DEAL_EVIDENCE_QUERY = `
  id status updatedAt lockedAt evidenceSnapshot saleDate worksheetVersion presentedSnapshot presentedAt acceptedSnapshot acceptedAt structureType rebates products taxLines residualValueCents moneyFactorBasisPoints grossCents
  rooftop { id }
  vehiclePrice tradeInValue downPayment financingAmount monthlyPayment loanTerm apr taxAmount fees
  vehiclePriceCents tradeInValueCents downPaymentCents financingAmountCents monthlyPaymentCents taxAmountCents
  lead { id }
  vehicle { id vin stockNumber year make model trim status priceCents }
  selectedLenderDecision { id decision approvedAmountCents aprBasisPoints termMonths monthlyPaymentCents providerKey }
  salesperson { id }
  tradeInVehicle { id }
`

export async function transitionDeal(
  _root: unknown,
  { id, toStatus, notes, idempotencyKey }: { id: string; toStatus: DealStatus; notes?: string | null; idempotencyKey: string },
  context: any
) {
  if (!context.session?.itemId) throw new Error('Authentication required')
  const commandKey = String(idempotencyKey || '').trim()
  if (toStatus === 'delivered') throw new Error('Deal delivery must use completeDealDelivery with checklist evidence')
  if (commandKey.length < 8 || commandKey.length > 200) throw new Error('A valid idempotency key is required')

  return context.transaction(async (transactionContext: any) => {
    await lockDeal(transactionContext, id)
    const authority = await currentDealAuthority(transactionContext, context.session, id, [])
    const sessionContext = authority.context
    const deal = await sessionContext.query.Deal.findOne({
      where: { id },
      query: DEAL_EVIDENCE_QUERY,
    })
    if (!deal) throw new Error('Deal not found or not accessible')

    if (!deal.rooftop?.id) throw new Error('Deal rooftop is missing')
    const requiredPermission = toStatus === 'approved' || deal.status === 'submitted'
      ? 'canApproveDeals'
      : toStatus === 'financed' || ['approved', 'financed'].includes(deal.status)
        ? 'canManageFinancing'
        : 'canManageDeals'
    await assertSessionRooftopPermission(sessionContext, deal.rooftop.id, requiredPermission)
    const rawDeal = await transactionContext.prisma.deal.findUnique({ where: { id } })
    if (!rawDeal || rawDeal.rooftopId !== authority.rooftopId) throw new Error('Deal authority changed')
    const eventKey = `deal-transition:${commandKey}`
    // A committed financing command is history, not NEW financing admission.
    // Authorize current purpose/read scope, inspect only its header first, and
    // match the original caller request without regenerating today's evidence.
    if (toStatus === 'financed') {
      const header = await transactionContext.prisma.domainAuditEvent.findUnique({ where: { eventKey }, select: { actorId: true, rooftopId: true, aggregateType: true, aggregateId: true, action: true } })
      if (header) {
        if (header.actorId !== context.session.itemId || header.rooftopId !== rawDeal.rooftopId || header.aggregateType !== 'Deal' || header.aggregateId !== id || header.action !== 'transitioned:financed') throw new Error('Financing retry is outside original actor/purpose scope')
        const prior = await transactionContext.prisma.domainAuditEvent.findUnique({ where: { eventKey } })
        const original = prior?.afterSnapshot
        const vehicle = await transactionContext.prisma.vehicle.findUnique({ where: { id: rawDeal.vehicleId }, select: { id: true, rooftopId: true } })
        const lead = await transactionContext.prisma.lead.findUnique({ where: { id: rawDeal.leadId }, select: { id: true, rooftopId: true } })
        if (original?.dealId !== id || original.toStatus !== toStatus || original.notes !== String(notes || '').trim() ||
            original.worksheet?.dealId !== id || original.worksheet?.rooftopId !== rawDeal.rooftopId || original.worksheet?.vehicleId !== rawDeal.vehicleId || original.worksheet?.leadId !== rawDeal.leadId ||
            !original.fundingAuthority?.id || !vehicle || !lead || vehicle.rooftopId !== rawDeal.rooftopId || lead.rooftopId !== rawDeal.rooftopId) throw new Error('Financing retry changed or current related identity is unavailable')
        const readback = await sessionContext.db.Deal.findOne({ where: { id } })
        if (!readback) throw new Error('Committed financing readback unavailable in current scope; reconcile the original receipt')
        return readback
      }
    }
    const negotiatedPriceCents = Math.round(Number(deal.vehiclePrice || 0) * 100)
    const retailPriceCents = Number(deal.vehicle?.priceCents || 0)
    const approvalRequirements = {
      managerApproval: true,
      financeApproval: ['finance', 'lease'].includes(deal.structureType),
      seniorApproval: Number(deal.grossCents || 0) < 0 || (retailPriceCents > 0 && negotiatedPriceCents < Math.round(retailPriceCents * 0.9)),
    }
    let fundingAuthority: any = null
    if (toStatus === 'approved') {
      if (approvalRequirements.financeApproval) await assertSessionRooftopPermission(sessionContext, deal.rooftop.id, 'canManageFinancing')
      assertAcceptedWorksheet(rawDeal)
      await assertCurrentSelectedOffer(transactionContext, rawDeal)
      if (approvalRequirements.seniorApproval) await assertSessionRooftopPermission(sessionContext, deal.rooftop.id, 'canManageDealerships')
    }
    if (toStatus === 'financed') {
      const funding = await readLockedFunding(transactionContext, deal.id)
      await assertCurrentFunding(transactionContext, rawDeal, funding)
      fundingAuthority = { id: funding.id, updatedAt: funding.updatedAt.toISOString(), fundingReference: funding.fundingReference, evidenceHash: domainEventRequestHash(funding.immutableEvidence) }
    }
    const requestEvidence = { dealId: id, toStatus, notes: String(notes || '').trim(), approvalRequirements,
      worksheet: worksheetBinding(rawDeal), acceptedHash: domainEventRequestHash(rawDeal.acceptedSnapshot), fundingAuthority }
    const replay = await transactionContext.prisma.domainAuditEvent.findUnique({ where: { eventKey }, select: { aggregateId: true } })
    if (replay) {
      if (replay.aggregateId !== id) throw new Error('Deal transition idempotency key belongs to another deal')
      await recordDomainEventInTransaction(transactionContext, {
        eventKey,
        rooftopId: deal.rooftop.id,
        aggregateType: 'Deal',
        aggregateId: id,
        action: `transitioned:${toStatus}`,
        topic: 'deal.transitioned',
        actorId: context.session.itemId,
        afterSnapshot: requestEvidence,
        payload: {
          dealId: id, rooftopId: deal.rooftop.id, status: toStatus, vehicleId: deal.vehicle?.id ?? null,
          vehicleStatus: toStatus === 'submitted' ? 'pending' : toStatus === 'cancelled' && deal.status !== 'pencil' ? 'available' : null,
        },
      })
      return sessionContext.db.Deal.findOne({ where: { id } })
    }
    assertDealTransition(deal.status, toStatus, transitionPermissions(sessionContext.session))

    const now = new Date()
    const update: Record<string, unknown> = { status: toStatus }
    if (toStatus === 'submitted') {
      if (!deal.vehicle?.id) throw new Error('A vehicle is required before deal submission')
      if (!deal.acceptedAt || !deal.acceptedSnapshot || Object.keys(deal.acceptedSnapshot).length === 0) throw new Error('Accepted worksheet evidence is required before submission')
      if (Number(deal.acceptedSnapshot.worksheetVersion || 0) !== Number(deal.worksheetVersion || 0)) throw new Error('The current worksheet version must be presented and accepted before submission')
      const vehicleState = await transactionContext.prisma.vehicle.findUnique({ where: { id: deal.vehicle.id }, select: { status: true } })
      if (vehicleState?.status === 'available') {
        const reserved = await transactionContext.prisma.vehicle.updateMany({ where: { id: deal.vehicle.id, status: 'available' }, data: { status: 'pending' } })
        if (reserved.count !== 1) throw new Error('Vehicle is no longer available for this deal')
      } else if (vehicleState?.status === 'pending') {
        const competing = await transactionContext.prisma.deal.count({ where: { id: { not: deal.id }, vehicleId: deal.vehicle.id, status: { in: ['submitted', 'approved', 'financed'] } } })
        if (competing > 0) throw new Error('Vehicle is reserved by another active deal')
      } else {
        throw new Error('Vehicle is no longer available for this deal')
      }
      update.lockedAt = now
      update.evidenceSnapshot = buildDealEvidenceSnapshot(deal)
    }
    const changed = await transactionContext.prisma.deal.updateMany({
      where: { id, rooftopId: authority.rooftopId, worksheetVersion: rawDeal.worksheetVersion, status: deal.status, updatedAt: new Date(deal.updatedAt) },
      data: update,
    })
    if (changed.count !== 1) throw new Error('Deal changed concurrently; reload before retrying')

    const decision = toStatus === 'submitted'
      ? 'pending'
      : toStatus === 'approved'
        ? 'approved'
        : deal.status === 'submitted' && toStatus === 'cancelled'
          ? 'rejected'
          : null

    if (decision) {
      await transactionContext.prisma.dealApproval.create({
        data: {
          rooftopId: deal.rooftop.id,
          dealId: id,
          approverId: context.session.itemId,
          decision,
          notes: String(notes || '').trim(),
          approvalDate: now,
        },
      })
    }

    if (toStatus === 'cancelled' && deal.status !== 'pencil' && deal.vehicle?.id) {
      const released = await transactionContext.prisma.vehicle.updateMany({
        where: { id: deal.vehicle.id, status: 'pending' },
        data: { status: 'available' },
      })
      if (released.count !== 1) throw new Error('Reserved vehicle could not be released')
    }

    await recordDomainEventInTransaction(transactionContext, {
      eventKey,
      rooftopId: deal.rooftop.id,
      aggregateType: 'Deal',
      aggregateId: id,
      action: `transitioned:${toStatus}`,
      topic: 'deal.transitioned',
      actorId: context.session.itemId,
      afterSnapshot: requestEvidence,
      payload: {
        dealId: id, rooftopId: deal.rooftop.id, status: toStatus, vehicleId: deal.vehicle?.id ?? null,
        vehicleStatus: toStatus === 'submitted' ? 'pending' : toStatus === 'cancelled' && deal.status !== 'pencil' ? 'available' : null,
      },
    })

    return sessionContext.db.Deal.findOne({ where: { id } })
  }, { timeout: 30_000, isolationLevel: 'Serializable' })
}
