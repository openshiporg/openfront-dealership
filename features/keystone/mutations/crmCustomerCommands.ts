import { permissions } from '../access'
import { commandDate } from '../lifecycle/commandDate'
import { recordDomainEventInTransaction } from '../lifecycle/domainEvents'
import { assertSessionRooftopPermission } from '../tenantRecords'
import { customerIdentityKey, normalizeCustomerEmail, normalizeCustomerPhone, resolveMergedCustomer } from './customerIdentity'

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

async function lockAndReplay(tx: any, eventKey: string) {
  await tx.prisma.$queryRaw`SELECT 1 AS "locked" FROM pg_advisory_xact_lock(hashtextextended(${`command:${eventKey}`}, 0))`
  return tx.prisma.domainAuditEvent.findUnique({ where: { eventKey }, select: { aggregateId: true, afterSnapshot: true, metadata: true } })
}

async function visibleActiveCustomer(context: any, customerId: string) {
  const customer = await context.query.Customer.findOne({ where: { id: customerId }, query: 'id status rooftop { id }' })
  if (!customer?.rooftop?.id || customer.status !== 'active') throw new Error('Customer not found or not accessible')
  return customer as { id: string; status: string; rooftop: { id: string } }
}

/**
 * Corrects a customer's name and primary contact points. A contact point that already identifies a
 * different customer at the rooftop is refused, so intake keeps resolving to one record; those
 * records are merged instead. The original identity key is kept as an alias.
 */
export async function updateCustomerContact(_root: unknown, { data }: any, context: any) {
  requireLeadManager(context)
  const customerId = requiredText(data.customerId, 'Customer', 100)
  const expectedUpdatedAt = commandDate(data.expectedUpdatedAt, 'Customer expectedUpdatedAt')
  const firstName = requiredText(data.firstName, 'First name', 100)
  const lastName = requiredText(data.lastName, 'Last name', 100)
  const primaryEmail = optionalText(data.primaryEmail, 'Email', 320).toLowerCase()
  const primaryPhone = optionalText(data.primaryPhone, 'Phone', 50)
  if (primaryEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(primaryEmail)) throw new Error('Email is invalid')
  const normalizedEmail = normalizeCustomerEmail(primaryEmail)
  const normalizedPhone = normalizeCustomerPhone(primaryPhone)
  if (primaryPhone && (normalizedPhone.length < 7 || normalizedPhone.length > 15)) throw new Error('Phone is invalid')
  if (!normalizedEmail && !normalizedPhone) throw new Error('An email or phone is required')
  const eventKey = `customer-contact:${idempotencyKey(data.idempotencyKey)}`
  const visible = await visibleActiveCustomer(context, customerId)
  const rooftopId = visible.rooftop.id
  await assertSessionRooftopPermission(context, rooftopId, 'canManageLeads')
  const requestEvidence = { customerId, expectedUpdatedAt: expectedUpdatedAt.toISOString(), firstName, lastName, primaryEmail, primaryPhone }

  return context.transaction(async (tx: any) => {
    // Same rooftop lock as intake and merge, so the conflict check below cannot race them.
    await tx.prisma.$queryRaw`SELECT 1 AS "locked" FROM pg_advisory_xact_lock(hashtextextended(${`customer-identity-rooftop:${rooftopId}`}, 0))`
    const replay = await lockAndReplay(tx, eventKey)
    if (replay) {
      const prior = (replay.afterSnapshot || {}) as any
      if (JSON.stringify(prior.requestEvidence) !== JSON.stringify(requestEvidence)) throw new Error('Customer edit idempotency key was reused with different details')
      return { id: customerId, status: 'active', updatedAt: new Date(), reused: true }
    }
    const before = await tx.prisma.customer.findFirst({
      where: { id: customerId, rooftopId, status: 'active', updatedAt: expectedUpdatedAt },
      select: { firstName: true, lastName: true, primaryEmail: true, primaryPhone: true, normalizedEmail: true, normalizedPhone: true, accountId: true },
    })
    if (!before) throw new Error('Customer changed concurrently; reload and retry')
    const identities = [
      ...(normalizedEmail ? [{ normalizedEmail }, { identityKey: customerIdentityKey(rooftopId, normalizedEmail, '') }] : []),
      ...(normalizedPhone ? [{ normalizedPhone }, { identityKey: customerIdentityKey(rooftopId, '', normalizedPhone) }] : []),
    ]
    const matches = await tx.prisma.customer.findMany({
      where: { rooftopId, id: { not: customerId }, status: { in: ['active', 'merged'] }, OR: identities },
      select: { id: true, normalizedEmail: true, normalizedPhone: true },
      take: 50,
    })
    for (const match of matches) {
      const root = await resolveMergedCustomer(tx, match.id, rooftopId)
      if (root.id === customerId) continue
      const field = normalizedEmail && match.normalizedEmail === normalizedEmail ? 'email' : normalizedPhone && match.normalizedPhone === normalizedPhone ? 'phone' : 'contact point'
      throw new Error(`Another customer already uses this ${field}; merge the records instead`)
    }
    const accountUnlinked = Boolean(before.accountId) && before.normalizedEmail !== normalizedEmail
    const changed = await tx.prisma.customer.updateMany({
      where: { id: customerId, rooftopId, status: 'active', updatedAt: expectedUpdatedAt },
      // A storefront account link proves ownership of the old email only, so an email change drops it.
      data: { firstName, lastName, primaryEmail, primaryPhone, normalizedEmail, normalizedPhone, ...(accountUnlinked ? { accountId: null } : {}) },
    })
    if (changed.count !== 1) throw new Error('Customer changed concurrently; reload and retry')
    const updated = await tx.prisma.customer.findUniqueOrThrow({ where: { id: customerId }, select: { updatedAt: true } })
    await recordDomainEventInTransaction(tx, {
      eventKey, rooftopId, aggregateType: 'Customer', aggregateId: customerId, action: 'contact-updated', topic: 'customer.contact-updated', actorId: context.session.itemId,
      beforeSnapshot: before,
      afterSnapshot: { requestEvidence, normalizedEmail, normalizedPhone, accountUnlinked },
      payload: { rooftopId, customerId },
    })
    return { id: customerId, status: 'active', updatedAt: updated.updatedAt, reused: false }
  }, { timeout: 30_000 })
}

