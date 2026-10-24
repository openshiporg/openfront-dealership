import { permissions } from '../access'
import { commandDate } from '../lifecycle/commandDate'
import { recordDomainEventInTransaction } from '../lifecycle/domainEvents'
import { assertSessionRooftopPermission, assertUserRooftopAccess } from '../tenantRecords'
import { resolveCustomerInTransaction } from './customerIdentity'
import { LEAD_SOURCES, resolveIntakeAssignment } from './leadRouting'

const BUDGET_RANGES = ['under-20k', '20-30k', '30-40k', '40-50k', '50-75k', '75-100k', 'over-100k']
const TIMEFRAMES = ['immediately', 'this-week', 'this-month', 'just-looking']

function requireLeadManager(context: any) {
  if (!context.session?.itemId || !permissions.canManageLeads({ session: context.session })) throw new Error('Lead management permission is required')
}

function idempotencyKey(value: unknown) {
  const key = String(value || '').trim()
  if (key.length < 8 || key.length > 180) throw new Error('A valid idempotency key is required')
  return key
}

function requiredText(value: unknown, label: string, max: number) {
  const text = String(value ?? '').trim()
  if (!text) throw new Error(`${label} is required`)
  if (text.length > max) throw new Error(`${label} must be ${max} characters or fewer`)
  return text
}

function optionalText(value: unknown, label: string, max: number) {
  const text = String(value ?? '').trim()
  if (text.length > max) throw new Error(`${label} must be ${max} characters or fewer`)
  return text
}

function contactPoints(emailValue: unknown, phoneValue: unknown) {
  const email = optionalText(emailValue, 'Email', 320).toLowerCase()
  const phone = optionalText(phoneValue, 'Phone', 50)
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Email is invalid')
  const digits = phone.replace(/\D/g, '')
  if (phone && (digits.length < 7 || digits.length > 15)) throw new Error('Phone is invalid')
  if (!email && !phone) throw new Error('An email or phone is required')
  return { email, phone }
}

function optionChoice(value: unknown, options: readonly string[], label: string) {
  const choice = String(value ?? '').trim()
  if (!choice) return null
  if (!options.includes(choice)) throw new Error(`${label} is invalid`)
  return choice
}

async function assertVehicleAtRooftop(context: any, vehicleId: string, rooftopId: string) {
  const vehicle = await context.sudo().prisma.vehicle.findUnique({ where: { id: vehicleId }, select: { rooftopId: true } })
  if (!vehicle || vehicle.rooftopId !== rooftopId) throw new Error('Vehicle must belong to the same rooftop')
}

async function lockAndReplay(tx: any, eventKey: string) {
  await tx.prisma.$queryRaw`SELECT 1 AS "locked" FROM pg_advisory_xact_lock(hashtextextended(${`command:${eventKey}`}, 0))`
  return tx.prisma.domainAuditEvent.findUnique({ where: { eventKey }, select: { aggregateId: true, afterSnapshot: true, metadata: true } })
}

/**
 * Staff intake for phone, walk-in and other offline leads. Finds or creates the rooftop Customer the
 * same way public submissions do, then assigns the lead through the routing rules so the
 * first-response SLA starts at intake.
 */
export async function createLead(_root: unknown, { data }: any, context: any) {
  requireLeadManager(context)
  const rooftopId = requiredText(data.rooftopId, 'Rooftop', 100)
  const firstName = requiredText(data.firstName, 'First name', 100)
  const lastName = requiredText(data.lastName, 'Last name', 100)
  const { email, phone } = contactPoints(data.email, data.phone)
  const source = optionChoice(data.source, LEAD_SOURCES, 'Lead source')
  if (!source) throw new Error('Lead source is required')
  const budgetRange = optionChoice(data.budgetRange, BUDGET_RANGES, 'Budget range')
  const timeframe = optionChoice(data.timeframe, TIMEFRAMES, 'Timeframe')
  const tradeInVehicle = optionalText(data.tradeInVehicle, 'Trade-in vehicle', 300)
  const notes = optionalText(data.notes, 'Notes', 4000)
  const vehicleId = optionalText(data.interestedVehicleId, 'Vehicle', 100) || null
  const explicitAssigneeId = optionalText(data.assignedToId, 'Salesperson', 100) || null
  const eventKey = `lead-create:${idempotencyKey(data.idempotencyKey)}`
  await assertSessionRooftopPermission(context, rooftopId, 'canManageLeads')
  if (vehicleId) await assertVehicleAtRooftop(context, vehicleId, rooftopId)
  if (explicitAssigneeId) await assertUserRooftopAccess(context, explicitAssigneeId, rooftopId)
  const requestEvidence = { rooftopId, firstName, lastName, email, phone, source, budgetRange, timeframe, tradeInVehicle, notes, vehicleId, explicitAssigneeId }

  return context.transaction(async (tx: any) => {
    const replay = await lockAndReplay(tx, eventKey)
    if (replay) {
      const prior = (replay.afterSnapshot || {}) as any
      if (JSON.stringify(prior.requestEvidence) !== JSON.stringify(requestEvidence)) throw new Error('Lead intake idempotency key was reused with different details')
      return { id: replay.aggregateId, customerId: prior.customerId, assignedToId: prior.assigneeId, routeKey: prior.routeKey, firstResponseDueAt: prior.firstResponseDueAt ? new Date(prior.firstResponseDueAt) : null, reused: true }
    }
    const { customer } = await resolveCustomerInTransaction(tx, { rooftopId, firstName, lastName, email, phone })
    const now = new Date()
    const assignment = await resolveIntakeAssignment(tx, { rooftopId, source, explicitAssigneeId, actorId: context.session.itemId, now })
    const lead = await tx.prisma.lead.create({
      data: {
        rooftopId,
        customerId: customer.id,
        firstName,
        lastName,
        email,
        phone,
        source,
        status: 'new',
        budgetRange,
        timeframe,
        tradeInVehicle,
        notes,
        interestedVehicleId: vehicleId,
        assignedSalespersonId: assignment.assigneeId,
        assignedAt: now,
        firstResponseDueAt: assignment.firstResponseDueAt,
      },
      select: { id: true },
    })
    await tx.prisma.leadAssignmentEvent.create({
      data: {
        rooftopId,
        leadId: lead.id,
        fromUserId: null,
        toUserId: assignment.assigneeId,
        actorId: context.session.itemId,
        reason: assignment.reason,
        routeKey: assignment.routeKey,
        assignedAt: now,
        firstResponseDueAt: assignment.firstResponseDueAt,
      },
    })
    await recordDomainEventInTransaction(tx, {
      eventKey, rooftopId, aggregateType: 'Lead', aggregateId: lead.id, action: 'created', topic: 'lead.created', actorId: context.session.itemId,
      afterSnapshot: { requestEvidence, customerId: customer.id, assigneeId: assignment.assigneeId, routeKey: assignment.routeKey, firstResponseDueAt: assignment.firstResponseDueAt.toISOString() },
      metadata: { leadId: lead.id, customerId: customer.id },
      payload: { rooftopId, leadId: lead.id, customerId: customer.id, source, assigneeId: assignment.assigneeId, routeKey: assignment.routeKey },
    })
    return { id: lead.id, customerId: customer.id, assignedToId: assignment.assigneeId, routeKey: assignment.routeKey, firstResponseDueAt: assignment.firstResponseDueAt, reused: false }
  }, { timeout: 30_000 })
}

