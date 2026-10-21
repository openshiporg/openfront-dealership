import { permissions } from '../access'
import { assertSessionRooftopPermission } from '../tenantRecords'
import { recordDomainEvent, recordDomainEventInTransaction } from '../lifecycle/domainEvents'
import { resolveFinancingProviderAdapter } from '../../integrations/financing'
import { assertFinancingTransition } from '../lifecycle/financingLifecycle'
import { financingIdempotencyKey } from './financingUtils'

export async function queueFinancingApplication(
  _root: unknown,
  { applicationId, providerKey, idempotencyKey: rawKey }: { applicationId: string; providerKey: string; idempotencyKey: string },
  context: any
) {
  if (!context.session || !permissions.canManageFinancing({ session: context.session })) {
    throw new Error('Access denied: financing permission required')
  }
  const adapter = resolveFinancingProviderAdapter(String(providerKey || '').trim())
  const idempotencyKey = financingIdempotencyKey(rawKey, 'lender-submission')
  const replay = await context.sudo().prisma.lenderSubmission.findUnique({
    where: { idempotencyKey },
    select: { id: true, applicationId: true, providerKey: true, rooftopId: true, status: true },
  })
  if (replay) {
    await assertSessionRooftopPermission(context, replay.rooftopId, 'canManageFinancing')
    if (replay.applicationId !== applicationId || replay.providerKey !== adapter.key) throw new Error('Lender submission idempotency key was reused with different evidence')
    await recordDomainEvent(context, {
      eventKey: `lender-submission:${idempotencyKey}`,
      rooftopId: replay.rooftopId,
      aggregateType: 'LenderSubmission',
      aggregateId: replay.id,
      action: 'queued',
      topic: 'lender-submission.queued',
      actorId: context.session.itemId,
      afterSnapshot: { applicationId: replay.applicationId, providerKey: adapter.key, status: replay.status },
      payload: { submissionId: replay.id, applicationId: replay.applicationId, rooftopId: replay.rooftopId, status: replay.status },
    })
    return context.db.LenderSubmission.findOne({ where: { id: replay.id } })
  }
  const application = await context.query.FinancingApplication.findOne({
    where: { id: applicationId },
    query: 'id reference status requestedAmountCents rooftop { id } vehicle { vin }',
  })
  if (!application?.rooftop?.id) throw new Error('Financing application not found')
  await assertSessionRooftopPermission(context, application.rooftop.id, 'canManageFinancing')
  if (application.status === 'submitted') assertFinancingTransition(application.status, 'under-review')
  else if (application.status !== 'under-review') throw new Error('Only submitted applications can be queued')

  const providerResult = await adapter.submit({
    applicationReference: application.reference,
    idempotencyKey,
    requestedAmountCents: application.requestedAmountCents || 0,
    vehicleVin: application.vehicle?.vin || null,
  })

  const submissionId = await context.transaction(async (tx: any) => {
    await tx.prisma.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${idempotencyKey}, 0))`
    const existing = await tx.prisma.lenderSubmission.findUnique({ where: { idempotencyKey }, select: { id: true } })
    if (existing) return existing.id
    if (application.status === 'submitted') {
      const changed = await tx.prisma.financingApplication.updateMany({
        where: { id: application.id, status: 'submitted' },
        data: { status: 'under-review' },
      })
      if (changed.count !== 1) throw new Error('Financing application changed; refresh and retry')
    }
    const created = await tx.prisma.lenderSubmission.create({
      data: {
        rooftopId: application.rooftop.id,
        applicationId: application.id,
        providerKey: adapter.key,
        idempotencyKey,
        status: providerResult.status,
        externalReference: providerResult.externalReference,
        requestSnapshot: {
          version: 1,
          applicationReference: application.reference,
          requestedAmountCents: application.requestedAmountCents || 0,
          vehicleVin: application.vehicle?.vin || null,
        },
        responseSummary: providerResult.responseSummary,
        queuedAt: new Date(),
      },
      select: { id: true },
    })
    await recordDomainEventInTransaction(tx, {
      eventKey: `lender-submission:${idempotencyKey}`,
      rooftopId: application.rooftop.id,
      aggregateType: 'LenderSubmission',
      aggregateId: created.id,
      action: 'queued',
      topic: 'lender-submission.queued',
      actorId: context.session.itemId,
      afterSnapshot: { applicationId: application.id, providerKey: adapter.key, status: providerResult.status },
      payload: { submissionId: created.id, applicationId: application.id, rooftopId: application.rooftop.id, status: providerResult.status },
    })
    return created.id
  }, { timeout: 30_000 })

  return context.db.LenderSubmission.findOne({ where: { id: submissionId } })
}