/** Removes one customer from their household. The household record stays for the remaining members. */
export async function unlinkCustomerHousehold(_root: unknown, { data }: any, context: any) {
  requireLeadManager(context)
  const customerId = requiredText(data.customerId, 'Customer', 100)
  const expectedUpdatedAt = commandDate(data.expectedUpdatedAt, 'Customer expectedUpdatedAt')
  const reason = requiredText(data.reason, 'Reason', 1000)
  const eventKey = `customer-household-unlink:${idempotencyKey(data.idempotencyKey)}`
  const visible = await visibleActiveCustomer(context, customerId)
  const rooftopId = visible.rooftop.id
  await assertSessionRooftopPermission(context, rooftopId, 'canManageLeads')
  const requestEvidence = { customerId, expectedUpdatedAt: expectedUpdatedAt.toISOString(), reason }

  return context.transaction(async (tx: any) => {
    const replay = await lockAndReplay(tx, eventKey)
    if (replay) {
      const prior = (replay.afterSnapshot || {}) as any
      if (JSON.stringify(prior.requestEvidence) !== JSON.stringify(requestEvidence)) throw new Error('Household unlink idempotency key was reused with different details')
      return { id: customerId, status: 'unlinked', updatedAt: new Date(), reused: true }
    }
    const current = await tx.prisma.customer.findFirst({ where: { id: customerId, rooftopId, status: 'active', updatedAt: expectedUpdatedAt }, select: { householdId: true } })
    if (!current) throw new Error('Customer changed concurrently; reload and retry')
    if (!current.householdId) throw new Error('Customer is not in a household')
    const changed = await tx.prisma.customer.updateMany({ where: { id: customerId, rooftopId, status: 'active', updatedAt: expectedUpdatedAt }, data: { householdId: null } })
    if (changed.count !== 1) throw new Error('Customer changed concurrently; reload and retry')
    const updated = await tx.prisma.customer.findUniqueOrThrow({ where: { id: customerId }, select: { updatedAt: true } })
    await recordDomainEventInTransaction(tx, {
      eventKey, rooftopId, aggregateType: 'CustomerHousehold', aggregateId: current.householdId, action: 'member-unlinked', topic: 'customer.household-unlinked', actorId: context.session.itemId,
      afterSnapshot: { requestEvidence, householdId: current.householdId },
      payload: { rooftopId, householdId: current.householdId, customerId },
    })
    return { id: customerId, status: 'unlinked', updatedAt: updated.updatedAt, reused: false }
  }, { timeout: 30_000 })
}
