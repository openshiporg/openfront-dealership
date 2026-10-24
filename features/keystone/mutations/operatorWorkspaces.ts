import { permissions } from '../access'
import { rooftopPermissionAccessFilter } from '../tenancy'
import { calculateDealPrice } from '../lifecycle/dealPricing'
import { currentDealAuthority, financeEvidenceReadiness, lockDeal } from '../lifecycle/dealFinanceEvidence'
import { crmLeadResult, deliveryDealResult, financeApplicationResult, operatorDateFields, serviceOrderResult } from './operatorProjections'

async function financeEvidenceForVisibleDeal(context: any, id: string) {
  // The hints include funding references: ordinary Deal readers do not gain F&I access.
  if (!permissions.canManageFinancing({ session: context.session })) return null
  return context.transaction(async (tx: any) => {
    await lockDeal(tx, id)
    const authority = await currentDealAuthority(tx, context.session, id, ['canManageFinancing'])
    const deal = await tx.prisma.deal.findUnique({ where: { id } })
    if (!deal || deal.rooftopId !== authority.rooftopId) return null
    // Current-purpose hints still are not authority for a later transition.
    return financeEvidenceReadiness(tx, deal)
  }, { timeout: 30_000, isolationLevel: 'Serializable' })
}

function asDate(value: any) { return value ? (value instanceof Date ? value : new Date(value)) : null }

function dealTotalPriceCents(deal: any) {
  return calculateDealPrice(deal).totalPriceCents
}

function page(limitValue: unknown, offsetValue: unknown, max = 100) {
  return { limit: Math.max(1, Math.min(max, Number(limitValue) || 50)), offset: Math.max(0, Math.min(10_000, Number(offsetValue) || 0)) }
}

export async function crmWorkspace(_root: unknown, args: any, context: any) {
  if (!context.session?.itemId || !permissions.canAccessLeads({ session: context.session })) throw new Error('CRM access is required')
  const { limit, offset } = page(args.limit, args.offset)
  const filters: any[] = []
  const status = String(args.status || '').trim()
  const search = String(args.search || '').trim().slice(0, 100)
  if (status && status !== 'all') filters.push({ status: { equals: status } })
  if (search) filters.push({ OR: [{ firstName: { contains: search } }, { lastName: { contains: search } }, { email: { contains: search } }, { phone: { contains: search } }] })
  const rows = await context.query.Lead.findMany({
    where: filters.length ? { AND: filters } : {},
    orderBy: { updatedAt: 'desc' }, take: limit + 1, skip: offset,
    query: 'id firstName lastName email phone source status timeframe assignedAt firstResponseDueAt firstResponseAt lastContact createdAt updatedAt customer { id } assignedSalesperson { id name } interestedVehicle { id year make model }',
  })
  const hasMore = rows.length > limit
  const leads = rows.slice(0, limit).map(crmLeadResult)
  return { leads, summary: { visibleCount: leads.length, newCount: leads.filter((lead: any) => lead.status === 'new').length, overdueCount: leads.filter((lead: any) => lead.firstResponseDueAt && !lead.firstResponseAt && new Date(lead.firstResponseDueAt).getTime() < Date.now()).length }, pageInfo: { limit, offset, hasMore } }
}

export async function dealDeskWorkspace(_root: unknown, args: any, context: any) {
  if (!context.session?.itemId || !permissions.canAccessDeals({ session: context.session })) throw new Error('Deal access is required')
  const { limit, offset } = page(args.limit, args.offset, 100)
  const status = String(args.status || '').trim()
  const rows = await context.query.Deal.findMany({ where: status && status !== 'all' ? { status: { equals: status } } : {}, orderBy: { createdAt: 'desc' }, take: limit + 1, skip: offset, query: 'id status vehiclePriceCents tradeInValueCents taxAmountCents fees products rebates taxLines saleDate createdAt updatedAt salesperson { id name } lead { id firstName lastName status } vehicle { id vin stockNumber year make model trim status priceCents }' })
  const hasMore = rows.length > limit
  const deals = rows.slice(0, limit).map((deal: any) => ({ ...deal, createdAt: asDate(deal.createdAt), updatedAt: asDate(deal.updatedAt), saleDate: asDate(deal.saleDate), totalPriceCents: dealTotalPriceCents(deal) }))
  return { deals, summary: { visibleCount: deals.length, pendingCount: deals.filter((deal: any) => ['pencil', 'submitted'].includes(deal.status)).length, deliveredCount: deals.filter((deal: any) => deal.status === 'delivered').length, totalRevenueCents: deals.filter((deal: any) => deal.status === 'delivered' && deal.saleDate).reduce((total: number, deal: any) => total + (deal.vehiclePriceCents ?? 0), 0) }, pageInfo: { limit, offset, hasMore } }
}

