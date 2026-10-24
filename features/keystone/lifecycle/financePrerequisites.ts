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

export const COMPLIANCE_CHECK_TYPES = ['identity', 'ofac', 'red-flag', 'privacy'] as const
export const COMPLIANCE_CHECK_LABELS: Record<string, string> = { identity: 'identity', ofac: 'OFAC', 'red-flag': 'red-flag', privacy: 'privacy notice' }

/**
 * Which F&I prerequisites a deal structure needs before funding and delivery. The server is the
 * authority; the finance and delivery desks only reflect it.
 *
 * Cash: no credit is extended, so there is no lender, no retail installment contract and no covered
 * credit account. The FTC Red Flags Rule applies to covered (credit) accounts, so the red-flag check
 * is not required. Identity, OFAC screening and the privacy notice stay required: the desk records
 * them for every buyer. The F&I menu is optional; recording payment declines F&I if no menu was
 * presented. The signed buyer's order is still the contract of sale.
 */
export function prerequisitePolicy(deal: { structureType?: unknown }) {
  const cash = deal.structureType === 'cash'
  return {
    cash,
    requiredChecks: (cash ? ['identity', 'ofac', 'privacy'] : [...COMPLIANCE_CHECK_TYPES]) as string[],
    menuOptional: cash,
  }
}

type ScopedWhere = { where: { dealId: string; rooftopId: string; checkType?: string }; orderBy?: Array<Record<string, 'asc' | 'desc'>>; take?: number }
export type PrerequisiteStore = { prisma: {
  financeContractPackage: { findFirst(input: ScopedWhere): Promise<unknown> }
  financeMenuVersion: { findFirst(input: ScopedWhere): Promise<unknown> }
  financeComplianceCheck: { findMany(input: ScopedWhere): Promise<unknown[]> }
  domainAuditEvent: { findFirst(input: { where: { rooftopId: string; aggregateType: string; aggregateId: string; action: string }; orderBy: Array<Record<string, 'desc'>> }): Promise<unknown> }
} }
type StepStore = PrerequisiteStore & { prisma: {
  financeProduct: { findMany(input: { where: { rooftopId: string; active: boolean }; select: { id: true }; take: number }): Promise<Array<{ id: string }>> }
  financeProductQuote: { findMany(input: { where: { dealId: string; rooftopId: string; status: string }; select: { productId: true; evidenceReference: true }; take: number }): Promise<Array<{ productId: string; evidenceReference: string | null }>> }
} }
type PrerequisiteDeal = { id: string; rooftopId: string; structureType?: unknown } & Record<string, unknown>
export type ArtifactRevision = { id: string; status: string; updatedAt: string; revisionHash: string; providerKey?: string }
export type PrerequisiteSnapshot = { version: 1; contract: ArtifactRevision; menu: ArtifactRevision & { version: number }; compliance: Array<ArtifactRevision & { checkType: string }> }
export type PrerequisiteReadiness = { current: boolean; digest: string | null; snapshot: PrerequisiteSnapshot | null; reviewEventKey: string | null; issue: string | null; capability: ReturnType<typeof financingPrerequisiteCapability> }

function revision(row: z.infer<typeof parent> & { status: string; providerKey?: string }): ArtifactRevision {
  const json = stableJson(row)
  if (!json || json.length > 128_000) throw new Error('Prerequisite evidence exceeds bounded review projection')
  return { id: row.id, status: row.status, updatedAt: row.updatedAt.toISOString(), revisionHash: domainEventRequestHash(row), ...(row.providerKey ? { providerKey: row.providerKey } : {}) }
}

function rawStatus(value: unknown) {
  return value && typeof value === 'object' && typeof (value as { status?: unknown }).status === 'string' ? (value as { status: string }).status : null
}

