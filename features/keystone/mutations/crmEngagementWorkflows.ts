import { randomUUID } from 'node:crypto'

import { permissions } from '../access'
import { domainEventRequestHash, recordDomainEventInTransaction } from '../lifecycle/domainEvents'
import { assertSessionRooftopPermission, assertUserRooftopAccess } from '../tenantRecords'

type CadenceStep = { step: string; channel: 'email' | 'sms' | 'phone'; delayMinutes: number; taskTitle: string }

const CADENCES: Record<string, CadenceStep[]> = {
  'internet-lead-first-response': [
    { step: 'initial-response', channel: 'email', delayMinutes: 0, taskTitle: 'Respond to internet lead' },
    { step: 'two-hour-call', channel: 'phone', delayMinutes: 120, taskTitle: 'Call internet lead' },
    { step: 'day-one-text', channel: 'sms', delayMinutes: 1440, taskTitle: 'Send day-one internet lead follow-up' },
  ],
  'showroom-follow-up': [
    { step: 'post-visit-call', channel: 'phone', delayMinutes: 60, taskTitle: 'Follow up after showroom visit' },
    { step: 'day-one-email', channel: 'email', delayMinutes: 1440, taskTitle: 'Send showroom follow-up recap' },
  ],
  'unsold-follow-up': [
    { step: 'unsold-day-one', channel: 'sms', delayMinutes: 1440, taskTitle: 'Follow up with unsold customer' },
    { step: 'unsold-day-three', channel: 'phone', delayMinutes: 4320, taskTitle: 'Call unsold customer' },
  ],
}

function requireManager(context: any) {
  if (!context.session?.itemId || !permissions.canManageLeads({ session: context.session })) throw new Error('Lead management permission is required')
}

function text(value: unknown, label: string, max = 1000) {
  const result = String(value || '').trim()
  if (!result || result.length > max) throw new Error(`${label} is required and must be at most ${max} characters`)
  return result
}

function key(value: unknown) {
  const result = String(value || '').trim()
  if (result.length < 8 || result.length > 180) throw new Error('A valid idempotency key is required')
  return result
}

function date(value: unknown, label: string) {
  const result = value instanceof Date ? value : new Date(String(value || ''))
  if (Number.isNaN(result.getTime())) throw new Error(`${label} is invalid`)
  return result
}

async function lockAndReplay(tx: any, eventKey: string) {
  await tx.prisma.$queryRaw`SELECT 1 AS "locked" FROM pg_advisory_xact_lock(hashtextextended(${`command:${eventKey}`}, 0))`
  return tx.prisma.domainAuditEvent.findUnique({ where: { eventKey }, select: { aggregateId: true, afterSnapshot: true, metadata: true } })
}

