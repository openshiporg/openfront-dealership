'use client'

import { useMemo, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { AlertTriangle, CheckCircle2, Circle, CreditCard, RefreshCw, Search, Square, Triangle, UserPlus, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageContainer } from '@/features/dashboard/components/PageContainer'
import { basePath } from '@/features/dashboard/lib/config'
import { OperatorActionDialog, type OperatorActionField } from '@/features/platform/components/OperatorActionDialog'
import { readFinanceEvidence } from '@/features/platform/deals/lib/financeEvidence'
import { FinanceEvidenceHistory } from '@/features/platform/deals/components/FinanceEvidenceHistory'
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

const statusClasses: Record<string, string> = {
  pencil: 'bg-slate-100 text-slate-700 border-slate-200',
  submitted: 'bg-blue-100 text-blue-700 border-blue-200',
  approved: 'bg-green-100 text-green-700 border-green-200',
  financed: 'bg-purple-100 text-purple-700 border-purple-200',
  delivered: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  cancelled: 'bg-red-100 text-red-700 border-red-200',
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


function StatusBadge({ status }: { status: string | null }) {
  const value = status || 'pencil'
  return (
    <Badge variant="outline" className={statusClasses[value] || 'bg-slate-100 text-slate-700 border-slate-200'}>
      {statusLabels[value] || value}
    </Badge>
  )
}

function normalizeDeals(deals: Deal[] | undefined) {
  return (deals || []).map(deal => ({ ...deal, financeEvidence: readFinanceEvidence(deal.financeEvidence) }))
}

function EmptyStateDefault({ title, description }: { title: string; description: string }) {
  return <EmptyState title={title} description={description} icons={[Triangle, Square, Circle]} />
}

function EmptyStateSearch({ onResetFilters }: { onResetFilters: () => void }) {
  return (
    <EmptyState
      title="No results found"
      description="Try adjusting your search or filters."
      icons={[Search]}
      action={{ label: 'Reset filters', onClick: onResetFilters }}
    />
  )
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
  const [, setProductQuotes] = useState<ProductQuote[]>(initialWorkspace?.productQuotes || [])
  const [, setProductCancellations] = useState<ProductCancellation[]>(initialWorkspace?.productCancellations || [])
  const [menus, setMenus] = useState<FinanceMenu[]>(initialWorkspace?.menus || [])
  const [, setComplianceChecks] = useState<ComplianceCheck[]>(initialWorkspace?.complianceChecks || [])
  const [contractPackages, setContractPackages] = useState<ContractPackage[]>(initialWorkspace?.contractPackages || [])
  const [fundingCases, setFundingCases] = useState<FundingCase[]>(initialWorkspace?.fundingCases || [])
  const [task, setTask] = useState<FinanceTask | null>(null)
  const [taskError, setTaskError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

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

  const breadcrumbs = [
    { type: 'link' as const, label: 'Dashboard', href: basePath },
    { type: 'page' as const, label: 'Platform' },
    { type: 'page' as const, label: 'Finance' },
  ]

  const header = (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">Finance</h1>
        <p className="text-muted-foreground">Review applications and lender decisions.</p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={loadDeals} disabled={loading}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
        <Button asChild>
          <Link href={`${basePath}/platform/deals/create`}>
            <CreditCard className="h-4 w-4 mr-2" />
            New Deal
          </Link>
        </Button>
      </div>
    </div>
  )

  if (error) {
    return (
      <PageContainer title="Finance" header={header} breadcrumbs={breadcrumbs}>
        <div className="px-4 pb-6 md:px-6">
          <Card>
            <CardContent className="py-12 text-center">
              <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-destructive" />
              <p className="font-medium">Finance is unavailable</p>
              <p className="mt-1 text-sm text-muted-foreground">{error}</p>
              <Button className="mt-4" variant="outline" onClick={loadDeals}>
                Retry
              </Button>
            </CardContent>
          </Card>
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer title="Finance" header={header} breadcrumbs={breadcrumbs}>
      <div className="min-w-0 space-y-6 px-4 pb-6 md:px-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg">F&amp;I products and funding</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">Product menus, compliance checks, contracts, and funding exceptions.</p>
            </div>
            <Button variant="outline" onClick={configureProduct} disabled={updatingId === 'product'}>
              Configure product
            </Button>
          </CardHeader>
        </Card>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1 lg:max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Search applicant, vehicle, stock, or reference"
              aria-label="Search finance"
            />
          </div>
          <Select value={sortOrder} onValueChange={setSortOrder}>
            <SelectTrigger className="w-full lg:w-[190px]" aria-label="Sort deals">
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

        {notice && (
          <div role="status" className="flex items-start justify-between gap-3 rounded-md border bg-muted/40 px-4 py-3 text-sm">
            <p>{notice}</p>
            <Button type="button" size="sm" variant="ghost" onClick={() => setNotice(null)}>
              Dismiss
            </Button>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Finance applications
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {openFinanceRequests.length === 0 ? (
              searchTerm ? (
                <EmptyStateSearch onResetFilters={resetFilters} />
              ) : (
                <EmptyStateDefault title="No finance applications" description="Finance applications will appear here." />
              )
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left py-3 px-4 font-medium">Applicant</th>
                      <th className="text-left py-3 px-4 font-medium">Vehicle</th>
                      <th className="text-left py-3 px-4 font-medium">Submitted</th>
                      <th className="text-left py-3 px-4 font-medium">Lender status</th>
                      <th className="text-right py-3 px-4 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {openFinanceRequests.map(application => {
                      const lead = application.lead
                      const openTask = lead?.tasks?.find(task => !task.completed)
                      const applicantName = application.applicantName || [lead?.firstName, lead?.lastName].filter(Boolean).join(' ') || 'Finance applicant'
                      const vehicle = application.vehicle || lead?.interestedVehicle
                      const submission = application.submissions[0]
                      const decision = application.decisions[0]
                      return (
                        <tr key={application.id} className="border-b last:border-0 hover:bg-muted/50">
                          <td className="py-3 px-4">
                            {lead ? (
                              <Link href={`${basePath}/platform/crm/${lead.id}`} className="font-medium hover:underline">
                                {applicantName}
                              </Link>
                            ) : (
                              <span className="font-medium">{applicantName}</span>
                            )}
                            <div className="text-xs text-muted-foreground">
                              {application.reference || application.id} · {application.status}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            {vehicle ? `${vehicle.year || ''} ${vehicle.make || ''} ${vehicle.model || ''}`.trim() : 'No vehicle selected'}
                            <div className="text-xs text-muted-foreground">
                              Stock #{vehicle?.stockNumber || '-'} · {formatCurrency((vehicle?.priceCents || 0) / 100)}
                            </div>
                          </td>
                          <td className="py-3 px-4">{formatDate(application.submittedAt)}</td>
                          <td className="py-3 px-4 space-y-1">
                            {submission ? (
                              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                                {submission.status}
                              </Badge>
                            ) : openTask ? (
                              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                {openTask.title || 'Open task'} · {formatDate(openTask.dueDate)}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                                Not queued
                              </Badge>
                            )}
                            {decision && <p className="text-xs font-medium">Latest decision: {decision.decision}</p>}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap justify-end gap-2">
                              {lead && !openTask && (
                                <Button size="sm" variant="outline" onClick={() => startFinanceFollowUp(lead)} disabled={updatingId === lead.id}>
                                  Create Task
                                </Button>
                              )}
                              {!submission && (
                                <Button size="sm" variant="outline" onClick={() => queueApplication(application)} disabled={updatingId === application.id}>
                                  Queue for lender review
                                </Button>
                              )}
                              {submission && ['under-review', 'submitted'].includes(application.status) && (
                                <Button size="sm" onClick={() => recordApplicationDecision(application)} disabled={updatingId === application.id}>
                                  Record decision
                                </Button>
                              )}
                              {lead && (
                                <Button asChild size="sm" variant="ghost">
                                  <Link href={`${basePath}/platform/crm/${lead.id}`}>Open Lead</Link>
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter deals">
          {filterOptions.map(option => (
            <Button
              key={option.value}
              variant={filter === option.value ? 'secondary' : 'outline'}
              size="sm"
              aria-pressed={filter === option.value}
              onClick={() => setFilter(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Finance Queue</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {filteredDeals.length === 0 ? (
              searchTerm || filter !== 'active' ? (
                <EmptyStateSearch onResetFilters={resetFilters} />
              ) : (
                <EmptyStateDefault title="No deals in finance" description="Deals submitted for financing will appear here." />
              )
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left py-3 px-4 font-medium">Deal</th>
                      <th className="text-left py-3 px-4 font-medium">Customer</th>
                      <th className="text-right py-3 px-4 font-medium">Amount Financed</th>
                      <th className="text-right py-3 px-4 font-medium">Payment</th>
                      <th className="text-left py-3 px-4 font-medium">Flags</th>
                      <th className="text-center py-3 px-4 font-medium">Status</th>
                      <th className="text-left py-3 px-4 font-medium">Last Approval</th>
                      <th className="text-right py-3 px-4 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDeals.map(deal => {
                      const warnings = getDealWarnings(deal)
                      const lastApproval = deal.approvals?.[0]
                      const fundingCase = fundingCases.find(item => item.deal?.id === deal.id)
                      const evidence = deal.financeEvidence
                      const dealHref = `${basePath}/platform/deals/${deal.id}`
                      const workingStatus = ['submitted', 'approved', 'financed'].includes(deal.status || '')
                      const contractStatus = ['approved', 'financed'].includes(deal.status || '')

                      return (
                        <tr key={deal.id} className="border-b last:border-0 hover:bg-muted/50">
                          <td className="py-3 px-4">
                            <Link href={dealHref} className="font-medium hover:underline">
                              {getVehicleName(deal)}
                            </Link>
                            <div className="text-xs text-muted-foreground">
                              Stock #{deal.vehicle?.stockNumber || '-'} · worksheet {deal.worksheetVersion}
                              <p className="mt-1">
                                Funding: {evidence?.fundingStatus || 'not started'} · {evidence?.fundingCurrent ? 'current' : 'needs review'}
                              </p>
                              {evidence?.issue && <p className="mt-1 text-amber-700">{evidence.issue}</p>}
                              <p className="mt-1">
                                Prerequisites: {evidence?.prerequisites?.current ? 'Reviewed' : 'Review required'}
                                {evidence?.prerequisites?.issue ? ` · ${evidence.prerequisites.issue}` : ''}
                              </p>
                              {evidence?.prerequisites?.snapshot && (
                                <details>
                                  <summary>Prerequisite details</summary>
                                  <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all text-xs">
                                    {JSON.stringify(evidence.prerequisites.snapshot, null, 2)}
                                  </pre>
                                </details>
                              )}
                              <FinanceEvidenceHistory dealId={deal.id} aggregateType="FinanceFundingCase" label="Funding history" />
                              {fundingCase?.immutableEvidence != null && (
                                <details className="mt-2">
                                  <summary>Funding details</summary>
                                  <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all text-xs">
                                    {JSON.stringify(fundingCase.immutableEvidence, null, 2)}
                                  </pre>
                                </details>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-medium">{getCustomerName(deal)}</div>
                            <div className="text-xs text-muted-foreground">{deal.lead?.phone || deal.lead?.email || 'No contact'}</div>
                          </td>
                          <td className="py-3 px-4 text-right font-medium">{formatCurrency(deal.financingAmount)}</td>
                          <td className="py-3 px-4 text-right">
                            <div className="font-medium">{formatCurrency(deal.monthlyPayment)}</div>
                            <div className="text-xs text-muted-foreground">
                              {deal.apr || 0}% · {deal.loanTerm || 0} mo
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            {warnings.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {warnings.map(warning => (
                                  <Badge key={warning} variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                                    <AlertTriangle className="h-3 w-3 mr-1" />
                                    {warning}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <span className="inline-flex items-center text-xs text-green-700">
                                <CheckCircle2 className="h-3 w-3 mr-1" /> No flags
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <StatusBadge status={deal.status} />
                          </td>
                          <td className="py-3 px-4">
                            {lastApproval ? (
                              <div>
                                <div className="capitalize font-medium">{lastApproval.decision}</div>
                                <div className="text-xs text-muted-foreground">{formatDate(lastApproval.approvalDate)}</div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">None</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap justify-end gap-2">
                              {workingStatus && (
                                <>
                                  <Button size="sm" variant="outline" onClick={() => recordProductQuotes(deal)} disabled={updatingId === deal.id}>
                                    Record Quotes
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => presentMenu(deal)} disabled={updatingId === deal.id}>
                                    Present Menu
                                  </Button>
                                </>
                              )}
                              {menus.some(item => item.deal?.id === deal.id && item.status === 'presented') && (
                                <>
                                  <Button size="sm" variant="outline" onClick={() => decideMenu(deal, true)} disabled={updatingId === deal.id}>
                                    Accept Products
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => decideMenu(deal, false)} disabled={updatingId === deal.id}>
                                    Decline Products
                                  </Button>
                                </>
                              )}
                              {workingStatus && (
                                <Button size="sm" variant="outline" onClick={() => recordCompliance(deal)} disabled={updatingId === deal.id}>
                                  Record Check
                                </Button>
                              )}
                              {menus.some(item => item.deal?.id === deal.id && item.status === 'accepted') && (
                                <Button size="sm" variant="outline" onClick={() => recordCancellation(deal)} disabled={updatingId === deal.id}>
                                  Product Cancellation
                                </Button>
                              )}
                              {contractStatus && (
                                <Button size="sm" variant="outline" onClick={() => advanceContract(deal)} disabled={updatingId === deal.id}>
                                  Contract Handoff
                                </Button>
                              )}
                              {contractStatus && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={updatingId === deal.id || !evidence?.prerequisites?.digest}
                                  onClick={() =>
                                    openFinanceTask({
                                      kind: 'prerequisite-review',
                                      deal,
                                      fields: { reviewReference: '', policyReference: '', policyVersion: '', reviewerAuthorityReference: '' },
                                    })
                                  }
                                >
                                  Review prerequisites
                                </Button>
                              )}
                              {contractStatus && (
                                <Button size="sm" variant="outline" onClick={() => updateFunding(deal)} disabled={updatingId === deal.id}>
                                  Update funding
                                </Button>
                              )}
                              {deal.status === 'submitted' && (
                                <>
                                  <Button size="sm" variant="outline" onClick={() => recordApprovalAndStatus(deal, 'approved', 'approved')} disabled={updatingId === deal.id}>
                                    <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
                                  </Button>
                                  <Button size="sm" variant="destructive" onClick={() => recordApprovalAndStatus(deal, 'rejected', 'cancelled')} disabled={updatingId === deal.id}>
                                    <XCircle className="h-4 w-4 mr-1" /> Reject
                                  </Button>
                                </>
                              )}
                              {deal.status === 'approved' && evidence?.fundingCurrent && (
                                <Button size="sm" onClick={() => updateDealStatus(deal, 'financed')} disabled={updatingId === deal.id}>
                                  Mark financed
                                </Button>
                              )}
                              {deal.status === 'financed' && (
                                <Button asChild size="sm">
                                  <Link href={`${basePath}/platform/delivery`}>Open Delivery</Link>
                                </Button>
                              )}
                              <Button asChild size="sm" variant="ghost">
                                <Link href={dealHref}>Open</Link>
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

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
