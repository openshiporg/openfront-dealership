import { permissions } from '../access'
import { assertSessionRooftopPermission, assertUserRooftopAccess } from '../tenantRecords'
import { domainEventRequestHash, recordDomainEventInTransaction, stableJson } from '../lifecycle/domainEvents'
import { assertCurrentFunding, currentDealAuthority, lockDeal, readLockedFunding, worksheetBinding } from '../lifecycle/dealFinanceEvidence'
import { operatorCommand } from './operatorCommandErrors'
const req=(v:any,n:string,max=1000)=>{const s=String(v||'').trim();if(!s||s.length>max)throw new Error(`${n} is required`);return s}
const ik=(v:any)=>req(v,'Idempotency key',200)
// Recorded by staff at delivery. Funding is not one of them: it comes from the funding case
// (funded, or payment received on a cash sale) and is attached when the customer acknowledges.
const deliveryChecklistCodes = new Set(['identity', 'insurance', 'registration', 'title-handoff'])
const requiredDeliveryChecklist = ['identity', 'insurance', 'registration', 'title-handoff']

function mergeSingleDeliveryChecklistEntry(existing: unknown, incoming: unknown) {
  if (!Array.isArray(incoming) || incoming.length !== 1) {
    throw new Error('Exactly one delivery checklist item is required')
  }

  const raw = incoming[0]
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('A delivery checklist item is required')
  }

  const item = raw as any
  const code = req(item.code, 'Checklist code', 80)
  const status = req(item.status, 'Checklist status', 30)
  const evidenceReference = req(item.evidenceReference, 'Checklist evidence reference', 200)
  if (code === 'funding') throw new Error('Funding comes from the finance desk and is not recorded here')
  if (!deliveryChecklistCodes.has(code)) throw new Error('Invalid delivery checklist item')
  if (!['complete', 'waived'].includes(status)) throw new Error('Delivery checklist status must be complete or waived')

  const prior = Array.isArray(existing) ? existing as any[] : []
  return [...prior.filter(value => value?.code !== code), { code, status, evidenceReference }]
}