export async function updateCustomerCommunicationPreferences(_root: unknown, { data }: any, context: any) {
  requireManager(context)
  const customerId = String(data.customerId || '')
  const expectedUpdatedAt = date(data.expectedUpdatedAt, 'Customer expectedUpdatedAt')
  const source = text(data.source, 'Preference source', 120)
  const reason = text(data.reason, 'Preference reason', 1000)
  const preferredChannel = String(data.preferredChannel || 'none')
  if (!['email', 'sms', 'phone', 'none'].includes(preferredChannel)) throw new Error('Preferred channel is invalid')
  const snapshot = {
    emailConsent: data.emailConsent === true,
    smsConsent: data.smsConsent === true,
    phoneConsent: data.phoneConsent === true,
    emailSuppressed: data.emailSuppressed === true,
    smsSuppressed: data.smsSuppressed === true,
    phoneSuppressed: data.phoneSuppressed === true,
    preferredChannel,
    source,
    reason,
  }
  const channelAllowed = preferredChannel === 'none' || (snapshot as any)[`${preferredChannel}Consent`] && !(snapshot as any)[`${preferredChannel}Suppressed`]
  if (!channelAllowed) throw new Error('Preferred channel must have affirmative consent and must not be suppressed')
  const eventKey = `customer-contact-preference:${key(data.idempotencyKey)}`
  const visible = await context.query.Customer.findOne({ where: { id: customerId }, query: 'id rooftop { id } status' })
  if (!visible?.rooftop?.id || visible.status !== 'active') throw new Error('Customer not found or not accessible')
  await assertSessionRooftopPermission(context, visible.rooftop.id, 'canManageLeads')

  return context.transaction(async (tx: any) => {
    const replay = await lockAndReplay(tx, eventKey)
    if (replay) {
      await recordDomainEventInTransaction(tx, {
        eventKey, rooftopId: visible.rooftop.id, aggregateType: 'Customer', aggregateId: customerId,
        action: 'contact-preferences-updated', topic: 'customer.contact-preferences-updated', actorId: context.session.itemId,
        afterSnapshot: { customerId, expectedUpdatedAt: expectedUpdatedAt.toISOString(), ...snapshot }, metadata: replay.metadata,
        payload: { customerId, rooftopId: visible.rooftop.id, preferredChannel },
      })
      return { id: customerId, status: preferredChannel, updatedAt: new Date(), reused: true }
    }
    const now = new Date()
    const changed = await tx.prisma.customer.updateMany({
      where: { id: customerId, rooftopId: visible.rooftop.id, status: 'active', updatedAt: expectedUpdatedAt },
      data: {
        emailConsent: snapshot.emailConsent, smsConsent: snapshot.smsConsent, phoneConsent: snapshot.phoneConsent,
        emailSuppressed: snapshot.emailSuppressed, smsSuppressed: snapshot.smsSuppressed, phoneSuppressed: snapshot.phoneSuppressed,
        preferredChannel, contactPreferenceUpdatedAt: now,
        suppressionReason: snapshot.emailSuppressed || snapshot.smsSuppressed || snapshot.phoneSuppressed ? reason : '',
        suppressionSource: snapshot.emailSuppressed || snapshot.smsSuppressed || snapshot.phoneSuppressed ? source : '',
      },
    })
    if (changed.count !== 1) throw new Error('Customer changed concurrently; reload and retry')
    const preferenceEvent = await tx.prisma.customerContactPreferenceEvent.create({
      data: { rooftopId: visible.rooftop.id, customerId, actorId: context.session.itemId, source, reason, occurredAt: now, preferenceSnapshot: snapshot },
      select: { id: true },
    })
    await recordDomainEventInTransaction(tx, {
      eventKey, rooftopId: visible.rooftop.id, aggregateType: 'Customer', aggregateId: customerId,
      action: 'contact-preferences-updated', topic: 'customer.contact-preferences-updated', actorId: context.session.itemId,
      afterSnapshot: { customerId, expectedUpdatedAt: expectedUpdatedAt.toISOString(), ...snapshot }, metadata: { preferenceEventId: preferenceEvent.id },
      payload: { customerId, rooftopId: visible.rooftop.id, preferredChannel },
    })
    return { id: customerId, status: preferredChannel, updatedAt: now, reused: false }
  }, { timeout: 30_000 })
}

