import { z } from 'zod'
import { domainEventRequestHash, stableJson } from './domainEvents'
import { fundingBinding } from './dealFinanceEvidence'
import { financingPrerequisiteCapability } from '../../integrations/financing'

const text = z.string().trim().min(1).max(1000)
const date = z.date().refine(value => Number.isFinite(value.getTime()))
const parent = z.object({ id: text, dealId: text, rooftopId: text, updatedAt: date })
const documents = z.array(z.object({ code: text, status: text })).max(100)
const contractSchema = parent.extend({ status: z.literal('signed'), providerKey: text, envelopeReference: text,
  requiredDocuments: z.array(text).min(1).max(100), documentChecklist: documents,
  signedAt: date, immutableStatusEvidence: z.object({ evidenceReference: text }).passthrough() })
const menuSchema = parent.extend({ version: z.number().int().positive(), status: z.enum(['accepted', 'declined']),
  optionsSnapshot: z.array(z.object({ code: text }).passthrough()).max(100), selectedProductCodes: z.array(text).max(100),
  declinedProductCodes: z.array(text).max(100), disclosureAcknowledgment: text, decidedAt: date })
const checkSchema = parent.extend({ checkType: z.enum(['identity', 'ofac', 'red-flag', 'privacy']), providerKey: text,
  status: z.literal('completed'), requestedAt: date, completedAt: date, requestSnapshot: z.unknown(),
  resultSnapshot: z.object({ evidenceReference: text }).passthrough() })

type ScopedWhere = { where: { dealId: string; rooftopId: string; checkType?: string }; orderBy?: Array<Record<string, 'asc' | 'desc'>>; take?: number }
export type PrerequisiteStore = { prisma: {
  financeContractPackage: { findFirst(input: ScopedWhere): Promise<unknown> }
  financeMenuVersion: { findFirst(input: ScopedWhere): Promise<unknown> }
  financeComplianceCheck: { findMany(input: ScopedWhere): Promise<unknown[]> }
  domainAuditEvent: { findFirst(input: { where: { rooftopId: string; aggregateType: string; aggregateId: string; action: string }; orderBy: Array<Record<string, 'desc'>> }): Promise<unknown> }
} }
type PrerequisiteDeal = { id: string; rooftopId: string } & Record<string, unknown>
export type ArtifactRevision = { id: string; status: string; updatedAt: string; revisionHash: string; providerKey?: string }
export type PrerequisiteSnapshot = { version: 1; contract: ArtifactRevision; menu: ArtifactRevision & { version: number }; compliance: Array<ArtifactRevision & { checkType: string }> }
export type PrerequisiteReadiness = { current: boolean; digest: string | null; snapshot: PrerequisiteSnapshot | null; reviewEventKey: string | null; issue: string | null; capability: ReturnType<typeof financingPrerequisiteCapability> }

function revision(row: z.infer<typeof parent> & { status: string; providerKey?: string }): ArtifactRevision {
  const json = stableJson(row)
  if (!json || json.length > 128_000) throw new Error('Prerequisite evidence exceeds bounded review projection')
  return { id: row.id, status: row.status, updatedAt: row.updatedAt.toISOString(), revisionHash: domainEventRequestHash(row), ...(row.providerKey ? { providerKey: row.providerKey } : {}) }
}