// One reading of the current artifacts, shared by the funding gate and the desks' step list so the
// "next step" a desk shows is always the requirement the server enforces.
async function inspectPrerequisites(tx: PrerequisiteStore, deal: PrerequisiteDeal) {
  const policy = prerequisitePolicy(deal)
  const where = { dealId: deal.id, rooftopId: deal.rooftopId }
  const [rawContract, rawMenu, checkGroups] = await Promise.all([
    tx.prisma.financeContractPackage.findFirst({ where }),
    tx.prisma.financeMenuVersion.findFirst({ where, orderBy: [{ version: 'desc' }, { id: 'desc' }] }),
    // Bound each current reader, not the size of preserved historical evidence.
    Promise.all(policy.requiredChecks.map(checkType => tx.prisma.financeComplianceCheck.findMany({ where: { ...where, checkType }, orderBy: [{ requestedAt: 'desc' }, { id: 'desc' }], take: 1 }))),
  ])
  const contractStatus = rawStatus(rawContract), menuStatus = rawStatus(rawMenu)

  const contract = contractSchema.safeParse(rawContract)
  let contractIssue: string | null = null
  if (!contract.success) {
    contractIssue = policy.cash ? 'Record the signed buyer\'s order first'
      : !rawContract ? 'Prepare and sign the contract package first'
        : `Contract package is ${contractStatus || 'incomplete'}; record the signed contract first`
  } else if (contract.data.dealId !== deal.id || contract.data.rooftopId !== deal.rooftopId) {
    contractIssue = 'Prerequisite belongs to a different deal or rooftop'
  } else if (new Set(contract.data.requiredDocuments).size !== contract.data.requiredDocuments.length || new Set(contract.data.documentChecklist.map(item => item.code)).size !== contract.data.documentChecklist.length || !contract.data.requiredDocuments.every(code => contract.data.documentChecklist.some(item => item.code === code && item.status === 'complete'))) {
    contractIssue = 'Current contract documents are incomplete or contradictory'
  }

  const menu = menuSchema.safeParse(rawMenu)
  let menuIssue: string | null = null
  if (!menu.success) {
    menuIssue = menuStatus === 'presented' ? 'Record the customer\'s F&I menu decision first'
      : policy.cash ? 'Record payment to decline F&I, or present the F&I menu'
        : 'Present the F&I menu and record the customer\'s decision first'
  } else if (menu.data.dealId !== deal.id || menu.data.rooftopId !== deal.rooftopId) {
    menuIssue = 'Prerequisite belongs to a different deal or rooftop'
  } else {
    const available = menu.data.optionsSnapshot.map(option => option.code)
    const choices = [...menu.data.selectedProductCodes, ...menu.data.declinedProductCodes]
    if (new Set(available).size !== available.length || new Set(choices).size !== choices.length || choices.length !== available.length || choices.some(code => !available.includes(code))) menuIssue = 'Current menu decisions do not cover distinct presented options'
    else if ((menu.data.status === 'accepted') !== (menu.data.selectedProductCodes.length > 0)) menuIssue = 'Current menu status contradicts its recorded decisions'
  }

  const checks = policy.requiredChecks.map((checkType, index) => {
    const label = COMPLIANCE_CHECK_LABELS[checkType] || checkType
    const latest = checkGroups[index][0]
    const parsed = checkSchema.safeParse(latest)
    let issue: string | null = null
    if (!latest) issue = `Record the ${label} check first`
    else if (checkGroups[index].length !== 1 || !parsed.success) {
      const status = rawStatus(latest)
      issue = status && status !== 'completed' ? `The ${label} check is ${status}; record it as completed first` : `Current ${checkType} compliance prerequisite is unavailable, foreign or not completed`
    } else if (parsed.data.checkType !== checkType || parsed.data.dealId !== deal.id || parsed.data.rooftopId !== deal.rooftopId) {
      issue = `Current ${checkType} compliance prerequisite is unavailable, foreign or not completed`
    }
    return { checkType, label, data: parsed.success ? parsed.data : null, issue }
  })

  return { policy, contract: contract.success ? contract.data : null, contractStatus, contractIssue,
    menu: menu.success ? menu.data : null, menuStatus, menuIssue, checks }
}