export async function enrollLeadCadence(_root: unknown, { data }: any, context: any) {
  requireManager(context)
  const leadId = String(data.leadId || '')
  const expectedUpdatedAt = date(data.expectedUpdatedAt, 'Lead expectedUpdatedAt')
  const cadenceKey = String(data.cadenceKey || '')
  const cadence = CADENCES[cadenceKey]?.[0]
  if (!cadence) throw new Error('Cadence key is not registered')
  const campaignKey = text(data.campaignKey, 'Campaign key', 160).toLowerCase().replace(/[^a-z0-9:_-]+/g, '-')
  const eventKey = `lead-cadence:${key(data.idempotencyKey)}`
  const lead = await context.query.Lead.findOne({
    where: { id: leadId },
    query: 'id status rooftop { id } customer { id emailConsent smsConsent phoneConsent emailSuppressed smsSuppressed phoneSuppressed } assignedSalesperson { id }',
  })
  if (!lead?.rooftop?.id || !lead.customer?.id) throw new Error('Lead not found or not accessible')
  await assertSessionRooftopPermission(context, lead.rooftop.id, 'canManageLeads')
  if (['closed-won', 'closed-lost'].includes(lead.status)) throw new Error('Closed leads cannot enter a cadence')
  const consent = lead.customer[`${cadence.channel}Consent`] === true
  const suppressed = lead.customer[`${cadence.channel}Suppressed`] === true
  const cadenceStatus = consent && !suppressed ? 'active' : 'suppressed'

  return context.transaction(async (tx: any) => {
    const replay = await lockAndReplay(tx, eventKey)
    const afterSnapshot = { leadId, expectedUpdatedAt: expectedUpdatedAt.toISOString(), cadenceKey, campaignKey, channel: cadence.channel, cadenceStatus }
    if (replay) {
      await recordDomainEventInTransaction(tx, {
        eventKey, rooftopId: lead.rooftop.id, aggregateType: 'Lead', aggregateId: leadId,
        action: 'cadence-enrolled', topic: 'lead.cadence-enrolled', actorId: context.session.itemId,
        afterSnapshot, metadata: replay.metadata, payload: { leadId, rooftopId: lead.rooftop.id, cadenceKey, campaignKey, cadenceStatus, taskId: (replay.metadata as any)?.taskId ?? null },
      })
      return { id: leadId, status: cadenceStatus, updatedAt: new Date(), reused: true }
    }
    const dueAt = new Date(Date.now() + cadence.delayMinutes * 60_000)
    const changed = await tx.prisma.lead.updateMany({
      where: { id: leadId, rooftopId: lead.rooftop.id, updatedAt: expectedUpdatedAt },
      data: { campaignKey, cadenceKey, cadenceStatus, cadenceStep: cadence.step, cadenceDueAt: cadenceStatus === 'active' ? dueAt : null },
    })
    if (changed.count !== 1) throw new Error('Lead changed concurrently; reload and retry')
    let taskId: string | null = null
    if (cadenceStatus === 'active') {
      const task = await tx.prisma.task.create({
        data: { rooftopId: lead.rooftop.id, leadId, assignedToId: lead.assignedSalesperson?.id || context.session.itemId, title: cadence.taskTitle, description: `Campaign ${campaignKey}; ${cadence.channel} consent verified at enrollment.`, priority: 'high', completed: false, dueDate: dueAt },
        select: { id: true },
      })
      taskId = task.id
    }
    await recordDomainEventInTransaction(tx, {
      eventKey, rooftopId: lead.rooftop.id, aggregateType: 'Lead', aggregateId: leadId,
      action: 'cadence-enrolled', topic: 'lead.cadence-enrolled', actorId: context.session.itemId,
      afterSnapshot, metadata: { taskId }, payload: { leadId, rooftopId: lead.rooftop.id, cadenceKey, campaignKey, cadenceStatus, taskId },
    })
    return { id: leadId, status: cadenceStatus, updatedAt: dueAt, reused: false }
  }, { timeout: 30_000 })
}