export async function dealWorkspace(_root: unknown, { id }: { id: string }, context: any) {
  if (!context.session?.itemId || !permissions.canAccessDeals({ session: context.session })) throw new Error('Deal access is required')
  const deal = await context.query.Deal.findOne({ where: { id }, query: `id status vehiclePriceCents tradeInValueCents downPaymentCents financingAmountCents monthlyPaymentCents taxAmountCents loanTerm apr fees rebates products taxLines structureType residualValueCents moneyFactorBasisPoints worksheetVersion grossCents presentedSnapshot presentedAt acceptedSnapshot acceptedAt evidenceSnapshot lockedAt saleDate createdAt updatedAt rooftop { id name } vehicle { id vin stockNumber year make model trim exteriorColor status priceCents } lead { id firstName lastName status } salesperson { id name } tradeInVehicle { id year make model offerAmountCents } approvals(orderBy: { approvalDate: desc }) { id decision notes approvalDate approver { id name } }` })
  if (!deal) throw new Error('Deal not found')
  const worksheetEvents = await context.sudo().prisma.domainAuditEvent.findMany({
    where: { rooftopId: deal.rooftop.id, aggregateType: 'Deal', aggregateId: id, action: 'worksheet-saved' },
    orderBy: { occurredAt: 'desc' }, take: 20,
    select: { id: true, afterSnapshot: true, occurredAt: true, actor: { select: { id: true, name: true } } },
  })
  return {
    deal: { ...deal, financeEvidence: await financeEvidenceForVisibleDeal(context, id), totalPriceCents: dealTotalPriceCents(deal), presentedAt: asDate(deal.presentedAt), acceptedAt: asDate(deal.acceptedAt), lockedAt: asDate(deal.lockedAt), saleDate: asDate(deal.saleDate), createdAt: asDate(deal.createdAt), updatedAt: asDate(deal.updatedAt), approvals: deal.approvals.map((approval: any) => ({ ...approval, approvalDate: asDate(approval.approvalDate) })) },
    worksheetVersions: worksheetEvents.map((event: any) => ({ id: event.id, snapshot: event.afterSnapshot, occurredAt: asDate(event.occurredAt), actor: event.actor })),
  }
}

