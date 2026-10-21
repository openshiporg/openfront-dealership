import { randomUUID } from 'node:crypto'
import { operatorDateFields } from './operatorProjections'

import { permissions } from '../access'
import { recordDomainEventInTransaction } from '../lifecycle/domainEvents'
import { assertSessionRooftopPermission, assertUserRooftopAccess } from '../tenantRecords'

function required(value: unknown, label: string, max = 1000) {
  const result = String(value || '').trim()
  if (!result || result.length > max) throw new Error(`${label} is required and must be at most ${max} characters`)
  return result
}

function commandKey(value: unknown) {
  const key = String(value || '').trim()
  if (key.length < 8 || key.length > 180) throw new Error('A valid idempotency key is required')
  return key
}

function expectedDate(value: unknown, label: string) {
  const date = value instanceof Date ? value : new Date(String(value || ''))
  if (Number.isNaN(date.getTime())) throw new Error(`${label} is invalid`)
  return date
}

export async function customerDuplicateCandidates(_root: unknown, { customerId, limit = 20 }: any, context: any) {
  if (!context.session?.itemId || !permissions.canAccessLeads({ session: context.session })) throw new Error('CRM access is required')
  const customer = await context.query.Customer.findOne({
    where: { id: String(customerId || '') },
    query: 'id rooftop { id } normalizedEmail normalizedPhone status',
  })
  if (!customer?.rooftop?.id || customer.status !== 'active') throw new Error('Customer not found or not accessible')
  const filters = [
    ...(customer.normalizedEmail ? [{ normalizedEmail: { equals: customer.normalizedEmail } }] : []),
    ...(customer.normalizedPhone ? [{ normalizedPhone: { equals: customer.normalizedPhone } }] : []),
  ]
  if (!filters.length) return []
  const candidates = await context.query.Customer.findMany({
    where: { id: { not: { equals: customer.id } }, status: { equals: 'active' }, OR: filters },
    orderBy: { createdAt: 'asc' },
    take: Math.max(1, Math.min(50, Number(limit) || 20)),
    query: 'id firstName lastName primaryEmail primaryPhone status createdAt updatedAt leadsCount',
  })
  return candidates.map((candidate: any) => operatorDateFields(candidate, ['createdAt', 'updatedAt']))
}