export async function advanceLeadCadence(_root: unknown, { data }: any, context: any) {
  requireManager(context)
  const leadId = String(data.leadId || '')
  const expectedUpdatedAt = date(data.expectedUpdatedAt, 'Lead expectedUpdatedAt')
  const eventKey = `lead-cadence-advance:${key(data.idempotencyKey)}`
  const visible = await context.query.Lead.findOne({ where: { id: leadId }, query: 'id rooftop { id }' })
  if (!visible?.rooftop?.id) throw new Error('Lead not found or not accessible')
  await assertSessionRooftopPermission(context, visible.rooftop.id, 'canManageLeads')
  const requestEvidence = { leadId, expectedUpdatedAt: expectedUpdatedAt.toISOString() }

  return context.transaction(async (tx: any) => {
    const replay = await lockAndReplay(tx, eventKey)
    if (replay) {
      const prior = replay.afterSnapshot as any
      if (JSON.stringify(prior?.requestEvidence) !== JSON.stringify(requestEvidence)) throw new Error('Cadence idempotency key was reused with different evidence')
      await recordDomainEventInTransaction(tx, {
        eventKey, rooftopId: visible.rooftop.id, aggregateType: 'Lead', aggregateId: leadId,
        action: 'cadence-advanced', topic: 'lead.cadence-advanced', actorId: context.session.itemId,
        afterSnapshot: prior, metadata: replay.metadata,
        payload: { leadId, rooftopId: visible.rooftop.id, cadenceKey: prior.cadenceKey, cadenceStatus: prior.cadenceStatus, cadenceStep: prior.cadenceStep, taskId: (replay.metadata as any)?.taskId ?? null },
      })
      return { id: leadId, status: String(prior.cadenceStatus), updatedAt: new Date(), reused: true }
    }
    const lead = await tx.prisma.lead.findFirst({
      where: { id: leadId, rooftopId: visible.rooftop.id, updatedAt: expectedUpdatedAt },
      include: { customer: true },
    })
    if (!lead) throw new Error('Lead changed concurrently; reload and retry')
    if (lead.cadenceStatus !== 'active' || !lead.cadenceKey || !lead.cadenceStep) throw new Error('Lead does not have an active cadence')
    const steps = CADENCES[lead.cadenceKey]
    const currentIndex = steps?.findIndex(step => step.step === lead.cadenceStep) ?? -1
    if (!steps || currentIndex < 0) throw new Error('Lead cadence evidence is not registered')
    const nextStep = steps[currentIndex + 1]
    const consent = nextStep ? lead.customer[`${nextStep.channel}Consent`] === true : false
    const suppressed = nextStep ? lead.customer[`${nextStep.channel}Suppressed`] === true : false
    const cadenceStatus = !nextStep ? 'completed' : consent && !suppressed ? 'active' : 'suppressed'
    const dueAt = nextStep && cadenceStatus === 'active' ? new Date(Date.now() + nextStep.delayMinutes * 60_000) : null
    await tx.prisma.lead.update({
      where: { id: leadId },
      data: { cadenceStatus, cadenceStep: nextStep?.step || lead.cadenceStep, cadenceDueAt: dueAt },
    })
    let taskId: string | null = null
    if (nextStep && cadenceStatus === 'active') {
      const task = await tx.prisma.task.create({
        data: { rooftopId: visible.rooftop.id, leadId, assignedToId: lead.assignedSalespersonId || context.session.itemId, title: nextStep.taskTitle, description: `Campaign ${lead.campaignKey}; ${nextStep.channel} consent verified at cadence advance.`, priority: 'high', completed: false, dueDate: dueAt },
        select: { id: true },
      })
      taskId = task.id
    }
    const afterSnapshot = { requestEvidence, cadenceKey: lead.cadenceKey, campaignKey: lead.campaignKey, priorStep: lead.cadenceStep, cadenceStep: nextStep?.step || lead.cadenceStep, channel: nextStep?.channel || null, cadenceStatus, dueAt: dueAt?.toISOString() || null }
    await recordDomainEventInTransaction(tx, {
      eventKey, rooftopId: visible.rooftop.id, aggregateType: 'Lead', aggregateId: leadId,
      action: 'cadence-advanced', topic: 'lead.cadence-advanced', actorId: context.session.itemId,
      afterSnapshot, metadata: { taskId }, payload: { leadId, rooftopId: visible.rooftop.id, cadenceKey: lead.cadenceKey, cadenceStatus, cadenceStep: afterSnapshot.cadenceStep, taskId },
    })
    return { id: leadId, status: cadenceStatus, updatedAt: new Date(), reused: false }
  }, { timeout: 30_000 })
}