// Caller authorizes the current deal/purpose before entering this privileged read.
// All admitted artifact writers take the same Deal root lock. No network ports.
export async function readCurrentPrerequisites(tx: PrerequisiteStore, deal: { id: string; rooftopId: string }) {
  const where = { dealId: deal.id, rooftopId: deal.rooftopId }
  const requiredChecks = ['identity', 'ofac', 'red-flag', 'privacy']
  const [rawContract, rawMenu, checkGroups] = await Promise.all([
    tx.prisma.financeContractPackage.findFirst({ where }),
    tx.prisma.financeMenuVersion.findFirst({ where, orderBy: [{ version: 'desc' }, { id: 'desc' }] }),
    // Bound each current reader, not the size of preserved historical evidence.
    Promise.all(requiredChecks.map(checkType => tx.prisma.financeComplianceCheck.findMany({ where: { ...where, checkType }, orderBy: [{ requestedAt: 'desc' }, { id: 'desc' }], take: 1 }))),
  ])
  const contract = contractSchema.safeParse(rawContract), menu = menuSchema.safeParse(rawMenu)
  if (!contract.success || !menu.success) throw new Error('Current signed contract, decided menu and bounded compliance prerequisites are required')
  for (const artifact of [contract.data, menu.data]) if (artifact.dealId !== deal.id || artifact.rooftopId !== deal.rooftopId) throw new Error('Prerequisite belongs to a different deal or rooftop')
  if (new Set(contract.data.requiredDocuments).size !== contract.data.requiredDocuments.length || new Set(contract.data.documentChecklist.map(item => item.code)).size !== contract.data.documentChecklist.length || !contract.data.requiredDocuments.every(code => contract.data.documentChecklist.some(item => item.code === code && item.status === 'complete'))) throw new Error('Current contract documents are incomplete or contradictory')
  const available = menu.data.optionsSnapshot.map(option => option.code)
  const choices = [...menu.data.selectedProductCodes, ...menu.data.declinedProductCodes]
  if (new Set(available).size !== available.length || new Set(choices).size !== choices.length || choices.length !== available.length || choices.some(code => !available.includes(code))) throw new Error('Current menu decisions do not cover distinct presented options')
  if ((menu.data.status === 'accepted') !== (menu.data.selectedProductCodes.length > 0)) throw new Error('Current menu status contradicts its recorded decisions')
  const compliance = requiredChecks.map((checkType, index) => {
    const parsed = checkSchema.safeParse(checkGroups[index][0])
    if (checkGroups[index].length !== 1 || !parsed.success || parsed.data.checkType !== checkType || parsed.data.dealId !== deal.id || parsed.data.rooftopId !== deal.rooftopId) throw new Error(`Current ${checkType} compliance prerequisite is unavailable, foreign or not completed`)
    financingPrerequisiteCapability(parsed.data.providerKey)
    return { ...revision(parsed.data), checkType }
  })
  financingPrerequisiteCapability(contract.data.providerKey)
  const snapshot: PrerequisiteSnapshot = { version: 1, contract: revision(contract.data), menu: { ...revision(menu.data), version: menu.data.version }, compliance }
  return { snapshot, digest: domainEventRequestHash(snapshot) }
}

const reviewSchema = z.object({ eventKey: text, actorId: text, afterSnapshot: z.object({
  version: z.literal(1), purpose: z.literal('funding-delivery-prerequisite-review'), actorId: text,
  binding: z.unknown(), digest: text, snapshot: z.unknown(),
  policyReference: text, policyVersion: text, reviewerAuthorityReference: text, reviewReference: text,
}) })

export async function assertReviewedPrerequisites(tx: PrerequisiteStore, deal: PrerequisiteDeal, expected?: unknown) {
  const binding = await fundingBinding(tx, deal)
  const current = await readCurrentPrerequisites(tx, deal)
  const raw = await tx.prisma.domainAuditEvent.findFirst({ where: { rooftopId: deal.rooftopId, aggregateType: 'Deal', aggregateId: deal.id, action: 'prerequisites-reviewed' }, orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }] })
  const review = reviewSchema.safeParse(raw)
  if (!review.success || review.data.actorId !== review.data.afterSnapshot.actorId ||
      stableJson(review.data.afterSnapshot.binding) !== stableJson(binding) || review.data.afterSnapshot.digest !== current.digest ||
      stableJson(review.data.afterSnapshot.snapshot) !== stableJson(current.snapshot)) throw new Error('Prerequisite revisions need explicit review against current accepted terms and configured policy')
  const evidence = { ...current, reviewEventKey: review.data.eventKey, binding,
    policyReference: review.data.afterSnapshot.policyReference, policyVersion: review.data.afterSnapshot.policyVersion,
    reviewerAuthorityReference: review.data.afterSnapshot.reviewerAuthorityReference,
    capability: financingPrerequisiteCapability('operator-recorded') }
  if (expected !== undefined && stableJson(expected) !== stableJson(evidence)) throw new Error('Funding prerequisite revisions or review were invalidated; review and reconfirm')
  return evidence
}

export async function prerequisiteReadiness(tx: PrerequisiteStore, deal: PrerequisiteDeal): Promise<PrerequisiteReadiness> {
  let digest: string | null = null, snapshot: PrerequisiteSnapshot | null = null
  try {
    const current = await readCurrentPrerequisites(tx, deal); digest = current.digest; snapshot = current.snapshot
    const reviewed = await assertReviewedPrerequisites(tx, deal)
    return { current: true, digest, snapshot, reviewEventKey: reviewed.reviewEventKey, issue: null, capability: reviewed.capability }
  } catch (error) {
    return { current: false, digest, snapshot, reviewEventKey: null, issue: error instanceof Error ? error.message : 'Prerequisite authority unavailable', capability: financingPrerequisiteCapability('operator-recorded') }
  }
}