async function deliveryDeal(context:any,id:any){if(!context.session?.itemId||!permissions.canAccessDeals({session:context.session})||!permissions.canManageDeals({session:context.session}))throw new Error('Deal management permission is required');const deal=await context.query.Deal.findOne({where:{id:String(id||'')},query:'id status rooftop { id } vehicle { id vin stockNumber } lead { id customer { id } }'});if(!deal?.rooftop?.id||!['financed','delivered'].includes(deal.status))throw new Error('Financed deal not found or accessible');await assertSessionRooftopPermission(context,deal.rooftop.id,'canManageDeals');return deal}
async function manageDeliveryCaseCommand(_r: unknown, { data }: any, context: any) {
  const visible = await deliveryDeal(context, data.dealId)
  const action = req(data.action, 'Delivery action', 40)
  if (!['schedule', 'arrive', 'record-checklist', 'acknowledge', 'cancel'].includes(action)) throw new Error('Invalid delivery action')
  if (action === 'record-checklist') mergeSingleDeliveryChecklistEntry([], data.checklist)
  const eventKey = `delivery-case:${ik(data.idempotencyKey)}`
  const request = { ...data, dealId: visible.id, idempotencyKey: undefined }
  return context.transaction(async (tx: any) => {
    await lockDeal(tx, visible.id)
    const authority = await currentDealAuthority(tx, context.session, visible.id, ['canManageDeals'])
    const deal = await tx.prisma.deal.findUnique({ where: { id: visible.id } })
    if (!deal || deal.rooftopId !== authority.rooftopId) throw new Error('Deal authority changed')
    const binding = { ...worksheetBinding(deal), acceptedHash: domainEventRequestHash(deal.acceptedSnapshot) }
    const existing = await tx.prisma.deliveryCase.findFirst({ where: { dealId: deal.id, rooftopId: deal.rooftopId } })
    const payload = (status: string) => ({ rooftopId: deal.rooftopId, dealId: deal.id, status })
    const prior = await tx.prisma.domainAuditEvent.findUnique({ where: { eventKey } })
    if (prior) {
      if (!existing || stableJson(prior.afterSnapshot?.request) !== stableJson(request) || stableJson(prior.afterSnapshot?.binding) !== stableJson(binding)) throw new Error('Delivery case retry is changed or superseded')
      await recordDomainEventInTransaction(tx, { eventKey, rooftopId: deal.rooftopId, aggregateType: 'DeliveryCase', aggregateId: deal.id, action, topic: 'delivery-case.updated', actorId: context.session.itemId, afterSnapshot: prior.afterSnapshot, payload: payload(prior.afterSnapshot.status) })
      return authority.context.db.DeliveryCase.findOne({ where: { id: existing.id } })
    }
    // Terminal cases cannot be re-scheduled/re-acknowledged after a handoff.
    if (deal.status !== 'financed' || existing?.status === 'delivered') throw new Error('Only active financed delivery cases can be changed')
    const now = new Date()
    let status = existing?.status || 'scheduled'
    let appointmentAt = existing?.appointmentAt || null
    let arrivedAt = existing?.arrivedAt || null
    let checklist: any[] = Array.isArray(existing?.checklist) ? existing.checklist : []
    let customerAcknowledgment = existing?.customerAcknowledgment || ''
    let acknowledgedAt = existing?.acknowledgedAt || null
    if (action === 'schedule') {
      appointmentAt = new Date(String(data.appointmentAt || ''))
      if (Number.isNaN(appointmentAt.getTime()) || appointmentAt.getTime() < Date.now() - 300000) throw new Error('Valid future delivery appointment is required')
      status = 'scheduled'; acknowledgedAt = null; customerAcknowledgment = ''
    }
    if (action === 'arrive') {
      if (existing?.status !== 'scheduled') throw new Error('Scheduled delivery is required before arrival')
      status = 'arrived'; arrivedAt = now
    }
    if (action === 'record-checklist') {
      if (!['scheduled', 'arrived', 'ready'].includes(existing?.status)) throw new Error('Active delivery case is required')
      checklist = mergeSingleDeliveryChecklistEntry(checklist, data.checklist)
      status = existing?.status === 'arrived' ? 'arrived' : 'scheduled'
      acknowledgedAt = null; customerAcknowledgment = ''
    }
    if (action === 'acknowledge') {
      if (!['scheduled', 'arrived', 'ready'].includes(existing?.status)) throw new Error('Active delivery case is required')
      const missing = requiredDeliveryChecklist.find(code => !checklist.some(x => x.code === code && ['complete', 'waived'].includes(x.status) && String(x.evidenceReference || '').trim()))
      if (missing) throw new Error(`Record the ${missing.replace('-', ' ')} checklist item first`)
      // Derive the funding item from the current funding case instead of asking staff to re-enter it.
      const funding = await readLockedFunding(tx, deal.id)
      try { await assertCurrentFunding(tx, deal, funding) } catch { throw new Error('Funding is not current for this worksheet; confirm funding or payment on the finance desk first') }
      checklist = [...checklist.filter(x => x?.code !== 'funding'), { code: 'funding', status: 'complete', evidenceReference: String(funding.fundingReference), source: 'funding-case', fundingCaseId: funding.id }]
      customerAcknowledgment = req(data.customerAcknowledgment, 'Customer acknowledgment')
      acknowledgedAt = now; status = 'ready'
    }
    if (action === 'cancel') {
      if (!existing) throw new Error('Delivery case is required')
      if (existing.status === 'cancelled') throw new Error('Delivery is already cancelled')
      req(data.reason, 'Cancellation reason', 500)
      status = 'cancelled'; acknowledgedAt = null; customerAcknowledgment = ''
    }
    const evidence = { version: 2, request, binding, dealId: deal.id, action, status,
      appointmentAt: appointmentAt?.toISOString() || null, arrivedAt: arrivedAt?.toISOString() || null,
      checklist, customerAcknowledgment: customerAcknowledgment || null, acknowledgedAt: acknowledgedAt?.toISOString() || null }
    const values = { status, appointmentAt, arrivedAt, checklist, customerAcknowledgment, acknowledgedAt, deliverySnapshot: evidence }
    const saved = existing
      ? await tx.prisma.deliveryCase.update({ where: { id: existing.id }, data: values, select: { id: true } })
      : await tx.prisma.deliveryCase.create({ data: { ...values, rooftopId: deal.rooftopId, dealId: deal.id, idempotencyKey: ik(data.idempotencyKey) }, select: { id: true } })
    await recordDomainEventInTransaction(tx, { eventKey, rooftopId: deal.rooftopId, aggregateType: 'DeliveryCase', aggregateId: deal.id, action, topic: 'delivery-case.updated', actorId: context.session.itemId, afterSnapshot: evidence, payload: payload(status) })
    return authority.context.db.DeliveryCase.findOne({ where: { id: saved.id } })
  }, { timeout: 30_000, isolationLevel: 'Serializable' })
}
async function manageWeOweItemCommand(_r: unknown, { data }: any, context: any) {
  const deal = await deliveryDeal(context, data.dealId)
  const action = req(data.action, 'We-owe action', 30)
  if (!['create', 'update', 'fulfill', 'waive'].includes(action)) throw new Error('Invalid we-owe action')
  const delivery = await context.sudo().prisma.deliveryCase.findFirst({ where: { dealId: deal.id }, select: { id: true } })
  if (!delivery) throw new Error('Delivery case is required')
  const existing = data.itemId ? await context.sudo().prisma.weOweItem.findFirst({ where: { id: String(data.itemId), deliveryCaseId: delivery.id } }) : null
  let status = existing?.status || 'open'
  let description = existing?.description || ''
  let promisedAt: Date | null = existing?.promisedAt || null
  let ownerId: string | null = existing?.ownerId || null
  let estimatedCostCents: number = existing?.estimatedCostCents || 0
  let fulfillmentEvidence = existing?.fulfillmentEvidence || ''
  let customerAcknowledgment = existing?.customerAcknowledgment || ''
  let fulfilledAt: Date | null = existing?.fulfilledAt || null
  const assignOwner = async (value: unknown) => {
    const id = req(value, 'Owner ID', 100)
    const owner = await context.query.User.findOne({ where: { id }, query: 'id' })
    if (!owner) throw new Error('Owner is not accessible')
    await assertUserRooftopAccess(context, id, deal.rooftop.id)
    return id
  }
  const readCost = (value: unknown) => {
    const cost = Number(value || 0)
    if (!Number.isInteger(cost) || cost < 0 || cost > 2_147_483_647) throw new Error('Estimated cost is invalid')
    return cost
  }
  const readPromisedAt = (value: unknown) => {
    const date = new Date(String(value || ''))
    if (Number.isNaN(date.getTime())) throw new Error('Promised date is invalid')
    return date
  }
  if (action === 'create') {
    description = req(data.description, 'Description')
    promisedAt = readPromisedAt(data.promisedAt)
    ownerId = await assignOwner(data.ownerId)
    estimatedCostCents = readCost(data.estimatedCostCents)
  } else if (action === 'update') {
    // Owner, cost and promised date can be corrected while the promise is open.
    if (!existing || existing.status !== 'open') throw new Error('Open we-owe item is required')
    if (data.ownerId == null && data.estimatedCostCents == null && data.promisedAt == null) throw new Error('Nothing to update')
    if (data.ownerId != null) ownerId = await assignOwner(data.ownerId)
    if (data.estimatedCostCents != null) estimatedCostCents = readCost(data.estimatedCostCents)
    if (data.promisedAt != null) promisedAt = readPromisedAt(data.promisedAt)
  } else {
    if (!existing || existing.status !== 'open') throw new Error('Open we-owe item is required')
    status = action === 'fulfill' ? 'fulfilled' : 'waived'
    fulfillmentEvidence = req(data.fulfillmentEvidence, 'Fulfillment evidence')
    customerAcknowledgment = req(data.customerAcknowledgment, 'Customer acknowledgment')
    fulfilledAt = new Date()
  }
  const eventKey = `we-owe:${ik(data.idempotencyKey)}`
  const evidence = { dealId: deal.id, deliveryCaseId: delivery.id, itemId: existing?.id || null, action, status, description, promisedAt: promisedAt?.toISOString(), ownerId, estimatedCostCents, fulfillmentEvidence: fulfillmentEvidence || null, customerAcknowledgment: customerAcknowledgment || null, fulfilledAt: fulfilledAt?.toISOString() || null }
  const id = await context.transaction(async (tx: any) => {
    await tx.prisma.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${eventKey},0))`
    const recorded = await recordDomainEventInTransaction(tx, { eventKey, rooftopId: deal.rooftop.id, aggregateType: 'WeOweItem', aggregateId: existing?.id || deal.id, action, topic: 'we-owe.updated', actorId: context.session.itemId, afterSnapshot: evidence, payload: { rooftopId: deal.rooftop.id, dealId: deal.id, status } })
    if (recorded.reused) {
      const found = await tx.prisma.weOweItem.findUnique({ where: { idempotencyKey: ik(data.idempotencyKey) }, select: { id: true } })
      if (found) return found.id
      if (existing) return existing.id
      throw new Error('We-owe replay missing')
    }
    const values = { status, description, promisedAt, ownerId, estimatedCostCents, fulfillmentEvidence, customerAcknowledgment, fulfilledAt }
    if (existing) {
      const changed = await tx.prisma.weOweItem.updateMany({ where: { id: existing.id, status: 'open', updatedAt: existing.updatedAt }, data: values })
      if (changed.count !== 1) throw new Error('We-owe item changed concurrently; reload and retry')
      return existing.id
    }
    return (await tx.prisma.weOweItem.create({ data: { ...values, rooftopId: deal.rooftop.id, deliveryCaseId: delivery.id, idempotencyKey: ik(data.idempotencyKey) }, select: { id: true } })).id
  }, { timeout: 30000 })
  return context.db.WeOweItem.findOne({ where: { id } })
}

export const manageDeliveryCase = operatorCommand(manageDeliveryCaseCommand)
export const manageWeOweItem = operatorCommand(manageWeOweItemCommand)