export async function financeWorkspace(_root: unknown, args: any, context: any) {
  if (!context.session?.itemId || !permissions.canManageFinancing({ session: context.session })) throw new Error('Financing management permission is required')
  const { limit, offset } = page(args.limit, args.offset, 50)
  const status = String(args.status || '').trim()
  const rows = await context.query.FinancingApplication.findMany({
    where: status && status !== 'all' ? { status: { equals: status } } : {},
    orderBy: { submittedAt: 'desc' }, take: limit + 1, skip: offset,
    query: `id reference status applicantName applicantEmail applicantPhone employmentStatus annualIncomeCents selfReportedCreditTier requestedAmountCents plannedMonthlyPaymentCents plannedDownPaymentCents tradeInValueCents aprBasisPoints loanTermMonths consentAt submittedAt updatedAt rooftop { id } vehicle { id vin stockNumber year make model priceCents } lead { id firstName lastName email phone status createdAt interestedVehicle { id year make model stockNumber priceCents } tasks(orderBy: { dueDate: asc }) { id title dueDate completed priority } } submissions(orderBy: { queuedAt: desc }) { id providerKey status externalReference responseSummary queuedAt submittedAt } decisions(orderBy: { decidedAt: desc }) { id providerKey decision approvedAmountCents aprBasisPoints termMonths monthlyPaymentCents reasonCodes decidedAt }`,
  })
  const hasMore = rows.length > limit
  const applications = rows.slice(0, limit).map(financeApplicationResult)
  const dealRows = await context.query.Deal.findMany({ orderBy: { createdAt: 'desc' }, take: 100, query: `id worksheetVersion rooftop { id name } vehiclePrice tradeInValue downPayment financingAmount monthlyPayment loanTerm apr taxAmount status totalPrice profit createdAt updatedAt salesperson { id name } lead { id firstName lastName } vehicle { id year make model stockNumber vin purchasePrice } approvals(orderBy: { approvalDate: desc }) { id decision approvalDate notes approver { id name } }` })
  const deals = await Promise.all(dealRows.map(async (deal: any) => ({ ...deal, financeEvidence: await financeEvidenceForVisibleDeal(context, deal.id), createdAt: asDate(deal.createdAt), updatedAt: asDate(deal.updatedAt), approvals: deal.approvals.map((approval: any) => ({ ...approval, approvalDate: asDate(approval.approvalDate) })) })))
  const [products, productQuotes, productCancellations, menus, complianceChecks, contractPackages, fundingCases] = await Promise.all([
    context.query.FinanceProduct.findMany({ where: { active: { equals: true } }, orderBy: { code: 'asc' }, take: 100, query: 'id rooftop { id } code name category providerKey active retailPriceCents costCents updatedAt' }),
    context.query.FinanceProductQuote.findMany({ orderBy: { requestedAt: 'desc' }, take: 100, query: 'id deal { id } product { id code name } providerKey status retailPriceCents evidenceReference requestedAt completedAt' }),
    context.query.FinanceProductCancellation.findMany({ orderBy: { requestedAt: 'desc' }, take: 100, query: 'id deal { id } menu { id } productCode status reason refundCents requestedAt completedAt' }),
    context.query.FinanceMenuVersion.findMany({ orderBy: { presentedAt: 'desc' }, take: 100, query: 'id deal { id } version status optionsSnapshot selectedProductCodes declinedProductCodes disclosureAcknowledgment presentedAt decidedAt' }),
    context.query.FinanceComplianceCheck.findMany({ orderBy: { requestedAt: 'desc' }, take: 100, query: 'id deal { id } checkType providerKey status resultCode requestedAt completedAt' }),
    context.query.FinanceContractPackage.findMany({ orderBy: { updatedAt: 'desc' }, take: 100, query: 'id deal { id } status providerKey envelopeReference requiredDocuments documentChecklist sentAt signedAt lastWebhookAt updatedAt' }),
    context.query.FinanceFundingCase.findMany({ orderBy: { updatedAt: 'desc' }, take: 100, query: 'id deal { id } status checklist exceptions fundingReference fundedAt immutableEvidence updatedAt' }),
  ])
  return { applications, deals,
    products: products.map((row: any) => operatorDateFields(row, ['updatedAt'])),
    productQuotes: productQuotes.map((row: any) => operatorDateFields(row, ['requestedAt', 'completedAt'])),
    productCancellations: productCancellations.map((row: any) => operatorDateFields(row, ['requestedAt', 'completedAt'])),
    menus: menus.map((row: any) => operatorDateFields(row, ['presentedAt', 'decidedAt'])),
    complianceChecks: complianceChecks.map((row: any) => operatorDateFields(row, ['requestedAt', 'completedAt'])),
    contractPackages: contractPackages.map((row: any) => operatorDateFields(row, ['sentAt', 'signedAt', 'lastWebhookAt', 'updatedAt'])),
    fundingCases: fundingCases.map((row: any) => operatorDateFields(row, ['fundedAt', 'updatedAt'])),
    summary: { visibleCount: applications.length, submittedCount: applications.filter((item: any) => item.status === 'submitted').length, reviewCount: applications.filter((item: any) => item.status === 'under-review').length, approvedCount: applications.filter((item: any) => item.status === 'approved').length }, pageInfo: { limit, offset, hasMore } }
}

