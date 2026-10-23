'use client'

import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import Link from 'next/link'
import { Plus, RefreshCw, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageContainer } from '@/features/dashboard/components/PageContainer'
import { basePath } from '@/features/dashboard/lib/config'
import { OperatorActionDialog, type OperatorActionField } from '@/features/platform/components/OperatorActionDialog'
import {
  Code,
  DeskHeader,
  DeskSection,
  Facts,
  Notice,
  Panel,
  Pill,
  Readout,
  ReadoutStrip,
  Segmented,
  TitleLine,
  Track,
  type DeskTone,
} from '@/features/platform/components/desk'
import { readFinanceEvidence } from '@/features/platform/deals/lib/financeEvidence'
import { FinanceEvidenceHistory } from '@/features/platform/deals/components/FinanceEvidenceHistory'
import { cn } from '@/lib/utils'
import {
  configureFinanceProduct,
  decideFinanceMenu,
  getFinanceWorkspace,
  manageFinanceContractPackage,
  manageFinanceFundingCase,
  openFinanceFollowUp,
  presentFinanceMenu,
  queueFinancingApplication,
  recordFinanceComplianceCheck,
  recordFinanceProductCancellation,
  recordFinanceProductQuote,
  recordLenderDecision,
  reviewFinancePrerequisites,
  transitionDeal,
} from '../actions'
import type {
  ComplianceCheck,
  ContractPackage,
  Deal,
  FinanceApplication,
  FinanceLead,
  FinanceMenu,
  FinanceProduct,
  FinanceSubmission,
  FinanceWorkspace,
  FundingCase,
  ProductCancellation,
  ProductQuote,
} from '../lib/types'

type FinanceTask = { kind: string; deal?: Deal; application?: FinanceApplication; menu?: FinanceMenu; submission?: FinanceSubmission; decision?: string; nextStatus?: string; fields: Record<string, string>; idempotencyKey: string }

const statusLabels: Record<string, string> = {
  pencil: 'Pencil',
  submitted: 'Submitted',
  approved: 'Approved',
  financed: 'Financed',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

const statusTones: Record<string, DeskTone> = {
  pencil: 'idle',
  submitted: 'warn',
  approved: 'info',
  financed: 'info',
  delivered: 'ok',
  cancelled: 'bad',
}

const filterOptions = [
  { value: 'active', label: 'Active' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'approved', label: 'Approved' },
  { value: 'financed', label: 'Financed' },
  { value: 'all', label: 'All' },
]

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value || 0)
}

function formatDate(value: string | null | undefined) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function getCustomerName(deal: Deal) {
  if (!deal.lead) return 'No customer'
  return [deal.lead.firstName, deal.lead.lastName].filter(Boolean).join(' ') || 'Unnamed customer'
}

function getVehicleName(deal: Deal) {
  if (!deal.vehicle) return 'No vehicle'
  return [deal.vehicle.year, deal.vehicle.make, deal.vehicle.model].filter(Boolean).join(' ')
}

function getDealWarnings(deal: Deal) {
  const warnings: string[] = []
  const total = deal.totalPrice || deal.vehiclePrice || 0
  const downPayment = deal.downPayment || 0
  const amountFinanced = deal.financingAmount || 0
  const apr = deal.apr || 0

  if (total > 0 && downPayment / total < 0.05) warnings.push('Low down payment')
  if (total > 0 && amountFinanced / total > 0.9) warnings.push('High loan-to-value')
  if (apr >= 12) warnings.push('High APR')
  if ((deal.profit || 0) < 0) warnings.push('Negative gross')

  return warnings
}

/** Tone for free-form workflow states (applications, decisions, checks, packages, funding). */
function stateTone(value: string | null | undefined): DeskTone {
  const state = (value || '').toLowerCase()
  if (['approved', 'accepted', 'completed', 'complete', 'signed', 'funded', 'clear-to-fund', 'ready', 'delivered'].includes(state)) return 'ok'
  if (['declined', 'rejected', 'failed', 'expired', 'cancelled', 'void', 'denied', 'exception'].includes(state)) return 'bad'
  if (['conditional', 'changes-requested', 'manual-review', 'requested', 'pending', 'presented', 'quoted', 'preparing', 'sent', 'viewed', 'queued', 'submitted', 'under-review', 'open'].includes(state)) return 'warn'
  return 'idle'
}

function normalizeDeals(deals: Deal[] | undefined) {
  return (deals || []).map(deal => ({ ...deal, financeEvidence: readFinanceEvidence(deal.financeEvidence) }))
}

function Empty({ label, onReset }: { label: string; onReset?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center text-sm text-muted-foreground">
      <p>{label}</p>
      {onReset && (
        <Track>
          <Pill size="sm" onClick={onReset}>Reset filters</Pill>
        </Track>
      )}
    </div>
  )
}

function Ledger({ children, empty }: { children: ReactNode[]; empty: string }) {
  if (children.length === 0) return <p className="py-3 text-sm text-muted-foreground">{empty}</p>
  return <ul className="divide-y text-sm">{children}</ul>
}