/**
 * Edits the lead's own contact snapshot and qualification fields. The linked Customer identity is
 * unchanged; customer contact edits go through `updateCustomerContact`.
 */
export async function updateLeadDetails(_root: unknown, { data }: any, context: any) {
  requireLeadManager(context)
  const leadId = requiredText(data.leadId, 'Lead', 100)
  const expectedUpdatedAt = commandDate(data.expectedUpdatedAt, 'Lead expectedUpdatedAt')
  const firstName = requiredText(data.firstName, 'First name', 100)
  const lastName = requiredText(data.lastName, 'Last name', 100)
  const { email, phone } = contactPoints(data.email, data.phone)
  const source = optionChoice(data.source, LEAD_SOURCES, 'Lead source')
  if (!source) throw new Error('Lead source is required')
  const budgetRange = optionChoice(data.budgetRange, BUDGET_RANGES, 'Budget range')
  const timeframe = optionChoice(data.timeframe, TIMEFRAMES, 'Timeframe')
  const tradeInVehicle = optionalText(data.tradeInVehicle, 'Trade-in vehicle', 300)
  const notes = optionalText(data.notes, 'Notes', 4000)
  const vehicleId = optionalText(data.interestedVehicleId, 'Vehicle', 100) || null
  const eventKey = `lead-details:${idempotencyKey(data.idempotencyKey)}`
  const lead = await context.query.Lead.findOne({ where: { id: leadId }, query: 'id rooftop { id }' })
  if (!lead?.rooftop?.id) throw new Error('Lead not found or not accessible')
  const rooftopId = lead.rooftop.id
  await assertSessionRooftopPermission(context, rooftopId, 'canManageLeads')
  if (vehicleId) await assertVehicleAtRooftop(context, vehicleId, rooftopId)
  const changes = { firstName, lastName, email, phone, source, budgetRange, timeframe, tradeInVehicle, notes, interestedVehicleId: vehicleId }
  const requestEvidence = { leadId, expectedUpdatedAt: expectedUpdatedAt.toISOString(), ...changes }

  return context.transaction(async (tx: any) => {
    const replay = await lockAndReplay(tx, eventKey)
    if (replay) {
      const prior = (replay.afterSnapshot || {}) as any
      if (JSON.stringify(prior.requestEvidence) !== JSON.stringify(requestEvidence)) throw new Error('Lead edit idempotency key was reused with different details')
      return { id: leadId, status: String(prior.status || ''), updatedAt: new Date(), reused: true }
    }
    const before = await tx.prisma.lead.findFirst({
      where: { id: leadId, rooftopId, updatedAt: expectedUpdatedAt },
      select: { firstName: true, lastName: true, email: true, phone: true, source: true, budgetRange: true, timeframe: true, tradeInVehicle: true, notes: true, interestedVehicleId: true, status: true },
    })
    if (!before) throw new Error('Lead changed concurrently; reload and retry')
    const changed = await tx.prisma.lead.updateMany({ where: { id: leadId, rooftopId, updatedAt: expectedUpdatedAt }, data: changes })
    if (changed.count !== 1) throw new Error('Lead changed concurrently; reload and retry')
    const updated = await tx.prisma.lead.findUniqueOrThrow({ where: { id: leadId }, select: { status: true, updatedAt: true } })
    const changedFields = Object.keys(changes).filter(field => (before as any)[field] !== (changes as any)[field])
    await recordDomainEventInTransaction(tx, {
      eventKey, rooftopId, aggregateType: 'Lead', aggregateId: leadId, action: 'details-updated', topic: 'lead.details-updated', actorId: context.session.itemId,
      beforeSnapshot: before,
      afterSnapshot: { requestEvidence, status: updated.status, changedFields },
      payload: { rooftopId, leadId, changedFields },
    })
    return { id: leadId, status: updated.status, updatedAt: updated.updatedAt, reused: false }
  }, { timeout: 30_000 })
}
