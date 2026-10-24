'use client'

import { useState, useEffect, useRef, type FormEvent, type ReactNode } from 'react'
import Link from 'next/link'
import { ArrowRight, Check, Pencil, Save, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { PageContainer } from '@/features/dashboard/components/PageContainer'
import { basePath } from '@/features/dashboard/lib/config'
import {
  Code,
  DeskHeader,
  DeskSection,
  Facts,
  Meter,
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
import {
  acceptDealWorksheet,
  getDealLenderOffers,
  getDealWorkspace,
  presentDealWorksheet,
  reopenDealWorksheet,
  saveDealWorksheet,
  selectDealLenderOffer,
  transitionDeal,
  type DealLenderOffer,
  type DealWorksheetVersion,
} from '../actions'
import { applyDealDefaults, calculateDealPrice, assertValidDealPrice, normalizeMoneyLines, repriceRateTaxLines, sumMoneyLines, type MoneyLine } from '@/features/keystone/lifecycle/dealPricing'
import { WorksheetLines } from '../components/WorksheetLines'
import { MoneyInput } from '../components/MoneyInput'
import { readFinanceEvidence, type FinanceEvidence } from '../lib/financeEvidence'
import { FinanceEvidenceHistory } from '../components/FinanceEvidenceHistory'
import { labelForDeal, toneForDeal } from '../lib/dealStatus'
import { formatUsd, formatUsdCredit } from '../lib/formatMoney'
import { OperatorActionDialog } from '@/features/platform/components/OperatorActionDialog'

type LenderOffer = DealLenderOffer

interface Deal {
  id: string
  vehiclePrice: number
  tradeInValue: number
  downPayment: number
  financingAmount: number
  monthlyPayment: number
  loanTerm: number
  apr: number
  taxAmount: number
  status: string
  structureType: string
  worksheetVersion: number
  financeEvidence: FinanceEvidence | null
  fees: MoneyLine[]
  rebates: MoneyLine[]
  products: MoneyLine[]
  taxLines: MoneyLine[]
  residualValueCents: number | null
  moneyFactorBasisPoints: number | null
  presentedAt: string | null
  acceptedAt: string | null
  saleDate: string | null
  createdAt: string
  updatedAt: string
  totalPrice: number
  profit: number | null
  salesperson: { id: string; name: string; email: string } | null
  lead: { id: string; firstName: string; lastName: string; email: string; phone: string } | null
  vehicle: {
    id: string
    year: number
    make: string
    model: string
    trim: string
    stockNumber: string
    vin: string
    exteriorColor: string | null
    price: number
    purchasePrice: number
  } | null
  approvals: {
    id: string
    decision: string
    approvalDate: string
    notes: string
    approver: { name: string } | null
  }[]
}

const fieldLabel = 'font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground'

/** Rate-based tax lines follow the worksheet; the server reprices them the same way on save. */
function withRepricedTax(deal: Deal): Deal {
  try {
    return { ...deal, taxLines: repriceRateTaxLines(deal.taxLines, { vehiclePriceCents: Math.round(deal.vehiclePrice * 100), tradeInValueCents: Math.round(deal.tradeInValue * 100), fees: deal.fees, rebates: deal.rebates }) }
  } catch {
    // Invalid amounts are reported on save; keep the last priced tax until then.
    return deal
  }
}

function lineCents(line: MoneyLine) {
  const value = Number(line.amountCents ?? Math.round(Number((line as { amount?: unknown }).amount || 0) * 100))
  return Number.isFinite(value) ? value : 0
}

const worksheetLineGroups = [
  ['fees', 'Fee'],
  ['products', 'Product'],
  ['rebates', 'Rebate'],
  ['taxLines', 'Tax'],
] as const

/** Field problems the operator can fix before the worksheet is sent to the server. */
function worksheetFieldErrors(deal: Pick<Deal, 'fees' | 'products' | 'rebates' | 'taxLines'>) {
  const errors: string[] = []
  for (const [field, label] of worksheetLineGroups) {
    const missing = deal[field].flatMap((line, index) => String(line.name || '').trim() ? [] : [index + 1])
    if (missing.length === 0) continue
    const lineNote = deal[field].length > 1 ? ` (line ${missing.join(', ')})` : ''
    errors.push(`${label} name is required${lineNote}`)
  }
  return errors
}

/** Only an optimistic-concurrency rejection means someone else changed the deal. */
function isVersionConflict(message: string) {
  return /changed concurrently|reload and retry/i.test(message)
}

/** One row of the deal jacket ledger. */
function LedgerRow({ label, value, emphasis, sub, indent }: { label: ReactNode; value: ReactNode; emphasis?: 'subtotal' | 'total'; sub?: boolean; indent?: boolean }) {
  return (
    <div
      className={[
        'flex min-w-0 items-baseline justify-between gap-4 px-4',
        emphasis === 'total' ? 'border-t-2 border-foreground/80 py-3 text-base font-semibold text-foreground' : emphasis === 'subtotal' ? 'border-t py-2.5 text-sm font-medium text-foreground' : sub ? 'py-1 text-xs text-muted-foreground' : 'py-2 text-sm text-foreground',
        indent ? 'pl-8' : '',
      ].join(' ')}
    >
      <dt className={`min-w-0 break-words ${emphasis || sub ? '' : 'text-muted-foreground'}`}>{label}</dt>
      <dd className="shrink-0 text-right font-mono tabular-nums">{value}</dd>
    </div>
  )
}

export function DealDetailPageClient({ id }: { id: string }) {
  const [deal, setDeal] = useState<Deal | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updating, setUpdating] = useState(false)
  const [worksheetDirty, setWorksheetDirty] = useState(false)
  const [showLineErrors, setShowLineErrors] = useState(false)
  const [savedPricing, setSavedPricing] = useState<(ReturnType<typeof calculateDealPrice> & { financingAmountCents: number; monthlyPaymentCents: number; apr: number; loanTerm: number }) | null>(null)
  const [lenderOffers, setLenderOffers] = useState<LenderOffer[]>([])
  const [worksheetHistory, setWorksheetHistory] = useState<DealWorksheetVersion[]>([])
  const [acceptanceDialogOpen, setAcceptanceDialogOpen] = useState(false)
  const [acceptanceValues, setAcceptanceValues] = useState({ acknowledgment: '' })
  const [acceptanceError, setAcceptanceError] = useState<string | null>(null)
  const acceptanceIdempotencyKeyRef = useRef<string | null>(null)
  const [reopenDialogOpen, setReopenDialogOpen] = useState(false)
  const [reopenValues, setReopenValues] = useState({ reason: '' })
  const [reopenError, setReopenError] = useState<string | null>(null)
  const reopenIdempotencyKeyRef = useRef<string | null>(null)
  const [approvalIntent, setApprovalIntent] = useState<{ toStatus: string; notes: string; idempotencyKey: string; title: string; submitLabel: string } | null>(null)
  const [approvalError, setApprovalError] = useState<string | null>(null)

  useEffect(() => {
    loadDeal()
  }, [id])

  const loadDeal = async () => {
    setLoading(true)
    setError(null)
    const response = await getDealWorkspace(id)
    if (response.success && response.data?.dealWorkspace?.deal) {
      const value = response.data.dealWorkspace.deal
      value.financeEvidence = readFinanceEvidence(value.financeEvidence)
      for (const key of ['fees', 'rebates', 'products', 'taxLines']) value[key] = Array.isArray(value[key]) ? value[key] : []
      if (!value.taxLines.length && value.taxAmountCents > 0) value.taxLines = [{ code: 'legacy-tax', name: 'Tax', amountCents: value.taxAmountCents, source: 'operator-recorded' }]
      setShowLineErrors(false)
      setWorksheetHistory(response.data.dealWorkspace.worksheetVersions || [])
      setSavedPricing({ ...calculateDealPrice(value), financingAmountCents: value.financingAmountCents || 0, monthlyPaymentCents: value.monthlyPaymentCents || 0, apr: value.apr || 0, loanTerm: value.loanTerm || 0 })
      // A never-saved pencil with no fee or tax lines starts from the store's doc fee and tax rate.
      let prefilled = false
      if (value.status === 'pencil' && !value.worksheetVersion) {
        try {
          const seeded = applyDealDefaults(value, response.data.dealDefaults)
          if (seeded.changed) {
            value.fees = seeded.fees
            value.taxLines = seeded.taxLines
            prefilled = true
          }
        } catch {
          prefilled = false
        }
      }
      setWorksheetDirty(prefilled)
      const dollars = (cents: number | null | undefined) => (cents ?? 0) / 100
      setDeal({ ...value, vehiclePrice: dollars(value.vehiclePriceCents), tradeInValue: dollars(value.tradeInValueCents), downPayment: dollars(value.downPaymentCents), financingAmount: dollars(value.financingAmountCents), monthlyPayment: dollars(value.monthlyPaymentCents), taxAmount: dollars(value.taxAmountCents), totalPrice: dollars(value.totalPriceCents), profit: null, salesperson: value.salesperson ? { ...value.salesperson, email: '' } : null, lead: value.lead ? { ...value.lead, email: '', phone: '' } : null, vehicle: value.vehicle ? { ...value.vehicle, price: dollars(value.vehicle.priceCents), purchasePrice: 0 } : null })
      const offers = await getDealLenderOffers(id)
      setLenderOffers(offers.success ? offers.data?.dealLenderOffers || [] : [])
    } else {
      setDeal(null)
      setError(response.error || 'The deal was not found.')
    }
    setLoading(false)
  }

  const editWorksheet = (patch: Partial<Deal>) => {
    setWorksheetDirty(true)
    setDeal(current => current ? withRepricedTax({ ...current, ...patch }) : current)
  }

  const saveWorksheetVersion = async () => {
    if (!deal) return
    setError(null)
    const fieldErrors = worksheetFieldErrors(deal)
    if (fieldErrors.length) {
      setShowLineErrors(true)
      setError(fieldErrors.join('. '))
      return
    }
    let lines: { fees: MoneyLine[]; rebates: MoneyLine[]; products: MoneyLine[]; taxLines: MoneyLine[] }
    const amounts = { vehiclePriceCents: Math.round(deal.vehiclePrice * 100), tradeInValueCents: Math.round(deal.tradeInValue * 100), downPaymentCents: Math.round(deal.downPayment * 100) }
    try {
      lines = { fees: normalizeMoneyLines(deal.fees, 'Fee'), rebates: normalizeMoneyLines(deal.rebates, 'Rebate'), products: normalizeMoneyLines(deal.products, 'Product'), taxLines: normalizeMoneyLines(deal.taxLines, 'Tax') }
      assertValidDealPrice(calculateDealPrice({ ...amounts, ...lines, taxAmountCents: sumMoneyLines(lines.taxLines) }))
    } catch (validationError) {
      setError(validationError instanceof Error ? validationError.message : 'Check the worksheet amounts')
      return
    }
    setUpdating(true)
    try {
      const response = await saveDealWorksheet({
        dealId: deal.id,
        structureType: deal.structureType,
        ...amounts,
        ...lines,
        monthlyPaymentCents: Math.round(deal.monthlyPayment * 100),
        loanTerm: deal.structureType === 'cash' ? null : deal.loanTerm,
        apr: deal.structureType === 'finance' ? deal.apr : null,
        residualValueCents: deal.structureType === 'lease' ? deal.residualValueCents : null,
        moneyFactorBasisPoints: deal.structureType === 'lease' ? deal.moneyFactorBasisPoints : null,
        expectedUpdatedAt: deal.updatedAt,
        reason: 'Saved from deal workspace before presentation.',
        idempotencyKey: `deal-worksheet:${deal.id}:${deal.updatedAt}`,
      })
      if (!response.success) throw new Error(response.error || 'Worksheet save failed')
      await loadDeal()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Worksheet save failed'
      setError(isVersionConflict(message)
        ? 'This deal was changed by someone else since you opened it. Your edits have not been lost. Copy your edits before reloading.'
        : `Worksheet not saved: ${message}`)
    } finally {
      setUpdating(false)
    }
  }

  const recordWorksheetDecision = async (action: 'present' | 'accept') => {
    if (!deal) return
    if (action === 'accept') {
      setAcceptanceValues({ acknowledgment: '' })
      setAcceptanceError(null)
      acceptanceIdempotencyKeyRef.current = `deal-accept:${deal.id}:${crypto.randomUUID()}`
      setAcceptanceDialogOpen(true)
      return
    }

    setUpdating(true)
    setError(null)
    const response = await presentDealWorksheet({
      dealId: deal.id,
      expectedUpdatedAt: deal.updatedAt,
      idempotencyKey: `deal-present:${deal.id}:${deal.worksheetVersion}:${deal.updatedAt}`,
    })
    if (!response.success) setError(`Unable to ${action} worksheet: ${response.error}`)
    await loadDeal()
    setUpdating(false)
  }

  const submitWorksheetAcceptance = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!deal) return
    const acknowledgment = acceptanceValues.acknowledgment.trim()
    const idempotencyKey = acceptanceIdempotencyKeyRef.current
    if (!acknowledgment) {
      setAcceptanceError('Acceptance method or reference is required.')
      return
    }
    if (!idempotencyKey) {
      setAcceptanceError('Close and reopen this dialog to try again.')
      return
    }

    setUpdating(true)
    setAcceptanceError(null)
    try {
      const response = await acceptDealWorksheet({ dealId: deal.id, expectedUpdatedAt: deal.updatedAt, acknowledgment, idempotencyKey })
      if (!response.success) {
        setAcceptanceError(`Unable to record worksheet acceptance: ${response.error}`)
        return
      }

      acceptanceIdempotencyKeyRef.current = null
      setAcceptanceDialogOpen(false)
      await loadDeal()
    } catch (error) {
      setAcceptanceError(`Unable to record worksheet acceptance: ${error instanceof Error ? error.message : 'Request failed'}`)
    } finally {
      setUpdating(false)
    }
  }

  const handleAcceptanceDialogOpenChange = (open: boolean) => {
    setAcceptanceDialogOpen(open)
    if (!open) {
      acceptanceIdempotencyKeyRef.current = null
      setAcceptanceValues({ acknowledgment: '' })
      setAcceptanceError(null)
    }
  }

  const selectLenderOffer = async (lenderDecisionId: string) => {
    if (!deal) return
    setUpdating(true)
    setError(null)
    const response = await selectDealLenderOffer({
      dealId: deal.id,
      lenderDecisionId,
      expectedUpdatedAt: deal.updatedAt,
      idempotencyKey: `deal-lender:${deal.id}:${lenderDecisionId}:${deal.worksheetVersion}:${deal.updatedAt}`,
    })
    if (!response.success) setError(`Unable to select lender offer: ${response.error}`)
    await loadDeal()
    setUpdating(false)
  }

  const reopenWorksheet = () => {
    if (!deal) return
    setReopenValues({ reason: '' })
    setReopenError(null)
    reopenIdempotencyKeyRef.current = `deal-reopen:${deal.id}:${crypto.randomUUID()}`
    setReopenDialogOpen(true)
  }

  const submitReopenWorksheet = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!deal) return
    const reason = reopenValues.reason.trim()
    const idempotencyKey = reopenIdempotencyKeyRef.current
    if (!reason) {
      setReopenError('A reason is required to reopen the worksheet.')
      return
    }
    if (reason.length > 1000) {
      setReopenError('The reopen reason must be 1,000 characters or fewer.')
      return
    }
    if (!idempotencyKey) {
      setReopenError('Close and reopen this dialog to try again.')
      return
    }

    setUpdating(true)
    setReopenError(null)
    try {
      const response = await reopenDealWorksheet({ dealId: deal.id, expectedUpdatedAt: deal.updatedAt, reason, idempotencyKey })
      if (!response.success) {
        setReopenError(`Unable to reopen worksheet: ${response.error || 'Request failed'}`)
        return
      }

      await loadDeal()
      reopenIdempotencyKeyRef.current = null
      setReopenDialogOpen(false)
    } catch (error) {
      setReopenError(`Unable to reopen worksheet: ${error instanceof Error ? error.message : 'Request failed'}`)
    } finally {
      setUpdating(false)
    }
  }

  const handleReopenDialogOpenChange = (open: boolean) => {
    setReopenDialogOpen(open)
    if (!open) {
      reopenIdempotencyKeyRef.current = null
      setReopenValues({ reason: '' })
      setReopenError(null)
    }
  }

  const transitionDealStatus = async (newStatus: string, notes: string, idempotencyKey: string) => {
    setUpdating(true)
    try {
      const response = await transitionDeal({ id, toStatus: newStatus, notes, idempotencyKey })
      if (!response.success) return `Failed to update deal: ${response.error || 'Request failed'}`
      await loadDeal()
      return null
    } catch (error) {
      return `Failed to update deal: ${error instanceof Error ? error.message : 'Request failed'}`
    } finally {
      setUpdating(false)
    }
  }

  const updateStatus = async (newStatus: string, approvalDecision?: 'pending' | 'approved' | 'rejected' | 'changes-requested') => {
    const defaultNote = approvalDecision === 'pending'
      ? 'Submitted for approval from the deal page.'
      : approvalDecision === 'approved'
        ? 'Approved from the deal page.'
        : approvalDecision === 'rejected'
          ? 'Rejected from the deal page.'
          : ''

    if (approvalDecision) {
      const title = approvalDecision === 'pending'
        ? 'Submit for approval'
        : approvalDecision === 'approved'
          ? 'Approve deal'
          : approvalDecision === 'rejected'
            ? 'Reject deal'
            : 'Update deal approval'
      setApprovalError(null)
      setApprovalIntent({
        toStatus: newStatus,
        notes: defaultNote,
        idempotencyKey: `deal-transition:${id}:${newStatus}:${deal?.worksheetVersion}:${deal?.updatedAt}`,
        title,
        submitLabel: title,
      })
      return
    }

    setError(null)
    const failure = await transitionDealStatus(newStatus, '', `deal-transition:${id}:${newStatus}:${deal?.worksheetVersion}:${deal?.updatedAt}`)
    if (failure) setError(failure)
  }

  const submitApprovalNotes = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const intent = approvalIntent
    if (!intent) return
    setApprovalError(null)
    const failure = await transitionDealStatus(intent.toStatus, intent.notes, intent.idempotencyKey)
    if (failure) {
      setApprovalError(failure)
      return
    }
    setApprovalIntent(null)
  }

  const handleApprovalNotesOpenChange = (open: boolean) => {
    if (open) return
    setApprovalIntent(null)
    setApprovalError(null)
  }

  const formatCurrency = (value: number | null | undefined) => formatUsd(value)

  const formatDate = (date: string | null) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
    })
  }

  const breadcrumbs = (label: string) => [
    { type: 'link' as const, label: 'Dashboard', href: basePath },
    { type: 'page' as const, label: 'Platform' },
    { type: 'link' as const, label: 'Deals', href: `${basePath}/platform/deals` },
    { type: 'page' as const, label },
  ]

  if (loading && !deal) {
    return (
      <PageContainer title="Deal" header={<DeskHeader eyebrow="Deal" title="Loading deal" tone="idle" />} breadcrumbs={breadcrumbs('Deal')}>
        <div className="flex min-h-[320px] items-center justify-center px-4 md:px-6" role="status">
          <span className="text-sm text-muted-foreground">Loading deal</span>
        </div>
      </PageContainer>
    )
  }

  if (!deal) {
    return (
      <PageContainer
        title="Deal"
        header={
          <DeskHeader
            eyebrow="Deal"
            title="Deal unavailable"
            tone="bad"
            status="Unavailable"
            actions={
              <Track>
                <Pill asChild>
                  <Link href={`${basePath}/platform/deals`}>Back to deals</Link>
                </Pill>
              </Track>
            }
          />
        }
        breadcrumbs={breadcrumbs('Deal')}
      >
        <div className="px-4 pb-24 md:px-6">
          <Notice tone="bad">{error || 'The deal was not found.'}</Notice>
        </div>
      </PageContainer>
    )
  }

  const dealChecklist = [
    { label: 'Customer lead attached', complete: Boolean(deal.lead), detail: deal.lead ? `${deal.lead.firstName} ${deal.lead.lastName}` : 'Attach customer before contracting' },
    { label: 'Vehicle selected', complete: Boolean(deal.vehicle), detail: deal.vehicle ? `${deal.vehicle.stockNumber} · ${deal.vehicle.vin}` : 'Attach vehicle and VIN' },
    { label: 'Negotiated price entered', complete: Number(deal.vehiclePrice || 0) > 0, detail: formatCurrency(deal.vehiclePrice) },
    { label: 'Deal structure complete', complete: deal.structureType === 'cash' ? deal.worksheetVersion > 0 : Number(deal.financingAmount || 0) > 0 && Number(deal.loanTerm || 0) > 0 && Number(deal.monthlyPayment || 0) > 0, detail: deal.structureType === 'cash' ? 'Cash structure' : `${formatCurrency(deal.financingAmount)} · ${deal.loanTerm || '-'} mo · ${formatCurrency(deal.monthlyPayment)}/mo` },
    { label: 'Down payment planned', complete: deal.structureType === 'cash' || Number(deal.downPayment || 0) > 0, detail: deal.structureType === 'cash' ? `${formatCurrency(deal.downPayment)} · cash deal, full total due at signing` : formatCurrency(deal.downPayment) },
    { label: 'Tax saved', complete: deal.worksheetVersion > 0, detail: formatCurrency(deal.taxAmount) },
    { label: 'Manager/F&I approval recorded', complete: deal.approvals?.some(approval => approval.decision === 'approved'), detail: `${deal.approvals?.length || 0} approval event(s)` },
    { label: 'Delivery marked complete', complete: deal.status === 'delivered', detail: deal.saleDate ? formatDate(deal.saleDate) : 'Not delivered' },
  ]
  const checklistComplete = dealChecklist.filter(item => item.complete).length

  const isCash = deal.structureType !== 'finance' && deal.structureType !== 'lease'
  const worksheetSaved = deal.worksheetVersion > 0
  // Server math: a cash structure finances nothing, so the whole total is due at signing and the
  // down payment is a part of it, not a deduction. Finance: amount financed = total - down payment.
  const downPaymentLabel = isCash ? 'Down payment (part of amount due)' : 'Planned down payment'

  const dealTitle = deal.vehicle ? `${deal.vehicle.year} ${deal.vehicle.make} ${deal.vehicle.model}` : 'Deal'
  const customerName = deal.lead ? `${deal.lead.firstName} ${deal.lead.lastName}` : 'No customer'
  const statusLabel = labelForDeal(deal.status)
  const finance = deal.financeEvidence

  // The one next step a desk manager takes from pencil; it renders as the primary pill.
  const pencilNext = worksheetDirty || deal.worksheetVersion === 0
    ? 'save'
    : !deal.presentedAt
      ? 'present'
      : !deal.acceptedAt
        ? 'accept'
        : 'submit'

  const statusActions = (
    <Track aria-label="Deal actions">
      {deal.status === 'pencil' && (
        <>
          <Pill variant={pencilNext === 'save' ? 'primary' : 'raised'} onClick={saveWorksheetVersion} disabled={updating}>
            <Save />
            Save worksheet version
          </Pill>
          {deal.worksheetVersion > 0 && !deal.presentedAt && <Pill variant={pencilNext === 'present' ? 'primary' : 'raised'} onClick={() => recordWorksheetDecision('present')} disabled={updating || worksheetDirty}>Present structure</Pill>}
          {deal.presentedAt && !deal.acceptedAt && <Pill variant={pencilNext === 'accept' ? 'primary' : 'raised'} onClick={() => recordWorksheetDecision('accept')} disabled={updating || worksheetDirty}>Record acceptance</Pill>}
          {deal.acceptedAt && <Pill variant={pencilNext === 'submit' ? 'primary' : 'raised'} onClick={() => updateStatus('submitted', 'pending')} disabled={updating || worksheetDirty}>Submit for approval</Pill>}
        </>
      )}
      {deal.status === 'submitted' && (
        <>
          <Pill variant="primary" onClick={() => updateStatus('approved', 'approved')} disabled={updating}>
            <Check />
            Approve
          </Pill>
          <Pill variant="danger" onClick={() => updateStatus('cancelled', 'rejected')} disabled={updating}>
            <X />
            Reject
          </Pill>
        </>
      )}
      {['submitted', 'approved'].includes(deal.status) && (
        <Pill onClick={reopenWorksheet} disabled={updating}>
          <Pencil />
          Reopen worksheet
        </Pill>
      )}
      {deal.status === 'approved' && (
        <Pill asChild variant="primary">
          <Link href={`${basePath}/platform/finance`}>
            Open finance
            <ArrowRight />
          </Link>
        </Pill>
      )}
      {deal.status === 'financed' && (
        <Pill asChild variant="primary">
          <Link href={`${basePath}/platform/delivery`}>
            Open delivery
            <ArrowRight />
          </Link>
        </Pill>
      )}
    </Track>
  )
  const hasStatusActions = ['pencil', 'submitted', 'approved', 'financed'].includes(deal.status)

  const header = (
    <DeskHeader
      eyebrow={deal.vehicle ? `Deal · Stock #${deal.vehicle.stockNumber}` : 'Deal'}
      title={dealTitle}
      tone={toneForDeal(deal.status)}
      status={statusLabel}
      meta={
        <span className="flex flex-wrap gap-x-2">
          <span className="text-foreground">{statusLabel}</span>
          <span>· {customerName}</span>
          <span>· {deal.salesperson?.name || 'Unassigned'}</span>
          <span>· Created {formatDate(deal.createdAt)}</span>
        </span>
      }
      actions={hasStatusActions ? statusActions : undefined}
    />
  )

  const lineGroups = ([
    ['fees', 'Fees', 'feesCents', 1],
    ['products', 'Products', 'productsCents', 1],
    ['rebates', 'Rebates', 'rebatesCents', -1],
  ] as const)

  const offerTone = (offer: LenderOffer): DeskTone => (offer.selected && finance?.selectedOfferCurrent ? 'ok' : offer.selected ? 'warn' : offer.decision === 'approved' ? 'info' : 'idle')

  return (
    <PageContainer title={dealTitle} header={header} breadcrumbs={breadcrumbs(dealTitle)}>
      <div className="min-w-0 max-w-full space-y-8 px-4 pb-24 md:px-6">
        {(error || worksheetDirty) && (
          <div className="space-y-2">
            {error && <Notice tone="bad">{error}</Notice>}
            {worksheetDirty && <Notice tone="warn" role="status">Unsaved worksheet changes</Notice>}
          </div>
        )}

        {savedPricing && (
          <ReadoutStrip>
            <Readout label="Total price" value={formatCurrency(savedPricing.totalPriceCents / 100)} sub={worksheetSaved ? `Worksheet v${deal.worksheetVersion}` : 'Not saved'} />
            <Readout label="Amount due" value={formatCurrency(savedPricing.cashPayableCents / 100)} sub={isCash && savedPricing.downPaymentCents > 0 ? `Due at signing · includes ${formatCurrency(savedPricing.downPaymentCents / 100)} down` : 'Due at signing'} tone={savedPricing.cashPayableCents > 0 ? 'warn' : 'idle'} />
            {savedPricing.loanTerm > 0 ? (
              <Readout label="Payment" value={`${formatCurrency(savedPricing.monthlyPaymentCents / 100)}/mo`} sub={`${savedPricing.apr}% APR · ${savedPricing.loanTerm} mo`} />
            ) : (
              <Readout label="Amount financed" value={formatCurrency(savedPricing.financingAmountCents / 100)} sub={deal.structureType === 'cash' ? 'Cash' : undefined} />
            )}
            <Readout label="Deal jacket" value={`${checklistComplete}/${dealChecklist.length}`} sub={checklistComplete === dealChecklist.length ? 'Ready' : 'Incomplete'} tone={checklistComplete === dealChecklist.length ? 'ok' : 'warn'} />
          </ReadoutStrip>
        )}

        <div className="grid min-w-0 grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div className="min-w-0 space-y-8">
            <DeskSection
              title="Deal jacket"
              actions={<span className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">{worksheetSaved ? `Saved v${deal.worksheetVersion}` : 'Unsaved'}</span>}
            >
              {savedPricing ? (
                <Panel className="overflow-hidden">
                  <dl className="divide-y divide-border/60">
                    <LedgerRow label="Vehicle price" value={formatCurrency(savedPricing.vehiclePriceCents / 100)} />
                    {lineGroups.map(([field, title, key, sign]) => (
                      <div key={field}>
                        <LedgerRow label={title} value={sign < 0 ? formatUsdCredit(savedPricing[key] / 100) : formatCurrency(savedPricing[key] / 100)} />
                        {!worksheetDirty && deal[field].map((line, index) => (
                          <LedgerRow key={`${field}-${index}`} sub indent label={line.name || line.code} value={sign < 0 ? formatUsdCredit(lineCents(line) / 100) : formatCurrency(lineCents(line) / 100)} />
                        ))}
                      </div>
                    ))}
                    <LedgerRow emphasis="subtotal" label="Subtotal before tax / trade" value={formatCurrency(savedPricing.subtotalCents / 100)} />
                    <div>
                      <LedgerRow label="Tax" value={formatCurrency(savedPricing.taxAmountCents / 100)} />
                      {!worksheetDirty && deal.taxLines.map((line, index) => (
                        <LedgerRow key={`tax-${index}`} sub indent label={line.name || line.code} value={formatCurrency(lineCents(line) / 100)} />
                      ))}
                    </div>
                    <LedgerRow label="Trade-in credit" value={formatUsdCredit(savedPricing.tradeInValueCents / 100)} />
                    <LedgerRow emphasis="total" label="Total price" value={formatCurrency(savedPricing.totalPriceCents / 100)} />
                    {isCash ? (
                      <LedgerRow sub indent label={downPaymentLabel} value={formatCurrency(savedPricing.downPaymentCents / 100)} />
                    ) : (
                      <>
                        <LedgerRow label={downPaymentLabel} value={formatCurrency(savedPricing.downPaymentCents / 100)} />
                        <LedgerRow label="Amount financed" value={formatCurrency(savedPricing.financingAmountCents / 100)} />
                      </>
                    )}
                    <LedgerRow emphasis="subtotal" label="Cash payable · due at signing" value={formatCurrency(savedPricing.cashPayableCents / 100)} />
                  </dl>
                  {(savedPricing.loanTerm > 0 || deal.saleDate) && (
                    <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t bg-muted/40 px-4 py-3">
                      {savedPricing.loanTerm > 0 && (
                        <>
                          <span className="text-xs text-muted-foreground">{savedPricing.apr}% APR · {savedPricing.loanTerm} months · estimated payment</span>
                          <span className="font-mono text-lg font-semibold tabular-nums">{formatCurrency(savedPricing.monthlyPaymentCents / 100)}/mo</span>
                        </>
                      )}
                      {deal.saleDate && <span className="w-full text-xs text-muted-foreground">Sale completed {formatDate(deal.saleDate)}</span>}
                    </div>
                  )}
                </Panel>
              ) : (
                <p className="py-6 text-center text-sm text-muted-foreground">No saved worksheet</p>
              )}
            </DeskSection>

            {deal.status === 'pencil' && (
              <DeskSection title="Worksheet terms">
                <div className="space-y-5">
                  <div className="space-y-1.5">
                    <p className={fieldLabel}>Structure</p>
                    <Segmented
                      label="Deal structure"
                      size="sm"
                      value={deal.structureType === 'finance' ? 'finance' : 'cash'}
                      onChange={(structureType) => editWorksheet({ structureType, ...(structureType === 'cash' ? { loanTerm: 0, apr: 0, financingAmount: 0, monthlyPayment: 0 } : {}) })}
                      options={[{ value: 'cash', label: 'Cash', disabled: updating }, { value: 'finance', label: 'Finance', disabled: updating }]}
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {([
                      ['Negotiated vehicle price', 'vehiclePrice'],
                      ['Trade-in credit', 'tradeInValue'],
                      [isCash ? 'Down payment (part of amount due)' : 'Down payment', 'downPayment'],
                    ] as const).map(([label, field]) => (
                      <label key={field} className="grid min-w-0 gap-1.5">
                        <span className={fieldLabel}>{label}</span>
                        <MoneyInput disabled={updating} aria-label={label} cents={Math.round(Number(deal[field] || 0) * 100)} onCentsChange={(cents) => editWorksheet({ [field]: cents / 100 })} />
                      </label>
                    ))}
                    {deal.structureType === 'finance' && (
                      <>
                        <label className="grid min-w-0 gap-1.5"><span className={fieldLabel}>APR (%)</span><Input disabled={updating} aria-label="APR percentage" className="text-right tabular-nums" type="number" min="0" max="100" step="0.01" value={deal.apr || 0} onChange={(event) => editWorksheet({ apr: Number(event.target.value) })} /></label>
                        <label className="grid min-w-0 gap-1.5"><span className={fieldLabel}>Term (months)</span><Input disabled={updating} aria-label="Term in months" className="text-right tabular-nums" type="number" min="1" max="120" step="1" value={deal.loanTerm || 0} onChange={(event) => editWorksheet({ loanTerm: Number(event.target.value) })} /></label>
                      </>
                    )}
                  </div>
                  <Panel className="space-y-3 p-3">
                    {([['fees', 'Fees', 'fee'], ['products', 'Products', 'product'], ['rebates', 'Rebates', 'rebate'], ['taxLines', 'Tax', 'tax']] as const).map(([field, title, category]) => <WorksheetLines key={field} title={title} category={category} lines={deal[field]} disabled={updating} showErrors={showLineErrors} onChange={lines => editWorksheet({ [field]: lines })} />)}
                  </Panel>
                  <Track>
                    <Pill variant={worksheetDirty ? 'primary' : 'raised'} onClick={saveWorksheetVersion} disabled={updating}>
                      <Save />
                      Save worksheet version
                    </Pill>
                  </Track>
                </div>
              </DeskSection>
            )}

            {deal.structureType !== 'cash' && (
              <DeskSection title={worksheetSaved ? `Lender offers · worksheet ${deal.worksheetVersion}` : 'Lender offers · unsaved worksheet'} count={lenderOffers.length}>
                <div className="space-y-3">
                  {!finance?.selectedOfferCurrent && <Notice tone="warn" role="status">{finance?.issue || 'Select or reconfirm an offer for this saved worksheet.'}</Notice>}
                  {lenderOffers.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">No approved or conditional lender decisions</p>
                  ) : (
                    <Panel className="divide-y">
                      {lenderOffers.map(offer => (
                        <div key={offer.id} className="flex min-w-0 flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <TitleLine as="p" tone={offerTone(offer)} status={offer.decision} className="text-sm font-medium">
                              {offer.providerKey}
                            </TitleLine>
                            <p className="pl-4 text-xs capitalize text-muted-foreground">{offer.decision}{offer.selected ? ' · selected' : ''}</p>
                          </div>
                          <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 sm:justify-end">
                            <dl className="grid grid-cols-3 gap-x-4 text-right font-mono text-xs tabular-nums">
                              <div><dt className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Amount</dt><dd>{formatCurrency((offer.approvedAmountCents || 0) / 100)}</dd></div>
                              <div><dt className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">APR · term</dt><dd>{((offer.aprBasisPoints || 0) / 100).toFixed(2)}% · {offer.termMonths || '-'} mo</dd></div>
                              <div><dt className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Payment</dt><dd>{formatCurrency((offer.monthlyPaymentCents || 0) / 100)}/mo</dd></div>
                            </dl>
                            <Track>
                              <Pill size="sm" variant={offer.selected ? 'primary' : 'raised'} disabled={updating || worksheetDirty || (offer.selected && Boolean(finance?.selectedOfferCurrent)) || deal.status !== 'pencil'} onClick={() => selectLenderOffer(offer.id)}>
                                {offer.selected && finance?.selectedOfferCurrent ? 'Current selection' : offer.selected ? 'Reconfirm offer' : 'Select offer'}
                              </Pill>
                            </Track>
                          </div>
                        </div>
                      ))}
                    </Panel>
                  )}
                </div>
              </DeskSection>
            )}

            <DeskSection
              title="Checklist"
              actions={
                <span className="flex items-center gap-2">
                  <Meter value={checklistComplete / dealChecklist.length} segments={dealChecklist.length} tone={checklistComplete === dealChecklist.length ? 'ok' : 'warn'} label="Deal jacket checklist progress" />
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">{checklistComplete}/{dealChecklist.length} ready</span>
                </span>
              }
            >
              <div className="space-y-3">
                <Panel className="divide-y">
                  {dealChecklist.map(item => (
                    <div key={item.label} className="flex min-w-0 items-start justify-between gap-4 px-4 py-2.5">
                      <div className="min-w-0">
                        <TitleLine as="p" tone={item.complete ? 'ok' : 'warn'} status={item.complete ? 'Complete' : 'Open'} className="text-sm font-medium">
                          {item.label}
                        </TitleLine>
                        <p className="break-words pl-4 text-xs text-muted-foreground">{item.detail}</p>
                      </div>
                      <span className="shrink-0 font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">{item.complete ? 'Done' : 'Open'}</span>
                    </div>
                  ))}
                </Panel>
                {deal.status !== 'delivered' && checklistComplete < dealChecklist.length && <Notice tone="warn" role="status">Incomplete deal jacket</Notice>}
              </div>
            </DeskSection>

            {deal.approvals && deal.approvals.length > 0 && (
              <DeskSection title="Approval history" count={deal.approvals.length}>
                <Panel className="divide-y">
                  {deal.approvals.map(approval => (
                    <div key={approval.id} className="min-w-0 px-4 py-3">
                      <TitleLine as="p" tone={approval.decision === 'approved' ? 'ok' : 'bad'} className="text-sm font-medium capitalize">
                        {approval.decision}
                      </TitleLine>
                      <p className="pl-4 text-xs text-muted-foreground">
                        {approval.approver?.name || 'Unknown'} · {formatDate(approval.approvalDate)}
                      </p>
                      {approval.notes && <p className="mt-1 break-words pl-4 text-sm">{approval.notes}</p>}
                    </div>
                  ))}
                </Panel>
              </DeskSection>
            )}

            <DeskSection title="Worksheet versions" count={worksheetHistory.length}>
              {worksheetHistory.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">No worksheet history</p>
              ) : (
                <Panel className="divide-y">
                  {worksheetHistory.map(entry => (
                    <details key={entry.id} className="min-w-0 text-sm">
                      <summary className="flex cursor-pointer list-none items-baseline justify-between gap-4 px-4 py-2.5 [&::-webkit-details-marker]:hidden">
                        <span className="font-medium">Version {entry.snapshot?.terms?.worksheetVersion}</span>
                        <span className="text-xs tabular-nums text-muted-foreground">{formatDate(entry.occurredAt)}</span>
                      </summary>
                      <pre className="mx-4 mb-3 max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted/50 p-2 font-mono text-[11px] text-muted-foreground">{JSON.stringify(entry.snapshot, null, 2)}</pre>
                    </details>
                  ))}
                </Panel>
              )}
            </DeskSection>
          </div>

          <aside className="min-w-0 space-y-8 lg:sticky lg:top-6 lg:self-start">
            <DeskSection
              title="Customer"
              actions={deal.lead ? <Link href={`${basePath}/platform/crm/${deal.lead.id}`} className="text-xs font-medium text-muted-foreground hover:text-foreground">Open customer record</Link> : undefined}
            >
              {deal.lead ? (
                <Facts items={[
                  { label: 'Name', value: `${deal.lead.firstName} ${deal.lead.lastName}` },
                  { label: 'Sales rep', value: deal.salesperson?.name || 'Unassigned' },
                ]} />
              ) : (
                <p className="py-2 text-sm text-muted-foreground">No customer attached</p>
              )}
            </DeskSection>

            <DeskSection
              title="Vehicle"
              actions={<Link href={`${basePath}/platform/vehicles`} className="text-xs font-medium text-muted-foreground hover:text-foreground">See inventory</Link>}
            >
              {deal.vehicle ? (
                <Facts items={[
                  { label: 'Vehicle', value: `${deal.vehicle.year} ${deal.vehicle.make} ${deal.vehicle.model}` },
                  deal.vehicle.trim ? { label: 'Trim', value: deal.vehicle.trim } : null,
                  { label: 'Stock #', value: <Code className="text-foreground">{deal.vehicle.stockNumber}</Code> },
                  { label: 'VIN', value: <Code className="break-all text-foreground">{deal.vehicle.vin}</Code> },
                  { label: 'Color', value: deal.vehicle.exteriorColor || '-' },
                  { label: 'MSRP', value: formatCurrency(deal.vehicle.price), mono: true },
                ]} />
              ) : (
                <p className="py-2 text-sm text-muted-foreground">No vehicle attached</p>
              )}
            </DeskSection>

            <DeskSection title="Trade and down">
              {savedPricing ? (
                <Facts items={[
                  { label: 'Trade-in credit', value: formatCurrency(savedPricing.tradeInValueCents / 100), mono: true },
                  { label: downPaymentLabel, value: formatCurrency(savedPricing.downPaymentCents / 100), mono: true },
                  { label: 'Structure', value: <span className="capitalize">{deal.structureType || 'cash'}</span> },
                ]} />
              ) : (
                <p className="py-2 text-sm text-muted-foreground">No saved worksheet</p>
              )}
            </DeskSection>

            <DeskSection
              title="Finance evidence"
              actions={<Link href={`${basePath}/platform/finance`} className="text-xs font-medium text-muted-foreground hover:text-foreground">Open finance</Link>}
            >
              <div className="space-y-3">
                <div className="divide-y text-sm">
                  <div className="py-2">
                    <TitleLine as="p" tone={finance?.prerequisites?.current ? 'ok' : 'warn'} className="font-medium">
                      F&I documents · {finance?.prerequisites?.current ? 'Current' : 'Review required'}
                    </TitleLine>
                    {finance?.prerequisites?.issue && <p className="break-words pl-4 text-xs text-muted-foreground">{finance.prerequisites.issue}</p>}
                  </div>
                  <div className="py-2">
                    <TitleLine as="p" tone={finance?.fundingCurrent ? 'ok' : 'warn'} className="font-medium">
                      Funding · {finance?.fundingCurrent ? 'Current' : 'Reconfirmation required'}
                    </TitleLine>
                    <p className="pl-4 text-xs text-muted-foreground">Worksheet version {finance?.fundingWorksheetVersion ?? 'none'}</p>
                  </div>
                </div>
                <div className="border-t pt-1">
                  <FinanceEvidenceHistory dealId={deal.id} aggregateType="Deal" label="Deal history" />
                </div>
              </div>
            </DeskSection>
          </aside>
        </div>

        <OperatorActionDialog
          open={acceptanceDialogOpen}
          title="Record customer acceptance"
          description="Record how the customer accepted the presented worksheet."
          fields={[{ name: 'acknowledgment', label: 'Acceptance method or reference', required: true, maxLength: 1000, placeholder: 'For example: in-person verbal acknowledgment or signed document reference' }]}
          values={acceptanceValues}
          error={acceptanceError}
          busy={updating}
          submitLabel="Record acceptance"
          onValuesChange={values => setAcceptanceValues({ acknowledgment: values.acknowledgment || '' })}
          onSubmit={submitWorksheetAcceptance}
          onOpenChange={handleAcceptanceDialogOpenChange}
        />
        <OperatorActionDialog
          open={Boolean(approvalIntent)}
          title={approvalIntent?.title || 'Update deal'}
          fields={[{ name: 'notes', label: 'Approval notes (optional)', type: 'textarea', required: false, placeholder: 'Optional notes for the deal record' }]}
          values={{ notes: approvalIntent?.notes || '' }}
          error={approvalError}
          busy={updating}
          submitLabel={approvalIntent?.submitLabel || 'Confirm transition'}
          onValuesChange={values => setApprovalIntent(current => current ? { ...current, notes: values.notes || '' } : current)}
          onSubmit={submitApprovalNotes}
          onOpenChange={handleApprovalNotesOpenChange}
        />
        <OperatorActionDialog
          open={reopenDialogOpen}
          title="Reopen worksheet"
          description="The deal returns to pencil and its lender selection is cleared."
          fields={[{ name: 'reason', label: 'Reopen reason', required: true, maxLength: 1000, placeholder: 'Why does this worksheet need to be reopened?' }]}
          values={reopenValues}
          error={reopenError}
          busy={updating}
          submitLabel="Reopen worksheet"
          onValuesChange={values => setReopenValues({ reason: values.reason || '' })}
          onSubmit={submitReopenWorksheet}
          onOpenChange={handleReopenDialogOpenChange}
        />
      </div>
    </PageContainer>
  )
}