export async function linkCustomerHousehold(_root: unknown, { data }: any, context: any) {
  requireManager(context)
  const customerIds = [String(data.primaryCustomerId || ''), String(data.memberCustomerId || '')]
  if (!customerIds[0] || !customerIds[1] || customerIds[0] === customerIds[1]) throw new Error('Two different customers are required')
  const expected = [date(data.primaryExpectedUpdatedAt, 'Primary expectedUpdatedAt'), date(data.memberExpectedUpdatedAt, 'Member expectedUpdatedAt')]
  const displayName = text(data.displayName, 'Household display name', 200)
  const eventKey = `customer-household:${key(data.idempotencyKey)}`
  const customers = await context.query.Customer.findMany({ where: { id: { in: customerIds } }, query: 'id status rooftop { id } household { id }' })
  if (customers.length !== 2 || customers.some((customer: any) => customer.status !== 'active')) throw new Error('Customers not found or not accessible')
  if (customers[0].rooftop?.id !== customers[1].rooftop?.id) throw new Error('Household members must belong to the same rooftop')
  const rooftopId = customers[0].rooftop.id
  await assertSessionRooftopPermission(context, rooftopId, 'canManageLeads')
  const householdKey = `${rooftopId}:${[...customerIds].sort().join(':')}`

  return context.transaction(async (tx: any) => {
    const replay = await lockAndReplay(tx, eventKey)
    if (replay) {
      await recordDomainEventInTransaction(tx, {
        eventKey, rooftopId, aggregateType: 'CustomerHousehold', aggregateId: replay.aggregateId,
        action: 'members-linked', topic: 'customer.household-linked', actorId: context.session.itemId,
        afterSnapshot: { customerIds: [...customerIds].sort(), displayName, expectedUpdatedAt: expected.map(value => value.toISOString()) }, metadata: replay.metadata,
        payload: { rooftopId, householdId: replay.aggregateId, customerIds },
      })
      return { id: replay.aggregateId, status: 'active', updatedAt: new Date(), reused: true }
    }
    const rows = await tx.prisma.customer.findMany({ where: { id: { in: customerIds }, rooftopId, status: 'active' }, select: { id: true, updatedAt: true, householdId: true } })
    if (rows.length !== 2 || rows.some((row: any, index: number) => row.updatedAt.getTime() !== expected[customerIds.indexOf(row.id)].getTime())) throw new Error('Customer changed concurrently; reload and retry')
    const existingHouseholds = [...new Set(rows.map((row: any) => row.householdId).filter(Boolean))]
    if (existingHouseholds.length > 1) throw new Error('Customers already belong to different households')
    const household = existingHouseholds.length === 1
      ? await tx.prisma.customerHousehold.update({ where: { id: existingHouseholds[0] }, data: { displayName } })
      : await tx.prisma.customerHousehold.create({ data: { id: randomUUID(), rooftopId, householdKey, displayName } })
    await tx.prisma.customer.updateMany({ where: { id: { in: customerIds }, rooftopId }, data: { householdId: household.id } })
    await recordDomainEventInTransaction(tx, {
      eventKey, rooftopId, aggregateType: 'CustomerHousehold', aggregateId: household.id,
      action: 'members-linked', topic: 'customer.household-linked', actorId: context.session.itemId,
      afterSnapshot: { customerIds: [...customerIds].sort(), displayName, expectedUpdatedAt: expected.map(value => value.toISOString()) }, metadata: { householdId: household.id },
      payload: { rooftopId, householdId: household.id, customerIds },
    })
    return { id: household.id, status: 'active', updatedAt: household.updatedAt, reused: false }
  }, { timeout: 30_000 })
}

const VISIT_TRANSITIONS: Record<string, string[]> = {
  scheduled: ['arrived', 'cancelled', 'no-show'],
  arrived: ['manager-turn', 'completed', 'cancelled'],
  'manager-turn': ['completed', 'cancelled'],
  completed: [], cancelled: [], 'no-show': [],
}