export async function deliveryWorkspace(_root: unknown, args: any, context: any) {
  if (!context.session?.itemId || !permissions.canAccessDeals({ session: context.session })) throw new Error('Deal access is required')
  const { limit, offset } = page(args.limit, args.offset, 100)
  const rows = await context.query.Deal.findMany({ where: { status: { in: ['financed', 'delivered'] } }, orderBy: { updatedAt: 'asc' }, take: limit + 1, skip: offset, query: 'id status saleDate lockedAt updatedAt vehicle { id vin stockNumber year make model status } lead { id firstName lastName } salesperson { id name }' })
  const hasMore = rows.length > limit
  const deliveries = await Promise.all(rows.slice(0, limit).map(async (row: any) => ({ ...deliveryDealResult(row), financeEvidence: await financeEvidenceForVisibleDeal(context, row.id) })))
  const cases = await context.query.DeliveryCase.findMany({ orderBy: { appointmentAt: 'asc' }, take: 100, query: 'id deal { id } status appointmentAt arrivedAt checklist customerAcknowledgment acknowledgedAt deliverySnapshot updatedAt weOweItems(orderBy: { promisedAt: asc }) { id description status promisedAt owner { id name } estimatedCostCents fulfillmentEvidence customerAcknowledgment fulfilledAt updatedAt }' })
  return { deliveries, cases: cases.map((row: any) => ({
    ...operatorDateFields(row, ['appointmentAt', 'arrivedAt', 'acknowledgedAt', 'updatedAt']),
    weOweItems: row.weOweItems.map((item: any) => operatorDateFields(item, ['promisedAt', 'fulfilledAt', 'updatedAt'])),
  })), summary: { readyCount: deliveries.filter((deal: any) => deal.status === 'financed').length, deliveredCount: deliveries.filter((deal: any) => deal.status === 'delivered').length }, pageInfo: { limit, offset, hasMore } }
}

export async function fixedOpsWorkspace(_root: unknown, args: any, context: any) {
  if (!context.session?.itemId || !permissions.canManageService({ session: context.session })) throw new Error('Service management permission is required')
  const { limit, offset } = page(args.limit, args.offset, 100)
  const orders = await context.query.ServiceOrder.findMany({ orderBy: { updatedAt: 'desc' }, take: limit + 1, skip: offset, query: `id rooftop { id name } status concern cause correction payType authorizationStatus authorizationEvidence inspectionEvidence declinedWork invoiceNumber diagnosis workPerformed recommendations laborTotalCents partsTotalCents taxCents grandTotalCents completedAt settledAt updatedAt appointment { id appointmentDate serviceType customerVehicleDescription assignedTech { id name } lead { id firstName lastName } } laborOperations { id operationCode description status technician { id name } soldHours actualMinutes timePunches startedAt completedAt } lineItems { id itemType description partNumber quantity unitPriceCents priceCents }` })
  const appointments = await context.query.ServiceAppointment.findMany({ orderBy: { appointmentDate: 'asc' }, take: 100, query: 'id appointmentDate serviceType status vehicleVin transportationNeed capacitySlot customerVehicleDescription description estimatedDuration mileageIn advisorNotes rooftop { id } lead { id firstName lastName email phone } assignedTech { id name } serviceOrder { id status grandTotalCents }' })
  const serviceScope = rooftopPermissionAccessFilter(context.session, 'canManageService')
  const serviceRooftops = serviceScope === false ? [] : await context.query.Rooftop.findMany({
    where: serviceScope === true ? { status: { equals: 'active' } } : { AND: [{ status: { equals: 'active' } }, serviceScope] }, orderBy: { name: 'asc' }, take: 100, query: 'id name',
  })
  const parts = await context.query.PartsInventory.findMany({ orderBy: { quantity: 'asc' }, take: 50, query: 'id partNumber description binLocation quantity committedQuantity onOrderQuantity minimumQuantity priceCents supplier' })
  const [partsMovements, purchaseOrders] = await Promise.all([
    context.query.PartsMovement.findMany({ orderBy: { occurredAt: 'desc' }, take: 100, query: 'id part { id partNumber } serviceOrder { id } movementType quantityDelta onHandAfter committedAfter onOrderAfter reference reason occurredAt' }),
    context.query.PartsPurchaseOrder.findMany({ orderBy: { updatedAt: 'desc' }, take: 100, query: 'id reference supplier status lines orderedAt receivedAt updatedAt' }),
  ])
  const hasMore = orders.length > limit
  const projected = orders.slice(0, limit).map(serviceOrderResult)
  const appointmentResults = appointments.map((appointment: any) => ({ ...appointment, appointmentDate: asDate(appointment.appointmentDate) }))
  return { orders: projected, appointments: appointmentResults, parts, serviceRooftops,
    partsMovements: partsMovements.map((row: any) => operatorDateFields(row, ['occurredAt'])),
    purchaseOrders: purchaseOrders.map((row: any) => operatorDateFields(row, ['orderedAt', 'receivedAt', 'updatedAt'])),
    summary: { openOrderCount: projected.filter((order: any) => !['paid'].includes(order.status)).length, awaitingOrderCount: appointmentResults.filter((appointment: any) => !appointment.serviceOrder).length }, pageInfo: { limit, offset, hasMore } }
}