// Caller authorizes the current deal/purpose before entering this privileged read.
// All admitted artifact writers take the same Deal root lock. No network ports.
export async function readCurrentPrerequisites(tx: PrerequisiteStore, deal: PrerequisiteDeal) {
  const inspection = await inspectPrerequisites(tx, deal)
  const checkIssues = inspection.checks.map(check => check.issue)
  // Report the first missing step in the order each structure works it.
  const issues = inspection.policy.cash
    ? [...checkIssues, inspection.contractIssue, inspection.menuIssue]
    : [inspection.menuIssue, ...checkIssues, inspection.contractIssue]
  const issue = issues.find(Boolean)
  if (issue || !inspection.contract || !inspection.menu) throw new Error(issue || 'Current signed contract, decided menu and bounded compliance prerequisites are required')
  const compliance = inspection.checks.map(check => {
    financingPrerequisiteCapability(check.data!.providerKey)
    return { ...revision(check.data!), checkType: check.checkType }
  })
  financingPrerequisiteCapability(inspection.contract.providerKey)
  const snapshot: PrerequisiteSnapshot = { version: 1, contract: revision(inspection.contract), menu: { ...revision(inspection.menu), version: inspection.menu.version }, compliance }
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
      stableJson(review.data.afterSnapshot.snapshot) !== stableJson(current.snapshot)) {
    throw new Error(prerequisitePolicy(deal).cash
      ? 'Record payment to confirm the documents and checks for the current worksheet'
      : 'Prerequisite revisions need explicit review against current accepted terms and configured policy')
  }
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

export type FinanceStepCode = 'approve' | 'quotes' | 'present-menu' | 'decide-menu' | `check:${string}` | 'contract' | 'review' | 'funding' | 'payment' | 'mark-financed' | 'delivery'
/** `todo` steps are required, in order; `optional` steps may be skipped; `available` says whether the server would accept the step now. */
export type FinanceStep = { code: FinanceStepCode; label: string; state: 'done' | 'todo' | 'optional'; available: boolean; blockedReason: string | null; detail: string | null }
export type FinanceStepPlan = { structureType: 'cash' | 'finance'; steps: FinanceStep[]; nextStep: FinanceStepCode | null }

const contractStepLabels: Record<string, string> = {
  preparing: 'Mark contract ready',
  ready: 'Request contract handoff',
  'awaiting-external-handoff': 'Record contract status',
  sent: 'Record contract status',
  viewed: 'Record contract status',
}

/**
 * The finance desk's ordered step list, computed from the same artifact reading the funding gate
 * uses. Only steps whose prerequisites the server would accept are `available`.
 */
