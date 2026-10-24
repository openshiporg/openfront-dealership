import { permissions } from '../access'
import { assertSessionRooftopPermission } from '../tenantRecords'
import { recordDomainEventInTransaction } from '../lifecycle/domainEvents'
import { financingIdempotencyKey } from './financingUtils'
import { operatorCommand } from './operatorCommandErrors'

/**
 * Operator-recorded lenders are worked outside the platform: the desk queues the application, staff
 * send it to the lender portal, then record here that it went out (with the lender's reference) or
 * that it could not be sent. Only a queued submission moves; sent and failed are final.
 */
async function recordLenderSubmissionStatusCommand(_root: unknown, { data }: { data: any }, context: any) {
  if (!context.session?.itemId || !permissions.canManageFinancing({ session: context.session })) {
    throw new Error('Financing permission is required')
  }
  const submissionId = String(data?.submissionId || '').trim()
  const status = String(data?.status || '')
  if (!['submitted', 'failed'].includes(status)) throw new Error('Submission status must be submitted or failed')
  const externalReference = String(data?.externalReference || '').trim()
  const errorCode = String(data?.errorCode || '').trim()
  if (status === 'submitted' && (!externalReference || externalReference.length > 200)) throw new Error('Enter the lender reference')
  if (status === 'failed' && (!errorCode || errorCode.length > 200)) throw new Error('Enter why the submission failed')
  const idempotencyKey = financingIdempotencyKey(data?.idempotencyKey, 'lender-submission-status')

  const accessible = await context.query.LenderSubmission.findOne({ where: { id: submissionId }, query: 'id rooftop { id }' })
  if (!accessible?.rooftop?.id) throw new Error('Lender submission not found')
  await assertSessionRooftopPermission(context, accessible.rooftop.id, 'canManageFinancing')

  const id = await context.transaction(async (tx: any) => {
    await tx.prisma.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`lender-submission-status:${submissionId}`}, 0))`
    const eventKey = `lender-submission-status:${idempotencyKey}`
    const prior = await tx.prisma.domainAuditEvent.findUnique({ where: { eventKey }, select: { aggregateId: true } })
    if (prior) {
      if (prior.aggregateId !== submissionId) throw new Error('Idempotency key belongs to another submission')
      return submissionId
    }
    const submission = await tx.prisma.lenderSubmission.findUnique({ where: { id: submissionId }, select: { id: true, rooftopId: true, applicationId: true, providerKey: true, status: true } })
    if (!submission || submission.rooftopId !== accessible.rooftop.id) throw new Error('Lender submission not found')
    if (submission.providerKey !== 'operator-recorded') throw new Error('Only operator-recorded submissions are updated by hand')
    if (submission.status !== 'queued') throw new Error(`Submission is already ${submission.status}`)
    const now = new Date()
    const changed = await tx.prisma.lenderSubmission.updateMany({
      where: { id: submission.id, status: 'queued' },
      data: status === 'submitted'
        ? { status, externalReference, submittedAt: now, errorCode: null }
        : { status, errorCode },
    })
    if (changed.count !== 1) throw new Error('Lender submission changed; refresh and retry')
    await recordDomainEventInTransaction(tx, {
      eventKey,
      rooftopId: submission.rooftopId,
      aggregateType: 'LenderSubmission',
      aggregateId: submission.id,
      action: status,
      topic: 'lender-submission.updated',
      actorId: context.session.itemId,
      afterSnapshot: { applicationId: submission.applicationId, status, externalReference: externalReference || null, errorCode: errorCode || null, recordedAt: now.toISOString() },
      payload: { submissionId: submission.id, applicationId: submission.applicationId, rooftopId: submission.rooftopId, status },
    })
    return submission.id
  }, { timeout: 30_000 })

  return context.db.LenderSubmission.findOne({ where: { id } })
}

export const recordLenderSubmissionStatus = operatorCommand(recordLenderSubmissionStatusCommand)
