import { z } from 'zod'
import { commandDate } from '../lifecycle/commandDate'
import { currentDealAuthority, fundingBinding, lockDeal } from '../lifecycle/dealFinanceEvidence'
import { domainEventRequestHash, recordDomainEventInTransaction, stableJson } from '../lifecycle/domainEvents'
import { readCurrentPrerequisites } from '../lifecycle/financePrerequisites'
import { financingPrerequisiteCapability } from '../../integrations/financing'

const reference = z.string().trim().min(1).max(200)
const input = z.object({ dealId: reference, worksheetVersion: z.number().int().positive(), expectedUpdatedAt: z.union([z.date(), reference]),
  expectedPrerequisiteDigest: z.string().regex(/^[a-f0-9]{64}$/), providerKey: z.literal('operator-recorded'),
  reviewReference: reference, policyReference: reference, policyVersion: reference, reviewerAuthorityReference: reference,
  idempotencyKey: z.string().trim().min(8).max(180) }).strict()

export async function reviewFinancePrerequisites(_root: unknown, { data }: { data: unknown }, context: Parameters<typeof currentDealAuthority>[0]) {
  const request = input.parse(data)
  const expected = commandDate(request.expectedUpdatedAt)
  const actorId = context.session?.itemId
  if (!actorId) throw new Error('Authentication required')
  const purpose = 'funding-delivery-prerequisite-review'
  const eventKey = `finance-prerequisite-review:${request.idempotencyKey}`
  return context.transaction(async (tx: Parameters<typeof currentDealAuthority>[0]) => {
    await lockDeal(tx, request.dealId)
    const authority = await currentDealAuthority(tx, context.session, request.dealId, ['canManageFinancing'])
    const deal = await tx.prisma.deal.findUnique({ where: { id: request.dealId } })
    if (!deal || deal.rooftopId !== authority.rooftopId) throw new Error('Deal authority changed')
    const body = { ...request, expectedUpdatedAt: expected.toISOString(), idempotencyKey: undefined, actorId, purpose }
    const prior = await tx.prisma.domainAuditEvent.findUnique({ where: { eventKey } })
    if (prior) {
      if (prior.actorId !== actorId || prior.rooftopId !== deal.rooftopId || stableJson(prior.afterSnapshot?.request) !== stableJson(body)) throw new Error('Prerequisite review retry is changed or outside original actor/purpose scope')
      return { id: deal.id, status: 'review-recorded', reused: true, updatedAt: prior.occurredAt }
    }
    if (!['approved', 'financed'].includes(deal.status) || deal.worksheetVersion !== request.worksheetVersion || deal.updatedAt.getTime() !== expected.getTime()) throw new Error('Current approved or financed worksheet is required for prerequisite review')
    const binding = await fundingBinding(tx, deal)
    const current = await readCurrentPrerequisites(tx, deal)
    if (current.digest !== request.expectedPrerequisiteDigest) throw new Error('Prerequisite artifacts changed; refresh and inspect before review')
    const afterSnapshot = { version: 1, purpose, actorId, request: body, ...current, binding,
      reviewReference: request.reviewReference, policyReference: request.policyReference, policyVersion: request.policyVersion,
      reviewerAuthorityReference: request.reviewerAuthorityReference, capability: financingPrerequisiteCapability(request.providerKey),
      // A version-bound human record, not a software-issued legal or vendor approval.
      acceptedTermsHash: domainEventRequestHash(deal.acceptedSnapshot) }
    const occurredAt = new Date()
    await recordDomainEventInTransaction(tx, { eventKey, rooftopId: deal.rooftopId, aggregateType: 'Deal', aggregateId: deal.id,
      action: 'prerequisites-reviewed', topic: 'finance-prerequisites.reviewed', actorId, afterSnapshot, occurredAt,
      payload: { dealId: deal.id, rooftopId: deal.rooftopId, worksheetVersion: deal.worksheetVersion } })
    return { id: deal.id, status: 'review-recorded', reused: false, updatedAt: occurredAt }
  }, { timeout: 30_000, isolationLevel: 'Serializable' })
}