export async function mergeCustomers(_root: unknown, { data }: any, context: any) {
  if (!context.session?.itemId || !permissions.canManageLeads({ session: context.session })) throw new Error('Lead management permission is required')
  const survivorId = String(data.survivorId || '')
  const duplicateId = String(data.duplicateId || '')
  if (!survivorId || !duplicateId || survivorId === duplicateId) throw new Error('Two different customers are required')
  const reason = required(data.reason, 'Merge reason')
  const survivorExpected = expectedDate(data.survivorExpectedUpdatedAt, 'Survivor expectedUpdatedAt')
  const duplicateExpected = expectedDate(data.duplicateExpectedUpdatedAt, 'Duplicate expectedUpdatedAt')
  const eventKey = `customer-merge:${commandKey(data.idempotencyKey)}`
  const visible = await context.query.Customer.findMany({
    where: { id: { in: [survivorId, duplicateId] } },
    query: 'id rooftop { id } status',
  })
  if (visible.length !== 2) throw new Error('Customer not found or not accessible')
  if (visible[0].rooftop?.id !== visible[1].rooftop?.id) throw new Error('Customers must belong to the same rooftop')
  const rooftopId = visible[0].rooftop.id
  await assertSessionRooftopPermission(context, rooftopId, 'canManageLeads')

  return context.transaction(async (tx: any) => {
    // Intake and all merges at this rooftop share this lock, so a public submission
    // cannot bind an alias to a row while that row is being redirected.
    await tx.prisma.$queryRaw`SELECT 1 AS "locked" FROM pg_advisory_xact_lock(hashtextextended(${`customer-identity-rooftop:${rooftopId}`}, 0))`
    await tx.prisma.$queryRaw`SELECT 1 AS "locked" FROM pg_advisory_xact_lock(hashtextextended(${`command:${eventKey}`}, 0))`
    const replay = await tx.prisma.domainAuditEvent.findUnique({ where: { eventKey }, select: { metadata: true, afterSnapshot: true } })
    if (replay) {
      const metadata = (replay.metadata || {}) as any
      const prior = (replay.afterSnapshot || {}) as any
      if (prior.survivorId !== survivorId || prior.duplicateId !== duplicateId || prior.reason !== reason ||
          (prior.survivorExpectedUpdatedAt && prior.survivorExpectedUpdatedAt !== survivorExpected.toISOString()) ||
          (prior.duplicateExpectedUpdatedAt && prior.duplicateExpectedUpdatedAt !== duplicateExpected.toISOString())) {
        throw new Error('Customer merge idempotency key was reused with different evidence')
      }
      return {
        id: survivorId,
        duplicateId,
        movedLeadCount: Number(metadata.movedLeadCount || 0),
        movedSalesVisitCount: Number(metadata.movedSalesVisitCount || 0),
        reused: true,
      }
    }
    const [survivor, duplicate] = await Promise.all([
      tx.prisma.customer.findFirst({ where: { id: survivorId, rooftopId, status: 'active', updatedAt: survivorExpected } }),
      tx.prisma.customer.findFirst({ where: { id: duplicateId, rooftopId, status: 'active', updatedAt: duplicateExpected } }),
    ])
    if (!survivor || !duplicate) throw new Error('Customer changed concurrently; reload and retry')

    const leadLinks = await tx.prisma.lead.findMany({ where: { customerId: duplicateId }, select: { id: true, rooftopId: true }, orderBy: { id: 'asc' } })
    const salesVisitLinks = await tx.prisma.salesVisit.findMany({ where: { customerId: duplicateId }, select: { id: true, rooftopId: true }, orderBy: { id: 'asc' } })
    if (leadLinks.some((lead: any) => lead.rooftopId !== rooftopId) || salesVisitLinks.some((visit: any) => visit.rooftopId !== rooftopId)) {
      throw new Error('Customer merge is blocked by customer-linked records outside this rooftop')
    }
    const movedLeadIds = leadLinks.map((lead: any) => lead.id)
    const movedSalesVisitIds = salesVisitLinks.map((visit: any) => visit.id)
    const beforePreferences = (customer: any) => ({
      emailConsent: Boolean(customer.emailConsent), smsConsent: Boolean(customer.smsConsent), phoneConsent: Boolean(customer.phoneConsent),
      emailSuppressed: Boolean(customer.emailSuppressed), smsSuppressed: Boolean(customer.smsSuppressed), phoneSuppressed: Boolean(customer.phoneSuppressed),
      preferredChannel: customer.preferredChannel || 'none', updatedAt: customer.contactPreferenceUpdatedAt || null,
    })
    const survivorPreferences = beforePreferences(survivor)
    const duplicatePreferences = beforePreferences(duplicate)
    const mergedPreferences = {
      emailSuppressed: survivorPreferences.emailSuppressed || duplicatePreferences.emailSuppressed,
      smsSuppressed: survivorPreferences.smsSuppressed || duplicatePreferences.smsSuppressed,
      phoneSuppressed: survivorPreferences.phoneSuppressed || duplicatePreferences.phoneSuppressed,
      emailConsent: survivorPreferences.emailConsent && duplicatePreferences.emailConsent && !(survivorPreferences.emailSuppressed || duplicatePreferences.emailSuppressed),
      smsConsent: survivorPreferences.smsConsent && duplicatePreferences.smsConsent && !(survivorPreferences.smsSuppressed || duplicatePreferences.smsSuppressed),
      phoneConsent: survivorPreferences.phoneConsent && duplicatePreferences.phoneConsent && !(survivorPreferences.phoneSuppressed || duplicatePreferences.phoneSuppressed),
      preferredChannel: survivorPreferences.preferredChannel === duplicatePreferences.preferredChannel &&
        survivorPreferences.preferredChannel !== 'none' &&
        (survivorPreferences.preferredChannel === 'email' ? survivorPreferences.emailConsent && duplicatePreferences.emailConsent && !survivorPreferences.emailSuppressed && !duplicatePreferences.emailSuppressed :
          survivorPreferences.preferredChannel === 'sms' ? survivorPreferences.smsConsent && duplicatePreferences.smsConsent && !survivorPreferences.smsSuppressed && !duplicatePreferences.smsSuppressed :
            survivorPreferences.preferredChannel === 'phone' ? survivorPreferences.phoneConsent && duplicatePreferences.phoneConsent && !survivorPreferences.phoneSuppressed && !duplicatePreferences.phoneSuppressed : false)
          ? survivorPreferences.preferredChannel : 'none',
      contactPreferenceUpdatedAt: new Date(),
      suppressionReason: survivorPreferences.emailSuppressed || duplicatePreferences.emailSuppressed || survivorPreferences.smsSuppressed || duplicatePreferences.smsSuppressed || survivorPreferences.phoneSuppressed || duplicatePreferences.phoneSuppressed
        ? `Suppression preserved during customer merge: ${reason}`
        : null,
      suppressionSource: survivorPreferences.emailSuppressed || duplicatePreferences.emailSuppressed || survivorPreferences.smsSuppressed || duplicatePreferences.smsSuppressed || survivorPreferences.phoneSuppressed || duplicatePreferences.phoneSuppressed
        ? 'customer-merge'
        : null,
    }
    const mergedAt = new Date()
    const survivorHouseholdId = survivor.householdId || null
    const duplicateHouseholdId = duplicate.householdId || null
    const effectiveHouseholdId = survivorHouseholdId || duplicateHouseholdId
    const survivorChanged = await tx.prisma.customer.updateMany({
      where: { id: survivorId, rooftopId, status: 'active', updatedAt: survivorExpected },
      data: { ...mergedPreferences, ...(effectiveHouseholdId && !survivorHouseholdId ? { householdId: effectiveHouseholdId } : {}) },
    })
    if (survivorChanged.count !== 1) throw new Error('Surviving customer changed concurrently; reload and retry')
    const leadTransfer = await tx.prisma.lead.updateMany({ where: { customerId: duplicateId, rooftopId }, data: { customerId: survivorId } })
    const salesVisitTransfer = await tx.prisma.salesVisit.updateMany({ where: { customerId: duplicateId, rooftopId }, data: { customerId: survivorId } })
    if (leadTransfer.count !== movedLeadIds.length || salesVisitTransfer.count !== movedSalesVisitIds.length) {
      throw new Error('Customer-linked records changed during merge; reload and retry')
    }
    const duplicateChanged = await tx.prisma.customer.updateMany({
      where: { id: duplicateId, rooftopId, status: 'active', updatedAt: duplicateExpected },
      data: { status: 'merged', mergedIntoId: survivorId, mergedAt },
    })
    if (duplicateChanged.count !== 1) throw new Error('Duplicate customer changed concurrently; reload and retry')
    await tx.prisma.customerContactPreferenceEvent.create({
      data: {
        rooftopId,
        customerId: survivorId,
        actorId: context.session.itemId,
        source: 'customer-merge',
        reason,
        occurredAt: mergedAt,
        preferenceSnapshot: { survivorBefore: survivorPreferences, duplicateBefore: duplicatePreferences, mergedAfter: mergedPreferences },
      },
    })
    await tx.prisma.customerMergeEvent.create({
      data: {
        rooftopId,
        survivorId,
        duplicateId,
        actorId: context.session.itemId,
        reason,
        mergedAt,
        movedLeadIds,
        evidenceSnapshot: {
          survivor: { id: survivor.id, normalizedEmail: survivor.normalizedEmail, normalizedPhone: survivor.normalizedPhone },
          duplicate: { id: duplicate.id, normalizedEmail: duplicate.normalizedEmail, normalizedPhone: duplicate.normalizedPhone },
          movedSalesVisitIds,
          householdPolicy: { survivorHouseholdId, duplicateHouseholdId, effectiveHouseholdId, duplicateMembershipRetained: true },
          preferences: { survivorBefore: survivorPreferences, duplicateBefore: duplicatePreferences, mergedAfter: mergedPreferences },
        },
      },
    })
    await recordDomainEventInTransaction(tx, {
      eventKey,
      rooftopId,
      aggregateType: 'Customer',
      aggregateId: survivorId,
      action: 'duplicate-merged',
      topic: 'customer.duplicate-merged',
      actorId: context.session.itemId,
      afterSnapshot: { survivorId, duplicateId, movedLeadIds, movedSalesVisitIds, reason, survivorExpectedUpdatedAt: survivorExpected.toISOString(), duplicateExpectedUpdatedAt: duplicateExpected.toISOString(), preferences: mergedPreferences },
      metadata: { duplicateId, movedLeadCount: movedLeadIds.length, movedSalesVisitCount: movedSalesVisitIds.length },
      payload: { rooftopId, survivorId, duplicateId, movedLeadCount: movedLeadIds.length, movedSalesVisitCount: movedSalesVisitIds.length },
    })
    return { id: survivorId, duplicateId, movedLeadCount: movedLeadIds.length, movedSalesVisitCount: movedSalesVisitIds.length, reused: false }
  }, { timeout: 30_000 })
}


