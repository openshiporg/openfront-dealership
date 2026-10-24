import { permissions } from '../access'
import { recordDomainEventInTransaction } from '../lifecycle/domainEvents'
import { assertSessionRooftopPermission } from '../tenantRecords'

export const RETENTION_CATEGORIES = ['customer-intake', 'report-export', 'provider-payload', 'audit-evidence'] as const
export const MAX_RETENTION_DAYS = 36500

function requiredText(value: unknown, label: string, max: number) {
  const text = String(value ?? '').trim()
  if (!text) throw new Error(`${label} is required`)
  if (text.length > max) throw new Error(`${label} must be ${max} characters or fewer`)
  return text
}

function parseExpected(value: unknown) {
  if (value == null || value === '') return null
  const date = value instanceof Date ? value : new Date(String(value))
  if (Number.isNaN(date.getTime())) throw new Error('expectedUpdatedAt is invalid')
  return date
}

/**
 * Creates or updates the retention rule for one rooftop and category. RetentionPolicy is
 * command-only (every Keystone write is denied), so this is the only writer. Each change is
 * idempotent on `idempotencyKey`, optimistic-locked on `updatedAt` once the rule exists, and
 * recorded as a `retention.policy-configured` domain event with before and after snapshots.
 */
export async function configureRetentionPolicy(_root: unknown, { data }: { data: Record<string, unknown> }, context: any) {
  const actorId = context.session?.itemId
  if (!actorId || !permissions.canManageDealerships({ session: context.session })) {
    throw new Error('Dealership administration permission is required')
  }

  const rooftopId = requiredText(data.rooftopId, 'Rooftop', 100)
  const category = String(data.category || '')
  if (!(RETENTION_CATEGORIES as readonly string[]).includes(category)) throw new Error('Retention category is invalid')
  const retentionDays = Number(data.retentionDays)
  if (!Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > MAX_RETENTION_DAYS) {
    throw new Error(`Retention days must be a whole number from 1 to ${MAX_RETENTION_DAYS}`)
  }
  const legalHold = data.legalHold === true
  const rationale = requiredText(data.rationale, 'Rationale', 1000)
  const idempotencyKey = requiredText(data.idempotencyKey, 'Idempotency key', 200)
  const expectedUpdatedAt = parseExpected(data.expectedUpdatedAt)

  await assertSessionRooftopPermission(context, rooftopId, 'canManageDealerships')

  const eventKey = `retention-policy:${idempotencyKey}`
  const after = { rooftopId, category, retentionDays, legalHold, rationale }

  const policyId: string = await context.transaction(async (tx: any) => {
    await tx.prisma.$queryRaw`SELECT 1 AS "locked" FROM pg_advisory_xact_lock(hashtextextended(${`command:${eventKey}`}, 0))`
    const replay = await tx.prisma.domainAuditEvent.findUnique({ where: { eventKey }, select: { aggregateId: true, afterSnapshot: true } })
    if (replay) {
      const prior = (replay.afterSnapshot || {}) as Record<string, unknown>
      if (prior.rooftopId !== rooftopId || prior.category !== category || prior.retentionDays !== retentionDays || prior.legalHold !== legalHold || prior.rationale !== rationale) {
        throw new Error('Retention policy idempotency key was reused with different evidence')
      }
      return String(replay.aggregateId)
    }

    // Serialise changes to the same rooftop and category.
    await tx.prisma.$queryRaw`SELECT 1 AS "locked" FROM pg_advisory_xact_lock(hashtextextended(${`retention-policy:${rooftopId}:${category}`}, 0))`
    const existing = await tx.prisma.retentionPolicy.findFirst({ where: { rooftopId, category } })

    let id: string
    if (existing) {
      if (!expectedUpdatedAt) throw new Error('expectedUpdatedAt is required to change an existing retention policy')
      if (!existing.updatedAt || new Date(existing.updatedAt).getTime() !== expectedUpdatedAt.getTime()) {
        throw new Error('Retention policy changed since it was loaded')
      }
      const changed = await tx.prisma.retentionPolicy.updateMany({
        where: { id: existing.id, updatedAt: existing.updatedAt },
        data: { retentionDays, legalHold, rationale, idempotencyKey, updatedAt: new Date() },
      })
      if (changed.count !== 1) throw new Error('Retention policy changed since it was loaded')
      id = existing.id
    } else {
      if (expectedUpdatedAt) throw new Error('Retention policy no longer exists')
      const now = new Date()
      const created = await tx.prisma.retentionPolicy.create({
        data: { rooftopId, category, retentionDays, legalHold, rationale, idempotencyKey, createdAt: now, updatedAt: now },
        select: { id: true },
      })
      id = created.id
    }

    const before = existing
      ? { rooftopId, category, retentionDays: existing.retentionDays, legalHold: Boolean(existing.legalHold), rationale: existing.rationale }
      : null
    const action = !existing ? 'created' : before!.legalHold !== legalHold ? (legalHold ? 'legal-hold-placed' : 'legal-hold-released') : 'updated'
    await recordDomainEventInTransaction(tx, {
      eventKey,
      rooftopId,
      aggregateType: 'RetentionPolicy',
      aggregateId: id,
      action,
      topic: 'retention.policy-configured',
      actorId,
      beforeSnapshot: before,
      afterSnapshot: after,
      payload: { rooftopId, policyId: id, category, retentionDays, legalHold },
    })
    return id
  }, { timeout: 30_000 })

  return context.db.RetentionPolicy.findOne({ where: { id: policyId } })
}