export async function manageSalesVisit(_root: unknown, { data }: any, context: any) {
  requireManager(context)
  const action = String(data.action || '')
  if (!['schedule', 'arrive', 'manager-turn', 'complete', 'cancel', 'no-show'].includes(action)) throw new Error('Sales visit action is invalid')
  const eventKey = `sales-visit:${key(data.idempotencyKey)}`
  const requestedVisitId = String(data.visitId || '')
  const leadId = String(data.leadId || '')
  const lead = leadId ? await context.query.Lead.findOne({ where: { id: leadId }, query: 'id rooftop { id } customer { id } assignedSalesperson { id } interestedVehicle { id }' }) : null
  const visibleVisit = requestedVisitId ? await context.query.SalesVisit.findOne({ where: { id: requestedVisitId }, query: 'id status kind updatedAt rooftop { id } lead { id }' }) : null
  const rooftopId = lead?.rooftop?.id || visibleVisit?.rooftop?.id
  if (!rooftopId) throw new Error('Lead or sales visit not found or not accessible')
  await assertSessionRooftopPermission(context, rooftopId, 'canManageLeads')
  if (lead && visibleVisit && (lead.id !== visibleVisit.lead?.id || lead.rooftop.id !== visibleVisit.rooftop?.id)) throw new Error('Sales visit must belong to the selected lead')
  if (data.vehicleId) {
    const vehicle = await context.query.Vehicle.findOne({ where: { id: String(data.vehicleId) }, query: 'id rooftop { id }' })
    if (!vehicle || vehicle.rooftop?.id !== rooftopId) throw new Error('Vehicle must belong to the same rooftop')
  }
  const expectedUpdatedAt = action === 'schedule' ? null : date(data.expectedUpdatedAt, 'Sales visit expectedUpdatedAt')
  if (data.managerId) await assertUserRooftopAccess(context, String(data.managerId), rooftopId)
  const requestEvidence = {
    action,
    visitId: requestedVisitId || null,
    leadId: leadId || visibleVisit?.lead?.id || null,
    kind: data.kind ? String(data.kind) : null,
    vehicleId: data.vehicleId ? String(data.vehicleId) : null,
    managerId: data.managerId ? String(data.managerId) : null,
    requestedScheduledAt: data.scheduledAt ? date(data.scheduledAt, 'Scheduled time').toISOString() : null,
    requestExpectedUpdatedAt: expectedUpdatedAt?.toISOString() || null,
    outcome: data.outcome ? String(data.outcome).trim().slice(0, 300) : null,
    notesHash: domainEventRequestHash(String(data.notes || '').trim().slice(0, 4000)),
  }

  return context.transaction(async (tx: any) => {
    const replay = await lockAndReplay(tx, eventKey)
    if (replay) {
      const prior = replay.afterSnapshot as any
      if (JSON.stringify(prior?.requestEvidence) !== JSON.stringify(requestEvidence)) throw new Error('Sales visit idempotency key was reused with different evidence')
      await recordDomainEventInTransaction(tx, {
        eventKey, rooftopId, aggregateType: 'SalesVisit', aggregateId: replay.aggregateId,
        action, topic: `sales-visit.${action}`, actorId: context.session.itemId,
        afterSnapshot: prior, metadata: replay.metadata, payload: { rooftopId, visitId: replay.aggregateId, action },
      })
      return { id: replay.aggregateId, status: String(prior?.status || action), updatedAt: new Date(), reused: true }
    }
    const now = new Date()
    let visit: any
    if (action === 'schedule') {
      if (!lead?.customer?.id) throw new Error('A lead with a customer is required')
      const kind = String(data.kind || 'appointment')
      if (!['appointment', 'showroom'].includes(kind)) throw new Error('Sales visit kind is invalid')
      const scheduledAt = date(data.scheduledAt || now, 'Scheduled time')
      visit = await tx.prisma.salesVisit.create({
        data: { id: randomUUID(), rooftopId, leadId, customerId: lead.customer.id, vehicleId: String(data.vehicleId || lead.interestedVehicle?.id || '') || null, assignedSalespersonId: lead.assignedSalesperson?.id || context.session.itemId, kind, status: kind === 'showroom' ? 'arrived' : 'scheduled', scheduledAt, arrivedAt: kind === 'showroom' ? now : null, notes: String(data.notes || '').trim().slice(0, 4000) },
      })
    } else {
      if (!visibleVisit || !expectedUpdatedAt) throw new Error('Sales visit is required')
      const target = action === 'cancel' ? 'cancelled' : action === 'complete' ? 'completed' : action === 'arrive' ? 'arrived' : action
      if (!VISIT_TRANSITIONS[visibleVisit.status]?.includes(target)) throw new Error(`Invalid sales visit transition: ${visibleVisit.status} -> ${target}`)
      const changed = await tx.prisma.salesVisit.updateMany({
        where: { id: requestedVisitId, rooftopId, status: visibleVisit.status, updatedAt: expectedUpdatedAt },
        data: { status: target, ...(target === 'arrived' ? { arrivedAt: now } : {}), ...(target === 'manager-turn' ? { managerId: String(data.managerId || context.session.itemId), managerTurnAt: now } : {}), ...(target === 'completed' ? { completedAt: now, outcome: text(data.outcome, 'Visit outcome', 300) } : {}), notes: String(data.notes || '').trim().slice(0, 4000) || undefined },
      })
      if (changed.count !== 1) throw new Error('Sales visit changed concurrently; reload and retry')
      visit = await tx.prisma.salesVisit.findUniqueOrThrow({ where: { id: requestedVisitId } })
    }
    const afterSnapshot = { visitId: visit.id, leadId: visit.leadId, kind: visit.kind, status: visit.status, managerId: visit.managerId || null, vehicleId: visit.vehicleId || null, scheduledAt: visit.scheduledAt?.toISOString() || null, outcome: visit.outcome || null, requestEvidence }
    await recordDomainEventInTransaction(tx, {
      eventKey, rooftopId, aggregateType: 'SalesVisit', aggregateId: visit.id,
      action, topic: `sales-visit.${action}`, actorId: context.session.itemId,
      afterSnapshot, metadata: { visitId: visit.id }, payload: { rooftopId, visitId: visit.id, leadId: visit.leadId, status: visit.status },
    })
    return { id: visit.id, status: visit.status, updatedAt: visit.updatedAt, reused: false }
  }, { timeout: 30_000 })
}