export async function configureLeadRoutingRule(_root: unknown, { data }: any, context: any) {
  if (!context.session?.itemId || !permissions.canManageLeads({ session: context.session })) throw new Error('Lead management permission is required')
  const rooftopId = String(data.rooftopId || '')
  const assigneeId = String(data.assigneeId || '')
  const name = required(data.name, 'Rule name', 200)
  const source = String(data.source || 'any')
  if (!['any', 'walk-in', 'website', 'phone', 'referral', 'ad', 'social', 'third-party'].includes(source)) throw new Error('Routing source is invalid')
  const priority = Number(data.priority ?? 100)
  const firstResponseMinutes = Number(data.firstResponseMinutes ?? 30)
  if (!Number.isInteger(priority) || priority < 0 || priority > 10000) throw new Error('Routing priority is invalid')
  if (!Number.isInteger(firstResponseMinutes) || firstResponseMinutes < 1 || firstResponseMinutes > 10080) throw new Error('First response target is invalid')
  await assertSessionRooftopPermission(context, rooftopId, 'canManageLeads')
  await assertUserRooftopAccess(context, assigneeId, rooftopId)
  const routeKey = `${rooftopId}:${source}:${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`
  const eventKey = `lead-route-rule:${commandKey(data.idempotencyKey)}`
  const ruleId = randomUUID()

  return context.transaction(async (tx: any) => {
    await tx.prisma.$queryRaw`SELECT 1 AS "locked" FROM pg_advisory_xact_lock(hashtextextended(${`command:${eventKey}`}, 0))`
    const replay = await tx.prisma.domainAuditEvent.findUnique({ where: { eventKey }, select: { metadata: true, afterSnapshot: true } })
    if (replay) {
      const prior = (replay.afterSnapshot || {}) as any
      if (prior.routeKey !== routeKey || prior.source !== source || prior.priority !== priority || prior.firstResponseMinutes !== firstResponseMinutes || prior.assigneeId !== assigneeId || prior.active !== (data.active !== false)) {
        throw new Error('Lead routing rule idempotency key was reused with different evidence')
      }
      return { id: String((replay.metadata as any)?.ruleId || ''), status: prior.active ? 'active' : 'inactive', updatedAt: new Date(), reused: true }
    }
    const rule = await tx.prisma.leadRoutingRule.upsert({
      where: { routeKey },
      create: { id: ruleId, rooftopId, routeKey, name, source, priority, firstResponseMinutes, assigneeId, active: true },
      update: { name, source, priority, firstResponseMinutes, assigneeId, active: data.active !== false },
    })
    await recordDomainEventInTransaction(tx, {
      eventKey, rooftopId, aggregateType: 'LeadRoutingRule', aggregateId: rule.id, action: 'configured', topic: 'lead-routing.configured', actorId: context.session.itemId,
      afterSnapshot: { ruleId: rule.id, routeKey, source, priority, firstResponseMinutes, assigneeId, active: rule.active }, metadata: { ruleId: rule.id }, payload: { rooftopId, ruleId: rule.id, source, assigneeId },
    })
    return { id: rule.id, status: rule.active ? 'active' : 'inactive', updatedAt: rule.updatedAt, reused: false }
  }, { timeout: 30_000 })
}