export function FinanceDeskPageClient({
  initialWorkspace,
  initialError,
}: {
  initialWorkspace: FinanceWorkspace | null
  initialError: string | null
}) {
  const [deals, setDeals] = useState<Deal[]>(normalizeDeals(initialWorkspace?.deals))
  const [applications, setApplications] = useState<FinanceApplication[]>(initialWorkspace?.applications || [])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(initialError)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [filter, setFilter] = useState('active')
  const [search, setSearch] = useState('')
  const [sortOrder, setSortOrder] = useState('recent')
  const [products, setProducts] = useState<FinanceProduct[]>(initialWorkspace?.products || [])
  const [productQuotes, setProductQuotes] = useState<ProductQuote[]>(initialWorkspace?.productQuotes || [])
  const [productCancellations, setProductCancellations] = useState<ProductCancellation[]>(initialWorkspace?.productCancellations || [])
  const [menus, setMenus] = useState<FinanceMenu[]>(initialWorkspace?.menus || [])
  const [complianceChecks, setComplianceChecks] = useState<ComplianceCheck[]>(initialWorkspace?.complianceChecks || [])
  const [contractPackages, setContractPackages] = useState<ContractPackage[]>(initialWorkspace?.contractPackages || [])
  const [fundingCases, setFundingCases] = useState<FundingCase[]>(initialWorkspace?.fundingCases || [])
  const [task, setTask] = useState<FinanceTask | null>(null)
  const [taskError, setTaskError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const loadDeals = async () => {
    setLoading(true)
    setError(null)

    const response = await getFinanceWorkspace()

    if (response.success && response.data) {
      setDeals(normalizeDeals(response.data.financeWorkspace.deals))
      setApplications(response.data.financeWorkspace.applications || [])
      setProducts(response.data.financeWorkspace.products || [])
      setProductQuotes(response.data.financeWorkspace.productQuotes || [])
      setProductCancellations(response.data.financeWorkspace.productCancellations || [])
      setMenus(response.data.financeWorkspace.menus || [])
      setComplianceChecks(response.data.financeWorkspace.complianceChecks || [])
      setContractPackages(response.data.financeWorkspace.contractPackages || [])
      setFundingCases(response.data.financeWorkspace.fundingCases || [])
    } else {
      setError(response.error || 'Unable to load finance.')
    }

    setLoading(false)
  }

  const openFinanceTask = (taskData: Omit<FinanceTask, 'idempotencyKey'>) => {
    setTaskError(null)
    setNotice(null)
    setTask({ ...taskData, idempotencyKey: `finance-operator:${crypto.randomUUID()}` })
  }

  const recordApprovalAndStatus = (deal: Deal, decision: 'approved' | 'rejected' | 'changes-requested', nextStatus: string) => openFinanceTask({
    kind: 'deal-approval', deal, decision, nextStatus,
    fields: { notes: decision === 'approved' ? 'Approved by finance desk.' : 'Rejected by finance desk.' },
  })

  const updateDealStatus = async (deal: Deal, status: string) => {
    setUpdatingId(deal.id)

    const response = await transitionDeal({
      id: deal.id,
      toStatus: status,
      idempotencyKey: `deal-transition:${deal.id}:${status}:${deal.worksheetVersion}:${deal.updatedAt}`,
    })

    setNotice(response.success ? 'Deal status updated.' : `Unable to update deal: ${response.error}`)

    await loadDeals()
    setUpdatingId(null)
  }

  const startFinanceFollowUp = async (lead: FinanceLead) => {
    const openTask = lead.tasks?.find(task => !task.completed)
    if (openTask) {
      setNotice('This request already has an open follow-up task.')
      return
    }

    setUpdatingId(lead.id)
    const response = await openFinanceFollowUp({
      leadId: lead.id,
      reason: 'Review the finance request and decide the next step.',
      idempotencyKey: `finance-follow-up:${lead.id}`,
    })

    setNotice(response.success ? 'Follow-up task created.' : `Unable to create follow-up task: ${response.error}`)
    await loadDeals()
    setUpdatingId(null)
  }

  const queueApplication = async (application: FinanceApplication) => {
    setUpdatingId(application.id)
    const response = await queueFinancingApplication({
      applicationId: application.id,
      providerKey: 'operator-recorded',
      idempotencyKey: `lender-queue:${application.id}:${crypto.randomUUID()}`,
    })
    setNotice(response.success ? 'Application queued for lender review.' : `Unable to queue for lender review: ${response.error}`)
    await loadDeals()
    setUpdatingId(null)
  }

  const recordApplicationDecision = (application: FinanceApplication) => {
    const submission = application.submissions[0]
    if (!submission) { setNotice('Queue this application for lender review before recording a decision.'); return }
    openFinanceTask({
      kind: 'lender-decision', application, submission,
      fields: { decision: '', externalReference: '', reasonCodes: '', approvedAmount: '', apr: '', termMonths: '', monthlyPayment: '' },
    })
  }

  const configureProduct = () => {
    const rooftopId = deals[0]?.rooftop?.id || applications[0]?.lead?.rooftop?.id
    if (!rooftopId) { setNotice('Add a deal or finance application before configuring products.'); return }
    openFinanceTask({ kind: 'configure-product', fields: { rooftopId, code: '', name: '', category: 'service-contract', retailCents: '150000', costCents: '90000' } })
  }

  const recordProductQuotes = (deal: Deal) => {
    if (!products.length) { setNotice('Configure at least one active F&I product first.'); return }
    openFinanceTask({ kind: 'product-quotes', deal, fields: { evidenceReference: '' } })
  }

  const presentMenu = async (deal: Deal) => {
    if (!products.length) { setNotice('Configure at least one active F&I product first.'); return }
    setUpdatingId(deal.id)
    const response = await presentFinanceMenu({
      dealId: deal.id,
      expectedUpdatedAt: deal.updatedAt,
      productCodes: products.map(product => product.code),
      idempotencyKey: `finance-menu:${deal.id}:${crypto.randomUUID()}`,
    })
    setNotice(response.success ? 'Menu presented.' : `Unable to present menu: ${response.error}`)
    await loadDeals(); setUpdatingId(null)
  }

  const decideMenu = (deal: Deal, accept: boolean) => {
    const menu = menus.find(item => item.deal?.id === deal.id && item.status === 'presented')
    if (!menu) { setNotice('No presented menu is awaiting a decision.'); return }
    openFinanceTask({ kind: accept ? 'menu-accept' : 'menu-decline', deal, menu, fields: { acknowledgment: '' } })
  }

  const recordCompliance = (deal: Deal) => openFinanceTask({ kind: 'compliance', deal, fields: { checkType: 'identity', status: 'requested', evidenceReference: '' } })

  const advanceContract = async (deal: Deal) => {
    const current = contractPackages.find(item => item.deal?.id === deal.id)
    if (current?.status === 'preparing') return openFinanceTask({ kind: 'contract-ready', deal, fields: { confirmed: '' } })
    if (current && current.status !== 'ready') return openFinanceTask({ kind: 'contract-provider', deal, fields: { providerStatus: 'sent', envelopeReference: '', evidenceReference: '' } })
    const action = current?.status === 'ready' ? 'request-handoff' : 'prepare'
    const requiredDocuments = ['buyers-order', 'retail-installment-contract', 'privacy-disclosure', 'product-menu']
    setUpdatingId(deal.id)
    const response = await manageFinanceContractPackage({
      dealId: deal.id,
      expectedUpdatedAt: deal.updatedAt,
      action,
      providerKey: 'operator-recorded',
      ...(action === 'prepare' ? { requiredDocuments, documentChecklist: [] } : {}),
      idempotencyKey: `finance-contract:${deal.id}:${action}:${crypto.randomUUID()}`,
    })
    setNotice(response.success ? (action === 'prepare' ? 'Contract package prepared.' : 'Contract handoff requested.') : `Unable to update contract package: ${response.error}`)
    await loadDeals(); setUpdatingId(null)
  }

  const updateFunding = (deal: Deal) => openFinanceTask({ kind: 'funding', deal, fields: { status: 'pending', fundingReference: '', exceptionNotes: '', attestChecklist: '' } })

  const recordCancellation = (deal: Deal) => {
    const menu = menus.find(item => item.deal?.id === deal.id && item.status === 'accepted')
    const productCode = (menu?.optionsSnapshot || [])[0]?.code
    if (!menu || !productCode) { setNotice('An accepted product menu is required.'); return }
    openFinanceTask({ kind: 'cancellation', deal, menu, fields: { productCode, status: 'requested', reason: '', evidenceReference: '', refundCents: '0' } })
  }

  const taskFields: OperatorActionField[] = !task ? [] : task.kind === 'deal-approval' ? [
    { name: 'notes', label: 'Approval notes (optional)', type: 'textarea', required: false, maxLength: 1000 },
  ] : task.kind === 'lender-decision' ? [
    { name: 'decision', label: 'Lender decision', type: 'select', options: ['approved', 'conditional', 'declined', 'expired', 'cancelled'].map(value => ({ value, label: value })) },
    { name: 'externalReference', label: 'Lender reference', maxLength: 200 },
    ...(task.fields.decision === 'declined' ? [{ name: 'reasonCodes', label: 'Decline reason codes (comma separated)', required: true }] : []),
    ...(['approved', 'conditional'].includes(task.fields.decision || '') ? [
      { name: 'approvedAmount', label: 'Approved amount (USD)', type: 'number' as const, min: 0.01, step: 0.01 },
      { name: 'apr', label: 'Approved APR (%)', type: 'number' as const, min: 0, max: 100, step: 0.01 },
      { name: 'termMonths', label: 'Approved term (months)', type: 'number' as const, min: 1, max: 120, step: 1 },
      { name: 'monthlyPayment', label: 'Approved monthly payment (USD)', type: 'number' as const, min: 0, step: 0.01 },
    ] : []),
  ] : task.kind === 'configure-product' ? [
    { name: 'code', label: 'Product code', maxLength: 80 }, { name: 'name', label: 'Product name', maxLength: 200 },
    { name: 'category', label: 'Category', type: 'select', options: ['service-contract', 'gap', 'maintenance', 'appearance', 'tire-wheel', 'other'].map(value => ({ value, label: value })) },
    { name: 'retailCents', label: 'Retail price (cents)', type: 'number', min: 0, step: 1 }, { name: 'costCents', label: 'Dealer cost (cents)', type: 'number', min: 0, step: 1 },
  ] : task.kind === 'product-quotes' ? [
    { name: 'evidenceReference', label: 'Quote reference', maxLength: 200 },
  ] : task.kind === 'menu-accept' || task.kind === 'menu-decline' ? [
    { name: 'acknowledgment', label: 'Disclosure acknowledgment', type: 'textarea', maxLength: 1000 },
  ] : task.kind === 'compliance' ? [
    { name: 'checkType', label: 'Check type', type: 'select', options: ['identity', 'ofac', 'red-flag', 'privacy'].map(value => ({ value, label: value })) },
    { name: 'status', label: 'Check status', type: 'select', options: ['requested', 'completed', 'failed', 'manual-review'].map(value => ({ value, label: value })) },
    ...(task.fields.status === 'completed' ? [{ name: 'evidenceReference', label: 'Check reference', maxLength: 200 }] : []),
  ] : task.kind === 'contract-ready' ? [
    { name: 'confirmed', label: 'I reviewed each required document', type: 'checkbox' },
  ] : task.kind === 'contract-provider' ? [
    { name: 'providerStatus', label: 'Contract status', type: 'select', options: ['sent', 'viewed', 'signed', 'declined', 'void'].map(value => ({ value, label: value })) },
    { name: 'envelopeReference', label: 'Envelope reference', maxLength: 200 }, { name: 'evidenceReference', label: 'Contract reference', maxLength: 200 },
  ] : task.kind === 'prerequisite-review' ? [
    { name: 'reviewReference', label: 'Review reference', maxLength: 200 },
    { name: 'policyReference', label: 'Policy reference', maxLength: 200 },
    { name: 'policyVersion', label: 'Policy version', maxLength: 200 },
    { name: 'reviewerAuthorityReference', label: 'Reviewer approval reference', maxLength: 200 },
  ] : task.kind === 'funding' ? [
    { name: 'status', label: 'Funding state', type: 'select', options: ['pending', 'exception', 'clear-to-fund', 'funded', 'cancelled'].map(value => ({ value, label: value })) },
    ...(['clear-to-fund', 'funded'].includes(task.fields.status || '') ? [{ name: 'attestChecklist', label: 'I reviewed the signed contract, stipulations, lender approval, and insurance', type: 'checkbox' as const }] : []),
    ...(task.fields.status === 'funded' ? [{ name: 'fundingReference', label: `Funding reference for worksheet ${task.deal?.worksheetVersion}`, maxLength: 200 }] : []),
    ...(task.fields.status === 'exception' ? [{ name: 'exceptionNotes', label: 'Funding exception details', type: 'textarea' as const, maxLength: 1000 }] : []),
  ] : task.kind === 'cancellation' ? [
    { name: 'productCode', label: 'Accepted menu product', maxLength: 80 },
    { name: 'status', label: 'Cancellation state', type: 'select', options: ['requested', 'completed', 'denied'].map(value => ({ value, label: value })) },
    { name: 'reason', label: 'Cancellation reason', type: 'textarea', maxLength: 1000 },
    { name: 'refundCents', label: 'Refund amount in cents (enter 0 if none)', type: 'number', min: 0, step: 1 },
    ...(task.fields.status === 'completed' ? [{ name: 'evidenceReference', label: 'Cancellation reference', maxLength: 200 }] : []),
  ] : []
  const taskTitles: Record<string, string> = {
    'deal-approval': task?.decision === 'approved' ? 'Approve deal' : 'Review deal',
    'lender-decision': 'Record lender decision',
    'configure-product': 'Configure F&I product',
    'product-quotes': 'Record product quotes',
    'menu-accept': 'Record menu decision',
    'menu-decline': 'Record menu decision',
    compliance: 'Record compliance check',
    'contract-ready': 'Mark contract package ready',
    'contract-provider': 'Record contract status',
    'prerequisite-review': 'Review funding prerequisites',
    funding: 'Update funding case',
    cancellation: 'Record product cancellation',
  }
  const taskTitle = (task && taskTitles[task.kind]) || 'Finance task'

  const submitFinanceTask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!task) return
    const value = (name: string) => task.fields[name]?.trim() || ''
    const centsFromDollars = (name: string, label: string) => {
      const raw = value(name)
      if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) throw new Error(`${label} must be entered in dollars with no more than two decimal places.`)
      const [whole, fraction = ''] = raw.split('.')
      const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
      if (!Number.isSafeInteger(cents) || cents > 2_147_483_647) throw new Error(`${label} is outside the supported range.`)
      return cents
    }
    const integerCents = (name: string, label: string) => {
      const cents = Number(value(name))
      if (!Number.isSafeInteger(cents) || cents < 0 || cents > 2_147_483_647) throw new Error(`${label} must be non-negative integer cents.`)
      return cents
    }
    const { deal, application, submission, menu } = task
    setTaskError(null)
    setUpdatingId(deal?.id || application?.id || 'finance-task')
    try {
      let response: { success: boolean; error?: string } | undefined
      if (task.kind === 'deal-approval' && deal) {
        if (!task.nextStatus) throw new Error('Choose the next deal status.')
        response = await transitionDeal({ id: deal.id, toStatus: task.nextStatus, notes: value('notes'), idempotencyKey: task.idempotencyKey })
      } else if (task.kind === 'lender-decision' && application && submission) {
        const decision = value('decision')
        if (!['approved', 'conditional', 'declined', 'expired', 'cancelled'].includes(decision)) throw new Error('Select a lender decision.')
        const reasonCodes = value('reasonCodes').split(',').map(code => code.trim()).filter(Boolean)
        if (decision === 'declined' && !reasonCodes.length) throw new Error('A declined decision requires at least one reason code.')
        const hasTerms = ['approved', 'conditional'].includes(decision)
        const approvedAmountCents = hasTerms ? centsFromDollars('approvedAmount', 'Approved amount') : null
        const apr = hasTerms ? Number(value('apr')) : null
        const termMonths = hasTerms ? Number(value('termMonths')) : null
        const monthlyPaymentCents = hasTerms ? centsFromDollars('monthlyPayment', 'Monthly payment') : null
        if (hasTerms && (approvedAmountCents! <= 0 || apr == null || !Number.isFinite(apr) || apr < 0 || apr > 100 || !Number.isInteger(termMonths) || termMonths! < 1 || termMonths! > 120)) throw new Error('Enter valid approved amount, APR, whole-month term, and monthly payment.')
        response = await recordLenderDecision({
          applicationId: application.id,
          submissionId: submission.id,
          providerKey: submission.providerKey,
          idempotencyKey: task.idempotencyKey,
          externalReference: value('externalReference'),
          decision,
          approvedAmountCents,
          aprBasisPoints: hasTerms ? Math.round(apr! * 100) : null,
          termMonths,
          monthlyPaymentCents,
          reasonCodes,
        })
      } else if (task.kind === 'configure-product') {
        const rooftopId = value('rooftopId')
        const code = value('code').toUpperCase()
        const category = value('category')
        if (!/^[A-Z0-9][A-Z0-9_-]{1,79}$/.test(code) || !value('name')) throw new Error('Enter a product code and name.')
        response = await configureFinanceProduct({
          rooftopId,
          code,
          name: value('name'),
          category,
          providerKey: 'operator-recorded',
          retailPriceCents: integerCents('retailCents', 'Retail price'),
          costCents: integerCents('costCents', 'Dealer cost'),
          active: true,
          idempotencyKey: task.idempotencyKey,
        })
      } else if (task.kind === 'product-quotes' && deal) {
        if (!value('evidenceReference')) throw new Error('Quote reference is required.')
        if (!products.length) throw new Error('Configure at least one active F&I product first.')
        if (products.some(product => !Number.isSafeInteger(product.costCents) || (product.costCents ?? -1) < 0)) throw new Error('Every product needs a dealer cost before quotes can be recorded.')
        for (const product of products) {
          response = await recordFinanceProductQuote({
            dealId: deal.id,
            productId: product.id,
            status: 'quoted',
            retailPriceCents: product.retailPriceCents,
            costCents: product.costCents,
            evidenceReference: `${value('evidenceReference')}:${product.code}`,
            idempotencyKey: `${task.idempotencyKey}:${product.id}`,
          })
          if (!response.success) throw new Error(response.error || `Unable to record quote for ${product.code}.`)
        }
      } else if ((task.kind === 'menu-accept' || task.kind === 'menu-decline') && deal && menu) {
        if (!value('acknowledgment')) throw new Error('Disclosure acknowledgment is required.')
        const codes = (menu.optionsSnapshot || []).map(option => option.code)
        const accept = task.kind === 'menu-accept'
        response = await decideFinanceMenu({
          dealId: deal.id,
          expectedUpdatedAt: deal.updatedAt,
          menuId: menu.id,
          selectedProductCodes: accept ? codes : [],
          declinedProductCodes: accept ? [] : codes,
          disclosureAcknowledgment: value('acknowledgment'),
          idempotencyKey: task.idempotencyKey,
        })
      } else if (task.kind === 'compliance' && deal) {
        const status = value('status')
        if (status === 'completed' && !value('evidenceReference')) throw new Error('Completed checks require a check reference.')
        response = await recordFinanceComplianceCheck({
          dealId: deal.id,
          expectedUpdatedAt: deal.updatedAt,
          checkType: value('checkType'),
          status,
          providerKey: 'operator-recorded',
          resultCode: status === 'completed' ? 'operator-reviewed' : null,
          evidenceReference: value('evidenceReference') || undefined,
          idempotencyKey: task.idempotencyKey,
        })
      } else if (task.kind === 'contract-ready' && deal) {
        if (value('confirmed') !== 'yes') throw new Error('Confirm the required documents were received and reviewed.')
        const requiredDocuments = ['buyers-order', 'retail-installment-contract', 'privacy-disclosure', 'product-menu']
        response = await manageFinanceContractPackage({
          dealId: deal.id,
          expectedUpdatedAt: deal.updatedAt,
          action: 'mark-ready',
          providerKey: 'operator-recorded',
          requiredDocuments,
          documentChecklist: requiredDocuments.map(code => ({ code, status: 'complete' })),
          idempotencyKey: task.idempotencyKey,
        })
      } else if (task.kind === 'contract-provider' && deal) {
        response = await manageFinanceContractPackage({
          dealId: deal.id,
          expectedUpdatedAt: deal.updatedAt,
          action: 'record-provider-status',
          providerKey: 'operator-recorded',
          providerStatus: value('providerStatus'),
          envelopeReference: value('envelopeReference'),
          evidenceReference: value('evidenceReference'),
          evidenceSource: 'operator-recorded',
          idempotencyKey: task.idempotencyKey,
        })
      } else if (task.kind === 'prerequisite-review' && deal) {
        const digest = deal.financeEvidence?.prerequisites?.digest
        if (!digest) throw new Error('A signed contract, decided menu, and compliance checks are required before review.')
        response = await reviewFinancePrerequisites({
          dealId: deal.id,
          worksheetVersion: deal.worksheetVersion,
          expectedUpdatedAt: deal.updatedAt,
          expectedPrerequisiteDigest: digest,
          providerKey: 'operator-recorded',
          reviewReference: value('reviewReference'),
          policyReference: value('policyReference'),
          policyVersion: value('policyVersion'),
          reviewerAuthorityReference: value('reviewerAuthorityReference'),
          idempotencyKey: task.idempotencyKey,
        })
      } else if (task.kind === 'funding' && deal) {
        const status = value('status')
        if (status === 'funded' && !value('fundingReference')) throw new Error('A funding reference is required to mark the deal funded.')
        if (status === 'exception' && !value('exceptionNotes')) throw new Error('Describe the funding exception.')
        const complete = ['clear-to-fund', 'funded'].includes(status)
        if (complete && !deal.financeEvidence?.prerequisites?.current) throw new Error('Review the funding prerequisites before clearing funding.')
        if (complete && value('attestChecklist') !== 'yes') throw new Error('Confirm the signed contract, stipulations, lender approval, and insurance before clearing funding.')
        response = await manageFinanceFundingCase({
          dealId: deal.id,
          worksheetVersion: deal.worksheetVersion,
          expectedUpdatedAt: deal.updatedAt,
          expectedFundingUpdatedAt: deal.financeEvidence?.fundingUpdatedAt ?? null,
          status,
          checklist: ['signed-contract', 'stipulations', 'lender-approval', 'insurance'].map(code => ({ code, status: complete ? 'complete' : 'open' })),
          exceptions: value('exceptionNotes') ? [{ code: 'operator-exception', status: 'open', notes: value('exceptionNotes') }] : [],
          fundingReference: value('fundingReference') || undefined,
          idempotencyKey: task.idempotencyKey,
        })
      } else if (task.kind === 'cancellation' && deal && menu) {
        const status = value('status')
        if (!value('reason') || status === 'completed' && !value('evidenceReference')) throw new Error('Enter a cancellation reason, and a reference for completed cancellations.')
        response = await recordFinanceProductCancellation({
          dealId: deal.id,
          menuId: menu.id,
          productCode: value('productCode'),
          status,
          reason: value('reason'),
          refundCents: integerCents('refundCents', 'Refund amount'),
          evidenceReference: value('evidenceReference') || undefined,
          idempotencyKey: task.idempotencyKey,
        })
      }
      if (response && !response.success) { setTaskError(response.error || 'Unable to save. Your entries are preserved.'); return }
      if (!response) throw new Error('Something went wrong. Close and reopen this task.')
      setTask(null)
      setNotice(task.kind === 'lender-decision' ? 'Lender decision recorded.' : task.kind.startsWith('contract') ? 'Contract updated.' : 'Saved.')
      await loadDeals()
    } catch (error) {
      setTaskError(error instanceof Error ? error.message : 'Unable to save.')
    } finally {
      setUpdatingId(null)
    }
  }

  const filteredDeals = useMemo(() => {
    const queued = filter === 'active' ? deals.filter(deal => ['submitted', 'approved', 'financed'].includes(deal.status || ''))
      : filter === 'all' ? deals
        : deals.filter(deal => deal.status === filter)
    const term = search.trim().toLowerCase()
    return queued.filter(deal => !term || `${getCustomerName(deal)} ${getVehicleName(deal)} ${deal.vehicle?.stockNumber || ''} ${deal.vehicle?.vin || ''}`.toLowerCase().includes(term)).sort((a, b) => {
      if (sortOrder === 'amount-desc') return (b.financingAmount || 0) - (a.financingAmount || 0)
      if (sortOrder === 'oldest') return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
      return new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime()
    })
  }, [deals, filter, search, sortOrder])

  const openFinanceRequests = applications.filter(application => {
    if (['declined', 'expired', 'cancelled'].includes(application.status)) return false
    const term = search.trim().toLowerCase()
    return !term || `${application.applicantName || ''} ${application.reference || ''} ${application.vehicle?.stockNumber || ''} ${application.lead?.firstName || ''} ${application.lead?.lastName || ''}`.toLowerCase().includes(term)
  })



  const searchTerm = search.trim()
  const resetFilters = () => {
    setSearch('')
    setFilter('active')
  }

  const stageCounts = useMemo(() => {
    const count = (status: string) => deals.filter(deal => deal.status === status).length
    return {
      active: deals.filter(deal => ['submitted', 'approved', 'financed'].includes(deal.status || '')).length,
      submitted: count('submitted'),
      approved: count('approved'),
      financed: count('financed'),
      all: deals.length,
    } as Record<string, number>
  }, [deals])

  const selectedDeal = filteredDeals.find(deal => deal.id === selectedId) ?? filteredDeals[0] ?? null
  const activeFinanced = deals.filter(deal => ['submitted', 'approved', 'financed'].includes(deal.status || '')).reduce((sum, deal) => sum + (deal.financingAmount || 0), 0)
  const presentedMenus = menus.filter(menu => menu.status === 'presented').length
  const fundingExceptions = fundingCases.filter(item => item.status === 'exception').length

  const breadcrumbs = [
    { type: 'link' as const, label: 'Dashboard', href: basePath },
    { type: 'page' as const, label: 'Platform' },
    { type: 'page' as const, label: 'Finance' },
  ]

  const header = (
    <DeskHeader
      title="Finance"
      tone={error ? 'bad' : stageCounts.submitted > 0 ? 'warn' : 'ok'}
      status={error ? 'Unavailable' : `${stageCounts.submitted} submitted`}
      meta={error ? 'Unavailable' : `${stageCounts.active} in finance · ${openFinanceRequests.length} applications · ${products.length} products`}
      actions={
        <Track>
          <Pill onClick={loadDeals} disabled={loading} aria-label="Refresh">
            <RefreshCw className={loading ? 'animate-spin' : undefined} />
            Refresh
          </Pill>
          <Pill onClick={configureProduct} disabled={updatingId === 'product'}>
            Configure product
          </Pill>
          <Pill asChild variant="primary">
            <Link href={`${basePath}/platform/deals/create`}>
              <Plus />
              New deal
            </Link>
          </Pill>
        </Track>
      }
    />
  )

  if (error) {
    return (
      <PageContainer title="Finance" header={header} breadcrumbs={breadcrumbs}>
        <div className="space-y-3 px-4 pb-24 md:px-6">
          <Notice tone="bad">
            <p className="font-medium">Finance is unavailable</p>
            <p className="mt-0.5 text-muted-foreground">{error}</p>
          </Notice>
          <Track>
            <Pill onClick={loadDeals}>Retry</Pill>
          </Track>
        </div>
      </PageContainer>
    )
  }

  const renderDealDetail = (deal: Deal) => {
    const warnings = getDealWarnings(deal)
    const fundingCase = fundingCases.find(item => item.deal?.id === deal.id)
    const evidence = deal.financeEvidence
    const dealHref = `${basePath}/platform/deals/${deal.id}`
    const workingStatus = ['submitted', 'approved', 'financed'].includes(deal.status || '')
    const contractStatus = ['approved', 'financed'].includes(deal.status || '')
    const hasPresentedMenu = menus.some(item => item.deal?.id === deal.id && item.status === 'presented')
    const hasAcceptedMenu = menus.some(item => item.deal?.id === deal.id && item.status === 'accepted')
    const dealMenus = menus.filter(item => item.deal?.id === deal.id)
    const dealQuotes = productQuotes.filter(item => item.deal?.id === deal.id)
    const dealCancellations = productCancellations.filter(item => item.deal?.id === deal.id)
    const dealChecks = complianceChecks.filter(item => item.deal?.id === deal.id)
    const contract = contractPackages.find(item => item.deal?.id === deal.id)
    const lenderApplications = deal.lead ? applications.filter(application => application.lead?.id === deal.lead?.id) : []
    const busy = updatingId === deal.id
    const status = deal.status || 'pencil'
    const openFundingExceptions = (fundingCase?.exceptions || []).filter(item => item.status === 'open').length

    return (
      <div className="min-w-0 space-y-6">
        <div className="min-w-0 space-y-3">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <TitleLine as="h2" tone={statusTones[status] || 'idle'} status={statusLabels[status] || status} className="text-lg font-semibold tracking-tight">
                {getCustomerName(deal)} · {getVehicleName(deal)}
              </TitleLine>
              <p className="mt-0.5 flex flex-wrap gap-x-2 pl-4 text-xs text-muted-foreground">
                <span>{statusLabels[status] || status}</span>
                <span>·</span>
                <Code>#{deal.vehicle?.stockNumber || '-'}</Code>
                {deal.vehicle?.vin && (<><span>·</span><Code>{deal.vehicle.vin}</Code></>)}
                <span>·</span>
                <span>Worksheet {deal.worksheetVersion}</span>
                {deal.salesperson?.name && (<><span>·</span><span>{deal.salesperson.name}</span></>)}
                {deal.rooftop?.name && (<><span>·</span><span>{deal.rooftop.name}</span></>)}
              </p>
            </div>
            <Track className="shrink-0">
              <Pill size="sm" asChild>
                <Link href={dealHref}>Open</Link>
              </Pill>
            </Track>
          </div>

          <div className="flex min-w-0 flex-wrap gap-2">
            {(deal.status === 'submitted' || (deal.status === 'approved' && evidence?.fundingCurrent) || deal.status === 'financed') && (
              <Track>
                {deal.status === 'submitted' && (
                  <>
                    <Pill size="sm" variant="primary" onClick={() => recordApprovalAndStatus(deal, 'approved', 'approved')} disabled={busy}>
                      Approve
                    </Pill>
                    <Pill size="sm" variant="danger" onClick={() => recordApprovalAndStatus(deal, 'rejected', 'cancelled')} disabled={busy}>
                      Reject
                    </Pill>
                  </>
                )}
                {deal.status === 'approved' && evidence?.fundingCurrent && (
                  <Pill size="sm" variant="primary" onClick={() => updateDealStatus(deal, 'financed')} disabled={busy}>
                    Mark financed
                  </Pill>
                )}
                {deal.status === 'financed' && (
                  <Pill size="sm" variant="primary" asChild>
                    <Link href={`${basePath}/platform/delivery`}>Open delivery</Link>
                  </Pill>
                )}
              </Track>
            )}
            {(workingStatus || hasPresentedMenu || hasAcceptedMenu) && (
              <Track aria-label="Products and compliance">
                {workingStatus && (
                  <>
                    <Pill size="sm" onClick={() => recordProductQuotes(deal)} disabled={busy}>Record quotes</Pill>
                    <Pill size="sm" onClick={() => presentMenu(deal)} disabled={busy}>Present menu</Pill>
                  </>
                )}
                {hasPresentedMenu && (
                  <>
                    <Pill size="sm" onClick={() => decideMenu(deal, true)} disabled={busy}>Accept products</Pill>
                    <Pill size="sm" onClick={() => decideMenu(deal, false)} disabled={busy}>Decline products</Pill>
                  </>
                )}
                {workingStatus && <Pill size="sm" onClick={() => recordCompliance(deal)} disabled={busy}>Record check</Pill>}
                {hasAcceptedMenu && <Pill size="sm" onClick={() => recordCancellation(deal)} disabled={busy}>Product cancellation</Pill>}
              </Track>
            )}
            {contractStatus && (
              <Track aria-label="Contract and funding">
                <Pill size="sm" onClick={() => advanceContract(deal)} disabled={busy}>Contract handoff</Pill>
                <Pill
                  size="sm"
                  disabled={busy || !evidence?.prerequisites?.digest}
                  onClick={() =>
                    openFinanceTask({
                      kind: 'prerequisite-review',
                      deal,
                      fields: { reviewReference: '', policyReference: '', policyVersion: '', reviewerAuthorityReference: '' },
                    })
                  }
                >
                  Review prerequisites
                </Pill>
                <Pill size="sm" onClick={() => updateFunding(deal)} disabled={busy}>Update funding</Pill>
              </Track>
            )}
          </div>

          {warnings.length > 0 && <Notice tone="warn">{warnings.join(' · ')}</Notice>}
        </div>

        <DeskSection title="Worksheet">
          <Facts
            items={[
              { label: 'Contact', value: deal.lead?.phone || deal.lead?.email || 'No contact' },
              { label: 'Vehicle price', value: formatCurrency(deal.vehiclePrice), mono: true },
              { label: 'Trade-in', value: formatCurrency(deal.tradeInValue), mono: true },
              { label: 'Down payment', value: formatCurrency(deal.downPayment), mono: true },
              { label: 'Tax', value: formatCurrency(deal.taxAmount), mono: true },
              { label: 'Total', value: formatCurrency(deal.totalPrice), mono: true },
              { label: 'Amount financed', value: formatCurrency(deal.financingAmount), mono: true },
              { label: 'APR · term', value: `${deal.apr || 0}% · ${deal.loanTerm || 0} mo`, mono: true },
              { label: 'Payment', value: formatCurrency(deal.monthlyPayment), mono: true },
              { label: 'Gross', value: formatCurrency(deal.profit), mono: true },
              { label: 'Flags', value: warnings.length > 0 ? `${warnings.length}` : 'No flags' },
            ]}
          />
        </DeskSection>

        <DeskSection title="Lender" count={lenderApplications.length}>
          <Ledger empty="No applications">
            {lenderApplications.flatMap(application => [
              ...application.submissions.map(submission => (
                <li key={submission.id} className="flex min-w-0 items-start justify-between gap-4 py-2.5">
                  <div className="min-w-0">
                    <TitleLine as="p" tone={stateTone(submission.status)} status={submission.status} className="font-medium">
                      Submitted · {submission.providerKey}
                    </TitleLine>
                    <p className="truncate pl-4 text-xs text-muted-foreground">
                      {submission.status} · {submission.providerMode}{submission.externalReference ? ` · ${submission.externalReference}` : ''}
                    </p>
                  </div>
                  <p className="shrink-0 text-right font-mono text-xs tabular-nums text-muted-foreground">{formatDate(submission.queuedAt)}</p>
                </li>
              )),
              ...application.decisions.map(decision => (
                <li key={decision.id} className="flex min-w-0 items-start justify-between gap-4 py-2.5">
                  <div className="min-w-0">
                    <TitleLine as="p" tone={stateTone(decision.decision)} status={decision.decision} className="font-medium capitalize">
                      {decision.decision} · {decision.providerKey}
                    </TitleLine>
                    <p className="truncate pl-4 text-xs text-muted-foreground">
                      {formatDate(decision.decidedAt)}{decision.reasonCodes.length > 0 ? ` · ${decision.reasonCodes.join(', ')}` : ''}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-medium tabular-nums">{decision.approvedAmountCents != null ? formatCurrency(decision.approvedAmountCents / 100) : '-'}</p>
                    <p className="font-mono text-[11px] tabular-nums text-muted-foreground">
                      {decision.aprBasisPoints != null ? `${(decision.aprBasisPoints / 100).toFixed(2)}%` : '-'} · {decision.termMonths ?? '-'} mo
                      {decision.monthlyPaymentCents != null ? ` · ${formatCurrency(decision.monthlyPaymentCents / 100)}` : ''}
                    </p>
                  </div>
                </li>
              )),
            ])}
          </Ledger>
        </DeskSection>

        <DeskSection title="Approvals" count={deal.approvals?.length || 0}>
          <Ledger empty="None">
            {(deal.approvals || []).map(approval => (
              <li key={approval.id} className="flex min-w-0 items-start justify-between gap-4 py-2.5">
                <div className="min-w-0">
                  <TitleLine as="p" tone={stateTone(approval.decision)} status={approval.decision || undefined} className="font-medium capitalize">
                    {approval.decision || 'Recorded'}
                  </TitleLine>
                  {(approval.approver?.name || approval.notes) && (
                    <p className="pl-4 text-xs text-muted-foreground">{[approval.approver?.name, approval.notes].filter(Boolean).join(' · ')}</p>
                  )}
                </div>
                <p className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">{formatDate(approval.approvalDate)}</p>
              </li>
            ))}
          </Ledger>
        </DeskSection>

        <DeskSection title="Products" count={dealMenus.length}>
          <Ledger empty="No menu">
            {[
              ...dealMenus.map(menu => (
                <li key={menu.id} className="flex min-w-0 items-start justify-between gap-4 py-2.5">
                  <div className="min-w-0">
                    <TitleLine as="p" tone={stateTone(menu.status)} status={menu.status} className="font-medium">
                      Menu v{menu.version}
                    </TitleLine>
                    <p className="pl-4 text-xs text-muted-foreground">{(menu.optionsSnapshot || []).map(option => option.code).join(', ') || 'No options'}</p>
                  </div>
                  <p className="shrink-0 text-xs capitalize text-muted-foreground">{menu.status}</p>
                </li>
              )),
              ...dealQuotes.map(quote => (
                <li key={quote.id} className="flex min-w-0 items-center justify-between gap-4 py-2">
                  <TitleLine as="p" tone={stateTone(quote.status)} status={quote.status}>
                    Quote <Code>{quote.product?.code || '-'}</Code>
                  </TitleLine>
                  <p className="shrink-0 text-xs capitalize text-muted-foreground">{quote.status}</p>
                </li>
              )),
              ...dealCancellations.map(cancellation => (
                <li key={cancellation.id} className="flex min-w-0 items-center justify-between gap-4 py-2">
                  <TitleLine as="p" tone={stateTone(cancellation.status)} status={cancellation.status}>
                    Cancellation <Code>{cancellation.productCode}</Code>
                  </TitleLine>
                  <p className="shrink-0 text-xs capitalize text-muted-foreground">{cancellation.status}</p>
                </li>
              )),
            ]}
          </Ledger>
        </DeskSection>

        <DeskSection title="Compliance" count={dealChecks.length}>
          <Ledger empty="No checks">
            {dealChecks.map(check => (
              <li key={check.id} className="flex min-w-0 items-center justify-between gap-4 py-2">
                <TitleLine as="p" tone={stateTone(check.status)} status={check.status} className="capitalize">
                  {check.checkType}
                </TitleLine>
                <p className="shrink-0 text-xs capitalize text-muted-foreground">{check.status}</p>
              </li>
            ))}
          </Ledger>
        </DeskSection>

        <DeskSection title="Contract">
          {contract ? (
            <div className="space-y-2">
              <TitleLine as="p" tone={stateTone(contract.status)} status={contract.status} className="text-sm font-medium capitalize">
                {contract.status}
              </TitleLine>
              <Ledger empty="No documents">
                {(contract.documentChecklist || []).map(item => (
                  <li key={item.code} className="flex min-w-0 items-center justify-between gap-4 py-2">
                    <Code className="text-foreground">{item.code}</Code>
                    <TitleLine as="span" tone={stateTone(item.status)} className="shrink-0 text-xs capitalize text-muted-foreground">{item.status}</TitleLine>
                  </li>
                ))}
              </Ledger>
            </div>
          ) : (
            <p className="py-3 text-sm text-muted-foreground">No contract package</p>
          )}
        </DeskSection>

        <DeskSection title="Funding">
          <div className="space-y-3">
            {evidence?.issue && <Notice tone="warn">{evidence.issue}</Notice>}
            <Facts
              items={[
                { label: 'Funding', value: <TitleLine as="span" tone={stateTone(evidence?.fundingStatus)}>{evidence?.fundingStatus || 'not started'}</TitleLine> },
                { label: 'Worksheet', value: evidence?.fundingCurrent ? 'current' : 'needs review' },
                evidence?.fundingReference ? { label: 'Reference', value: evidence.fundingReference, mono: true } : null,
                {
                  label: 'Prerequisites',
                  value: `${evidence?.prerequisites?.current ? 'Reviewed' : 'Review required'}${evidence?.prerequisites?.issue ? ` · ${evidence.prerequisites.issue}` : ''}`,
                },
                fundingCase ? { label: 'Funding case', value: fundingCase.status } : null,
                fundingCase ? { label: 'Open exceptions', value: openFundingExceptions, mono: true } : null,
              ]}
            />
            <div className="space-y-1 text-xs text-muted-foreground [&_summary]:cursor-pointer [&_summary]:font-medium [&_summary]:text-foreground">
              {evidence?.prerequisites?.snapshot && (
                <details>
                  <summary>Prerequisite details</summary>
                  <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-muted/50 p-2 font-mono text-xs">
                    {JSON.stringify(evidence.prerequisites.snapshot, null, 2)}
                  </pre>
                </details>
              )}
              <FinanceEvidenceHistory dealId={deal.id} aggregateType="FinanceFundingCase" label="Funding history" />
              {fundingCase?.immutableEvidence != null && (
                <details className="mt-2">
                  <summary>Funding details</summary>
                  <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-muted/50 p-2 font-mono text-xs">
                    {JSON.stringify(fundingCase.immutableEvidence, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          </div>
        </DeskSection>
      </div>
    )
  }

  return (
    <PageContainer title="Finance" header={header} breadcrumbs={breadcrumbs}>
      <div className="min-w-0 max-w-full space-y-8 px-4 pb-24 md:px-6">
        {notice && (
          <Notice tone={notice.startsWith('Unable') ? 'bad' : 'info'}>
            <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-2">
              <p className="min-w-0">{notice}</p>
              <Track>
                <Pill size="sm" variant="plain" onClick={() => setNotice(null)}>Dismiss</Pill>
              </Track>
            </div>
          </Notice>
        )}

        <ReadoutStrip>
          <Readout label="In finance" value={stageCounts.active} tone={stageCounts.active > 0 ? 'info' : 'idle'} sub={`${stageCounts.submitted} submitted`} />
          <Readout label="Amount financed" value={formatCurrency(activeFinanced)} />
          <Readout label="Applications" value={openFinanceRequests.length} tone={openFinanceRequests.length > 0 ? 'warn' : 'idle'} />
          <Readout label="Menus presented" value={presentedMenus} />
          <Readout label="Funding exceptions" value={fundingExceptions} tone={fundingExceptions > 0 ? 'bad' : 'ok'} />
        </ReadoutStrip>

        <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center">
          <Segmented
            label="Filter deals"
            value={filter}
            onChange={setFilter}
            options={filterOptions.map(option => ({
              value: option.value,
              label: option.label,
              count: stageCounts[option.value],
              tone: option.value === 'all' || option.value === 'active' ? undefined : statusTones[option.value],
            }))}
          />
          <div className="relative min-w-0 flex-1 lg:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="rounded-full pl-9"
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Search applicant, vehicle, stock, or reference"
              aria-label="Search finance"
            />
          </div>
          <Select value={sortOrder} onValueChange={setSortOrder}>
            <SelectTrigger className="w-full rounded-full lg:w-[180px]" aria-label="Sort deals">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Recently active</SelectItem>
              <SelectItem value="oldest">Oldest first</SelectItem>
              <SelectItem value="amount-desc">Highest balance</SelectItem>
            </SelectContent>
          </Select>
          {loading && (
            <span className="text-sm text-muted-foreground" role="status">
              Refreshing…
            </span>
          )}
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
          <DeskSection title="Queue" count={filteredDeals.length}>
            {filteredDeals.length === 0 ? (
              searchTerm || filter !== 'active' ? <Empty label="No matching deals" onReset={resetFilters} /> : <Empty label="No deals in finance" />
            ) : (
              <Panel className="divide-y overflow-hidden">
                {filteredDeals.map(deal => {
                  const warnings = getDealWarnings(deal)
                  const status = deal.status || 'pencil'
                  const selected = selectedDeal?.id === deal.id
                  return (
                    <button
                      key={deal.id}
                      type="button"
                      onClick={() => setSelectedId(deal.id)}
                      aria-pressed={selected}
                      className={cn(
                        'flex w-full min-w-0 items-start justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                        selected && 'bg-muted/60',
                      )}
                    >
                      <div className="min-w-0">
                        <TitleLine as="p" tone={statusTones[status] || 'idle'} status={statusLabels[status] || status} className="text-sm font-medium">
                          {getCustomerName(deal)} · {getVehicleName(deal)}
                        </TitleLine>
                        <p className="truncate pl-4 text-xs text-muted-foreground">
                          <Code>#{deal.vehicle?.stockNumber || '-'}</Code> · {statusLabels[status] || status}
                          {deal.approvals?.[0] ? ` · ${deal.approvals[0].decision || 'recorded'} ${formatDate(deal.approvals[0].approvalDate)}` : ''}
                          {warnings.length > 0 ? ` · ${warnings.join(', ')}` : ''}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-medium tabular-nums">{formatCurrency(deal.financingAmount)}</p>
                        <p className="font-mono text-[11px] tabular-nums text-muted-foreground">
                          {deal.apr || 0}% · {deal.loanTerm || 0} mo
                        </p>
                        <p className="font-mono text-[11px] tabular-nums text-muted-foreground">{formatCurrency(deal.monthlyPayment)}/mo</p>
                      </div>
                    </button>
                  )
                })}
              </Panel>
            )}
          </DeskSection>

          <div className="min-w-0">{selectedDeal ? renderDealDetail(selectedDeal) : <Empty label="No deal selected" />}</div>
        </div>

        <DeskSection title="Applications" count={openFinanceRequests.length}>
          {openFinanceRequests.length === 0 ? (
            searchTerm ? <Empty label="No matching applications" onReset={resetFilters} /> : <Empty label="No finance applications" />
          ) : (
            <Panel className="divide-y">
              {openFinanceRequests.map(application => {
                const lead = application.lead
                const openTask = lead?.tasks?.find(task => !task.completed)
                const applicantName = application.applicantName || [lead?.firstName, lead?.lastName].filter(Boolean).join(' ') || 'Finance applicant'
                const vehicle = application.vehicle || lead?.interestedVehicle
                const vehicleName = vehicle ? `${vehicle.year || ''} ${vehicle.make || ''} ${vehicle.model || ''}`.trim() : 'No vehicle selected'
                const submission = application.submissions[0]
                const decision = application.decisions[0]
                const busy = updatingId === application.id
                const lenderState = submission ? submission.status : openTask ? `${openTask.title || 'Open task'} · ${formatDate(openTask.dueDate)}` : 'Not queued'
                return (
                  <div key={application.id} className="flex min-w-0 flex-col gap-3 px-4 py-3 md:flex-row md:items-start md:justify-between">
                    <div className="flex min-w-0 flex-1 items-start justify-between gap-4">
                      <div className="min-w-0">
                        <TitleLine as="p" tone={stateTone(application.status)} status={application.status} className="text-sm font-medium">
                          {lead ? (
                            <Link href={`${basePath}/platform/crm/${lead.id}`} className="hover:underline">
                              {applicantName}
                            </Link>
                          ) : (
                            applicantName
                          )}
                          {' · '}
                          {vehicleName}
                        </TitleLine>
                        <p className="pl-4 text-xs text-muted-foreground">
                          <Code>{application.reference || application.id}</Code> · {application.status} · Stock <Code>#{vehicle?.stockNumber || '-'}</Code> · {formatCurrency((vehicle?.priceCents || 0) / 100)}
                        </p>
                        <p className="pl-4 text-xs text-muted-foreground">
                          Submitted {formatDate(application.submittedAt)} · {submission ? `${submission.providerKey} · ` : ''}{lenderState}
                          {decision ? ` · Latest decision: ${decision.decision}` : ''}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-medium tabular-nums">
                          {application.requestedAmountCents != null ? formatCurrency(application.requestedAmountCents / 100) : '-'}
                        </p>
                        {decision && (
                          <p className="font-mono text-[11px] tabular-nums text-muted-foreground">
                            {decision.aprBasisPoints != null ? `${(decision.aprBasisPoints / 100).toFixed(2)}%` : '-'} · {decision.termMonths ?? '-'} mo
                          </p>
                        )}
                      </div>
                    </div>
                    <Track className="self-start md:shrink-0">
                      {lead && !openTask && (
                        <Pill size="sm" onClick={() => startFinanceFollowUp(lead)} disabled={updatingId === lead.id}>
                          Create task
                        </Pill>
                      )}
                      {!submission && (
                        <Pill size="sm" onClick={() => queueApplication(application)} disabled={busy}>
                          Queue for lender review
                        </Pill>
                      )}
                      {submission && ['under-review', 'submitted'].includes(application.status) && (
                        <Pill size="sm" variant="primary" onClick={() => recordApplicationDecision(application)} disabled={busy}>
                          Record decision
                        </Pill>
                      )}
                      {lead && (
                        <Pill size="sm" variant="plain" asChild>
                          <Link href={`${basePath}/platform/crm/${lead.id}`}>Open lead</Link>
                        </Pill>
                      )}
                    </Track>
                  </div>
                )
              })}
            </Panel>
          )}
        </DeskSection>

        <OperatorActionDialog
          open={Boolean(task)}
          title={taskTitle}
          fields={taskFields}
          values={task?.fields || {}}
          error={taskError}
          busy={Boolean(task && updatingId)}
          submitLabel="Save"
          onValuesChange={values => setTask(current => (current ? { ...current, fields: values } : current))}
          onSubmit={submitFinanceTask}
          onOpenChange={open => {
            if (!open) {
              setTask(null)
              setTaskError(null)
            }
          }}
        />
      </div>
    </PageContainer>
  )
}