export async function financeSteps(tx: StepStore, deal: PrerequisiteDeal & { status?: unknown }, state: { prerequisitesCurrent: boolean; fundingCurrent: boolean }): Promise<FinanceStepPlan> {
  const policy = prerequisitePolicy(deal)
  const structureType = policy.cash ? 'cash' : 'finance'
  const status = String(deal.status || '')
  if (!['submitted', 'approved', 'financed', 'delivered'].includes(status)) return { structureType, steps: [], nextStep: null }
  const [inspection, products, quotes] = await Promise.all([
    inspectPrerequisites(tx, deal),
    tx.prisma.financeProduct.findMany({ where: { rooftopId: deal.rooftopId, active: true }, select: { id: true }, take: 100 }),
    tx.prisma.financeProductQuote.findMany({ where: { dealId: deal.id, rooftopId: deal.rooftopId, status: 'quoted' }, select: { productId: true, evidenceReference: true }, take: 200 }),
  ])
  const quoted = new Set(quotes.filter(quote => String(quote.evidenceReference || '').trim()).map(quote => quote.productId))
  const quotesDone = products.every(product => quoted.has(product.id))
  const approved = status !== 'submitted'
  const fundable = ['approved', 'financed'].includes(status)
  const step = (code: FinanceStepCode, label: string, done: boolean, options: { optional?: boolean; available?: boolean; blockedReason?: string | null; detail?: string | null } = {}): FinanceStep => ({
    code, label, state: done ? 'done' : options.optional ? 'optional' : 'todo',
    available: !done && (options.available ?? true), blockedReason: done || (options.available ?? true) ? null : options.blockedReason ?? null, detail: options.detail ?? null,
  })
  const steps: FinanceStep[] = [step('approve', 'Approve deal', approved, { available: status === 'submitted' })]
  const menuPresented = inspection.menuStatus === 'presented'
  const menuDecided = !inspection.menuIssue

  if (!policy.cash || menuPresented || menuDecided || products.length > 0) {
    const optional = policy.cash && !menuPresented
    if (products.length > 0 && !menuDecided && !menuPresented) steps.push(step('quotes', 'Record product quotes', quotesDone, { optional }))
    if (!menuDecided && !menuPresented) {
      steps.push(step('present-menu', products.length ? 'Present F&I menu' : 'Present F&I menu (no products)', false, {
        optional, available: quotesDone, blockedReason: 'Record product quotes first',
      }))
    }
    steps.push(step('decide-menu', menuDecided ? `F&I menu ${inspection.menu?.status || 'decided'}` : 'Record menu decision', menuDecided, {
      optional, available: menuPresented, blockedReason: 'Present the F&I menu first',
    }))
  } else {
    steps.push(step('decide-menu', 'F&I menu', false, { optional: true, available: false, detail: 'Not required for cash. Recording payment declines F&I.' }))
  }

  for (const check of inspection.checks) {
    steps.push(step(`check:${check.checkType}`, `Record ${check.label} check`, !check.issue, { detail: check.issue && rawCheckDetail(check.issue) }))
  }

  steps.push(step('contract', policy.cash ? 'Record signed buyer\'s order' : (contractStepLabels[inspection.contractStatus || ''] || 'Prepare contract package'), !inspection.contractIssue, {
    detail: inspection.contractStatus && inspection.contractIssue ? `Contract ${inspection.contractStatus}` : null,
  }))

  // Cash: an undecided presented menu blocks payment; no menu at all does not (payment declines F&I).
  const menuBlocks = policy.cash ? menuPresented : true
  const artifactIssue = [menuBlocks ? inspection.menuIssue : null, ...inspection.checks.map(check => check.issue), inspection.contractIssue].find(Boolean) || null
  if (policy.cash) {
    steps.push(step('payment', 'Record payment', state.fundingCurrent, {
      available: fundable && !artifactIssue, blockedReason: !approved ? 'Approve the deal first' : artifactIssue,
    }))
  } else {
    steps.push(step('review', 'Review prerequisites', state.prerequisitesCurrent, {
      available: fundable && !artifactIssue, blockedReason: !approved ? 'Approve the deal first' : artifactIssue,
    }))
    steps.push(step('funding', 'Record funding', state.fundingCurrent, {
      available: fundable && state.prerequisitesCurrent, blockedReason: !approved ? 'Approve the deal first' : 'Review prerequisites first',
    }))
  }
  steps.push(step('mark-financed', policy.cash ? 'Release to delivery' : 'Mark financed', ['financed', 'delivered'].includes(status), {
    available: status === 'approved' && state.fundingCurrent, blockedReason: policy.cash ? 'Record payment first' : 'Record funding first',
  }))
  steps.push(step('delivery', 'Open delivery', status === 'delivered', { available: status === 'financed', blockedReason: policy.cash ? 'Release to delivery first' : 'Mark financed first' }))
  return { structureType, steps, nextStep: steps.find(item => item.state === 'todo')?.code ?? null }
}

function rawCheckDetail(issue: string) {
  return issue.startsWith('The ') ? issue.replace(/; record it as completed first$/, '') : null
}