export async function routeLead(_root: unknown, { data }: any, context: any) {
  if (!context.session?.itemId || !permissions.canManageLeads({ session: context.session })) throw new Error('Lead management permission is required')
  const leadId = String(data.leadId || '')
  const expectedUpdatedAt = expectedDate(data.expectedUpdatedAt, 'Lead expectedUpdatedAt')
  const eventKey = `lead-route:${commandKey(data.idempotencyKey)}`
  const lead = await context.query.Lead.findOne({ where: { id: leadId }, query: 'id source status updatedAt rooftop { id } assignedSalesperson { id }' })
  if (!lead?.rooftop?.id) throw new Error('Lead not found or not accessible')
  await assertSessionRooftopPermission(context, lead.rooftop.id, 'canManageLeads')

  return context.transaction(async (tx: any) => {
    await tx.prisma.$queryRaw`SELECT 1 AS "locked" FROM pg_advisory_xact_lock(hashtextextended(${`command:${eventKey}`}, 0))`
    const replay = await tx.prisma.domainAuditEvent.findUnique({ where: { eventKey }, select: { afterSnapshot: true } })
    const rule = await tx.prisma.leadRoutingRule.findFirst({
      where: { rooftopId: lead.rooftop.id, active: true, source: { in: [lead.source || 'any', 'any'] } },
      orderBy: [{ priority: 'desc' }, { routeKey: 'asc' }],
    })
    if (!rule) throw new Error('No active routing rule matches this lead')
    if (replay) {
      const prior = (replay.afterSnapshot || {}) as any
      if (prior.leadId !== leadId || prior.ruleId !== rule.id || prior.routeKey !== rule.routeKey || prior.assigneeId !== rule.assigneeId ||
          (prior.requestExpectedUpdatedAt && prior.requestExpectedUpdatedAt !== expectedUpdatedAt.toISOString())) {
        throw new Error('Lead routing idempotency key was reused with different evidence')
      }
      return { id: leadId, status: lead.status, updatedAt: new Date(), reused: true }
    }
    const [groupAccess, directAccess] = await Promise.all([
      tx.prisma.dealerGroupMembership.count({ where: { userId: rule.assigneeId, status: 'active', accessAllRooftops: true, dealerGroup: { rooftops: { some: { id: lead.rooftop.id } } } } }),
      tx.prisma.rooftopMembership.count({ where: { userId: rule.assigneeId, status: 'active', rooftopId: lead.rooftop.id } }),
    ])
    if (groupAccess === 0 && directAccess === 0) throw new Error('Routing assignee no longer has active rooftop access')
    const assignedAt = new Date()
    const firstResponseDueAt = new Date(assignedAt.getTime() + rule.firstResponseMinutes * 60_000)
    const changed = await tx.prisma.lead.updateMany({
      where: { id: leadId, rooftopId: lead.rooftop.id, updatedAt: expectedUpdatedAt },
      data: { assignedSalespersonId: rule.assigneeId, assignedAt, firstResponseDueAt },
    })
    if (changed.count !== 1) throw new Error('Lead changed concurrently; reload and retry')
    await tx.prisma.leadAssignmentEvent.create({
      data: { rooftopId: lead.rooftop.id, leadId, fromUserId: lead.assignedSalesperson?.id || null, toUserId: rule.assigneeId, actorId: context.session.itemId, reason: 'Matched active routing rule', routeKey: rule.routeKey, assignedAt, firstResponseDueAt },
    })
    await recordDomainEventInTransaction(tx, {
      eventKey, rooftopId: lead.rooftop.id, aggregateType: 'Lead', aggregateId: leadId, action: 'routed', topic: 'lead.routed', actorId: context.session.itemId,
      afterSnapshot: { leadId, ruleId: rule.id, routeKey: rule.routeKey, assigneeId: rule.assigneeId, assignedAt, firstResponseDueAt, requestExpectedUpdatedAt: expectedUpdatedAt.toISOString() }, metadata: { ruleId: rule.id }, payload: { rooftopId: lead.rooftop.id, leadId, assigneeId: rule.assigneeId, firstResponseDueAt },
    })
    return { id: leadId, status: lead.status, updatedAt: assignedAt, reused: false }
  }, { timeout: 30_000 })
}
