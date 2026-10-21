'use client'

import { useState, useEffect, useRef, type FormEvent } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Car,
  DollarSign,
  User,
  Calendar,
  Edit,
  CheckCircle,
  XCircle,
  Clock,
  FileText
} from 'lucide-react'
import { PageContainer } from '@/features/dashboard/components/PageContainer'
import { basePath } from '@/features/dashboard/lib/config'
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
import { calculateDealPrice, assertValidDealPrice, normalizeMoneyLines, sumMoneyLines, type MoneyLine } from '@/features/keystone/lifecycle/dealPricing'
import { WorksheetLines } from '../components/WorksheetLines'
import { readFinanceEvidence, type FinanceEvidence } from '../lib/financeEvidence'
import { FinanceEvidenceHistory } from '../components/FinanceEvidenceHistory'
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
    color: string
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

const statusConfig: Record<string, { color: string; icon: React.ElementType; label: string }> = {
  pencil: { color: 'bg-slate-100 text-slate-700', icon: FileText, label: 'Pencil (Draft)' },
  submitted: { color: 'bg-blue-100 text-blue-700', icon: Clock, label: 'Pending Approval' },
  approved: { color: 'bg-green-100 text-green-700', icon: CheckCircle, label: 'Approved' },
  financed: { color: 'bg-purple-100 text-purple-700', icon: DollarSign, label: 'Financed' },
  delivered: { color: 'bg-emerald-100 text-emerald-700', icon: Car, label: 'Delivered' },
  cancelled: { color: 'bg-red-100 text-red-700', icon: XCircle, label: 'Cancelled' },
}

export function DealDetailPageClient({ id }: { id: string }) {
  const [deal, setDeal] = useState<Deal | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updating, setUpdating] = useState(false)
  const [worksheetDirty, setWorksheetDirty] = useState(false)
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
      setWorksheetDirty(false)
      setWorksheetHistory(response.data.dealWorkspace.worksheetVersions || [])
      setSavedPricing({ ...calculateDealPrice(value), financingAmountCents: value.financingAmountCents || 0, monthlyPaymentCents: value.monthlyPaymentCents || 0, apr: value.apr || 0, loanTerm: value.loanTerm || 0 })
      const dollars = (cents: number | null | undefined) => (cents ?? 0) / 100
      setDeal({ ...value, vehiclePrice: dollars(value.vehiclePriceCents), tradeInValue: dollars(value.tradeInValueCents), downPayment: dollars(value.downPaymentCents), financingAmount: dollars(value.financingAmountCents), monthlyPayment: dollars(value.monthlyPaymentCents), taxAmount: dollars(value.taxAmountCents), totalPrice: dollars(value.totalPriceCents), profit: null, salesperson: value.salesperson ? { ...value.salesperson, email: '' } : null, lead: value.lead ? { ...value.lead, email: '', phone: '' } : null, vehicle: value.vehicle ? { ...value.vehicle, color: null, price: dollars(value.vehicle.priceCents), purchasePrice: 0 } : null })
      const offers = await getDealLenderOffers(id)
      setLenderOffers(offers.success ? offers.data?.dealLenderOffers || [] : [])
    } else {
      setDeal(null)
      setError(response.error || 'The deal was not found.')
    }
    setLoading(false)
  }

  const saveWorksheetVersion = async () => {
    if (!deal) return
    setUpdating(true)
    setError(null)
    try {
      const lines = { fees: normalizeMoneyLines(deal.fees, 'Fee'), rebates: normalizeMoneyLines(deal.rebates, 'Rebate'), products: normalizeMoneyLines(deal.products, 'Product'), taxLines: normalizeMoneyLines(deal.taxLines, 'Tax') }
      const amounts = { vehiclePriceCents: Math.round(deal.vehiclePrice * 100), tradeInValueCents: Math.round(deal.tradeInValue * 100), downPaymentCents: Math.round(deal.downPayment * 100) }
      assertValidDealPrice(calculateDealPrice({ ...amounts, ...lines, taxAmountCents: sumMoneyLines(lines.taxLines) }))
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
      setError(`${error instanceof Error ? error.message : 'Worksheet save failed'}. Your edits have not been lost. If someone else changed this deal, copy your edits before reloading.`)
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
      ? 'Submitted for finance desk approval.'
      : approvalDecision === 'approved'
        ? 'Approved by finance desk.'
        : approvalDecision === 'rejected'
          ? 'Rejected by finance desk.'
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

  const formatCurrency = (value: number | null | undefined) => {
    if (value == null) return '-'
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value)
  }

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
      <PageContainer title="Deal" breadcrumbs={breadcrumbs('Deal')}>
        <div className="px-4 md:px-6 flex items-center justify-center min-h-[400px]" role="status">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" aria-hidden="true"></div>
          <span className="sr-only">Loading deal</span>
        </div>
      </PageContainer>
    )
  }

  if (!deal) {
    return (
      <PageContainer title="Deal" breadcrumbs={breadcrumbs('Deal')}>
        <div className="px-4 py-6 md:px-6 text-center">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">Deal unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">{error || 'The deal was not found.'}</p>
          <Button asChild variant="outline" className="mt-4">
            <Link href={`${basePath}/platform/deals`}>Back to Deals</Link>
          </Button>
        </div>
      </PageContainer>
    )
  }

  const status = statusConfig[deal.status] || statusConfig.pencil
  const dealChecklist = [
    { label: 'Customer lead attached', complete: Boolean(deal.lead), detail: deal.lead ? `${deal.lead.firstName} ${deal.lead.lastName}` : 'Attach customer before contracting' },
    { label: 'Vehicle selected', complete: Boolean(deal.vehicle), detail: deal.vehicle ? `${deal.vehicle.stockNumber} · ${deal.vehicle.vin}` : 'Attach vehicle and VIN' },
    { label: 'Negotiated price entered', complete: Number(deal.vehiclePrice || 0) > 0, detail: formatCurrency(deal.vehiclePrice) },
    { label: 'Deal structure complete', complete: deal.structureType === 'cash' ? deal.worksheetVersion > 0 : Number(deal.financingAmount || 0) > 0 && Number(deal.loanTerm || 0) > 0 && Number(deal.monthlyPayment || 0) > 0, detail: deal.structureType === 'cash' ? 'Cash structure' : `${formatCurrency(deal.financingAmount)} · ${deal.loanTerm || '-'} mo · ${formatCurrency(deal.monthlyPayment)}/mo` },
    { label: 'Down payment planned', complete: deal.structureType === 'cash' || Number(deal.downPayment || 0) > 0, detail: formatCurrency(deal.downPayment) },
    { label: 'Tax saved', complete: deal.worksheetVersion > 0, detail: formatCurrency(deal.taxAmount) },
    { label: 'Manager/F&I approval recorded', complete: deal.approvals?.some(approval => approval.decision === 'approved'), detail: `${deal.approvals?.length || 0} approval event(s)` },
    { label: 'Delivery marked complete', complete: deal.status === 'delivered', detail: deal.saleDate ? formatDate(deal.saleDate) : 'Not delivered' },
  ]
  const checklistComplete = dealChecklist.filter(item => item.complete).length

  const dealTitle = deal.vehicle ? `${deal.vehicle.year} ${deal.vehicle.make} ${deal.vehicle.model}` : 'Deal'

  return (
    <PageContainer title={dealTitle} breadcrumbs={breadcrumbs(dealTitle)}>
    <div className="min-w-0 space-y-6 px-4 pb-6 md:px-6">
      {error && <div role="alert" className="rounded-lg border border-destructive/50 bg-destructive/5 p-4 text-sm">{error}</div>}
      {worksheetDirty && <p role="status" className="rounded-lg border bg-muted/40 p-3 text-sm">Unsaved worksheet changes</p>}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">{dealTitle}</h1>
              <Badge className={status.color}>
                {status.label}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              Deal created {formatDate(deal.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">
          {deal.status === 'pencil' && (
            <>
              <Button variant="outline" onClick={saveWorksheetVersion} disabled={updating}>Save Worksheet Version</Button>
              {deal.worksheetVersion > 0 && !deal.presentedAt && <Button variant="outline" onClick={() => recordWorksheetDecision('present')} disabled={updating || worksheetDirty}>Present Structure</Button>}
              {deal.presentedAt && !deal.acceptedAt && <Button variant="outline" onClick={() => recordWorksheetDecision('accept')} disabled={updating || worksheetDirty}>Record Acceptance</Button>}
              {deal.acceptedAt && <Button variant="outline" onClick={() => updateStatus('submitted', 'pending')} disabled={updating || worksheetDirty}>Submit for Approval</Button>}
            </>
          )}
          {['submitted', 'approved'].includes(deal.status) && <Button variant="outline" onClick={reopenWorksheet} disabled={updating}><Edit className="h-4 w-4 mr-2" />Reopen Worksheet</Button>}
          {deal.status === 'submitted' && (
            <>
              <Button variant="outline" onClick={() => updateStatus('approved', 'approved')} disabled={updating}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Approve
              </Button>
              <Button variant="destructive" onClick={() => updateStatus('cancelled', 'rejected')} disabled={updating}>
                <XCircle className="h-4 w-4 mr-2" />
                Reject
              </Button>
            </>
          )}
          {deal.status === 'approved' && (
            <Button asChild>
              <Link href={`${basePath}/platform/finance`}>Open Finance</Link>
            </Button>
          )}
          {deal.status === 'financed' && (
            <Button asChild>
              <Link href={`${basePath}/platform/delivery`}>
                <Car className="h-4 w-4 mr-2" />
                Open Delivery
              </Link>
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {deal.structureType !== 'cash' && (
            <Card>
              <CardHeader><CardTitle>Lender offers · worksheet {deal.worksheetVersion}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {!deal.financeEvidence?.selectedOfferCurrent && <p role="status" className="text-sm text-amber-700">{deal.financeEvidence?.issue || 'Select or reconfirm an offer for this saved worksheet.'}</p>}
                {lenderOffers.length === 0 ? <p className="text-sm text-muted-foreground">No approved or conditional lender decisions</p> : lenderOffers.map(offer => (
                  <div key={offer.id} className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div><p className="font-medium">{offer.providerKey} · {offer.decision}</p><p className="text-sm text-muted-foreground">{formatCurrency((offer.approvedAmountCents || 0) / 100)} · {((offer.aprBasisPoints || 0) / 100).toFixed(2)}% APR · {offer.termMonths || '-'} mo · {formatCurrency((offer.monthlyPaymentCents || 0) / 100)}/mo</p></div>
                    <Button size="sm" variant={offer.selected ? 'default' : 'outline'} disabled={updating || worksheetDirty || (offer.selected && Boolean(deal.financeEvidence?.selectedOfferCurrent)) || deal.status !== 'pencil'} onClick={() => selectLenderOffer(offer.id)}>{offer.selected && deal.financeEvidence?.selectedOfferCurrent ? 'Current selection' : offer.selected ? 'Reconfirm offer' : 'Select offer'}</Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Vehicle Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Car className="h-5 w-5" />
                Vehicle Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              {deal.vehicle ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Vehicle</p>
                    <p className="font-medium">{deal.vehicle.year} {deal.vehicle.make} {deal.vehicle.model}</p>
                    {deal.vehicle.trim && <p className="text-sm text-muted-foreground">{deal.vehicle.trim}</p>}
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Stock Number</p>
                    <p className="font-medium">{deal.vehicle.stockNumber}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">VIN</p>
                    <p className="font-mono text-sm">{deal.vehicle.vin}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Color</p>
                    <p className="font-medium">{deal.vehicle.color || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">MSRP</p>
                    <p className="font-medium">{formatCurrency(deal.vehicle.price)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Cost</p>
                    <Link href={`${basePath}/platform/vehicles`} className="font-medium text-primary hover:underline">See inventory</Link>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">No vehicle attached</p>
              )}
            </CardContent>
          </Card>

          {/* Customer Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Customer Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              {deal.lead ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Name</p>
                    <p className="font-medium">{deal.lead.firstName} {deal.lead.lastName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">CRM relationship</p>
                    <Link href={`${basePath}/platform/crm/${deal.lead.id}`} className="font-medium text-primary hover:underline">Open customer record</Link>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Sales Rep</p>
                    <p className="font-medium">{deal.salesperson?.name || 'Unassigned'}</p>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">No customer attached</p>
              )}
            </CardContent>
          </Card>

          {deal.status === 'pencil' && (
            <Card>
              <CardHeader>
                <CardTitle>Worksheet terms</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Structure</Label>
                  <Select disabled={updating} value={deal.structureType || 'cash'} onValueChange={(structureType) => { setWorksheetDirty(true); setDeal(current => current ? { ...current, structureType, ...(structureType === 'cash' ? { loanTerm: 0, apr: 0, financingAmount: 0, monthlyPayment: 0 } : {}) } : current) }}>
                    <SelectTrigger aria-label="Deal structure"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="finance">Finance</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {[
                    ['Negotiated vehicle price', 'vehiclePrice'],
                    ['Trade-in credit', 'tradeInValue'],
                    ['Down payment', 'downPayment'],
                  ].map(([label, field]) => (
                    <div key={field} className="space-y-2">
                      <Label>{label}</Label>
                      <Input disabled={updating} aria-label={label} type="number" min="0" step="0.01" value={Number(deal[field as keyof Deal] || 0)} onChange={(event) => { setWorksheetDirty(true); setDeal(current => current ? { ...current, [field]: Number(event.target.value) } : current) }} />
                    </div>
                  ))}
                  {deal.structureType === 'finance' && (
                    <>
                      <div className="space-y-2"><Label>APR (%)</Label><Input disabled={updating} aria-label="APR percentage" type="number" min="0" max="100" step="0.01" value={deal.apr || 0} onChange={(event) => { setWorksheetDirty(true); setDeal(current => current ? { ...current, apr: Number(event.target.value) } : current) }} /></div>
                      <div className="space-y-2"><Label>Term (months)</Label><Input disabled={updating} aria-label="Term in months" type="number" min="1" max="120" step="1" value={deal.loanTerm || 0} onChange={(event) => { setWorksheetDirty(true); setDeal(current => current ? { ...current, loanTerm: Number(event.target.value) } : current) }} /></div>
                    </>
                  )}
                </div>
                {([['fees', 'Fees', 'fee'], ['products', 'Products', 'product'], ['rebates', 'Rebates', 'rebate'], ['taxLines', 'Tax', 'tax']] as const).map(([field, title, category]) => <WorksheetLines key={field} title={title} category={category} lines={deal[field]} disabled={updating} onChange={lines => { setWorksheetDirty(true); setDeal(current => current ? { ...current, [field]: lines } : current) }} />)}
                <p className="text-xs text-muted-foreground">Tax · front gross</p>
              </CardContent>
            </Card>
          )}

          {/* Deal Jacket Checklist */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Deal Jacket Checklist
                </span>
                <Badge variant="outline">{checklistComplete}/{dealChecklist.length} ready</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {dealChecklist.map((item) => (
                  <div key={item.label} className="flex items-start gap-3 rounded-lg border p-3">
                    <div className={`mt-0.5 h-5 w-5 rounded-full flex items-center justify-center ${item.complete ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      {item.complete ? <CheckCircle className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{item.label}</p>
                      <p className="text-sm text-muted-foreground">{item.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
              {deal.status !== 'delivered' && checklistComplete < dealChecklist.length && (
                <p className="mt-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  Incomplete deal jacket
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Worksheet history</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <FinanceEvidenceHistory dealId={deal.id} aggregateType="Deal" label="Deal history" />
              <p className="text-sm">
                F&I documents: {deal.financeEvidence?.prerequisites?.current ? 'Current' : 'Review required'}.{' '}
                {deal.financeEvidence?.prerequisites?.issue}{' '}
                <Link className="underline" href={`${basePath}/platform/finance`}>Open Finance</Link>
              </p>
              <p className="text-sm">
                Funding: {deal.financeEvidence?.fundingCurrent ? 'Current' : 'Reconfirmation required'} · worksheet version {deal.financeEvidence?.fundingWorksheetVersion ?? 'none'}
              </p>
              {worksheetHistory.length === 0 ? <p className="text-sm text-muted-foreground">No worksheet history.</p> : worksheetHistory.map(entry => <details key={entry.id} className="rounded border p-3 text-sm"><summary>Version {entry.snapshot?.terms?.worksheetVersion} · {formatDate(entry.occurredAt)}</summary><pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-all text-xs">{JSON.stringify(entry.snapshot, null, 2)}</pre></details>)}
            </CardContent>
          </Card>
          {/* Approvals Timeline */}
          {deal.approvals && deal.approvals.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Approval History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {deal.approvals.map((approval) => (
                    <div key={approval.id} className="flex gap-4 items-start">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                        approval.decision === 'approved' ? 'bg-green-100' : 'bg-red-100'
                      }`}>
                        {approval.decision === 'approved' ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium capitalize">{approval.decision}</p>
                        <p className="text-sm text-muted-foreground">
                          by {approval.approver?.name || 'Unknown'} on {formatDate(approval.approvalDate)}
                        </p>
                        {approval.notes && <p className="text-sm mt-1">{approval.notes}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Deal Summary */}
        <div>
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Deal Summary
              </CardTitle>
            </CardHeader>
            {savedPricing && <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">Saved worksheet version {deal.worksheetVersion}</p>
              <dl className="space-y-2 text-sm">
                {([
                  ['Vehicle price', savedPricing.vehiclePriceCents],
                  ['Fees', savedPricing.feesCents],
                  ['Products', savedPricing.productsCents],
                  ['Rebates', -savedPricing.rebatesCents],
                  ['Subtotal before tax / trade', savedPricing.subtotalCents],
                  ['Tax', savedPricing.taxAmountCents],
                  ['Trade-in credit', -savedPricing.tradeInValueCents],
                ] as const).map(([label, cents]) => <div key={label} className="flex justify-between gap-3"><dt className="text-muted-foreground">{label}</dt><dd className="tabular-nums">{formatCurrency(cents / 100)}</dd></div>)}
                <div className="flex justify-between gap-3 border-t pt-3 text-base font-semibold"><dt>Total price</dt><dd>{formatCurrency(savedPricing.totalPriceCents / 100)}</dd></div>
                <div className="flex justify-between gap-3"><dt>Planned down payment</dt><dd>{formatCurrency(savedPricing.downPaymentCents / 100)}</dd></div>
                <div className="flex justify-between gap-3"><dt>Amount financed</dt><dd>{formatCurrency(savedPricing.financingAmountCents / 100)}</dd></div>
                <div className="flex justify-between gap-3"><dt>Cash payable</dt><dd>{formatCurrency(savedPricing.cashPayableCents / 100)}</dd></div>
              </dl>
              <p className="text-xs text-muted-foreground">Due at signing</p>
              {savedPricing.loanTerm > 0 && <div className="rounded-lg bg-muted p-4">
                <p className="text-sm text-muted-foreground">{savedPricing.apr}% APR · {savedPricing.loanTerm} months · estimated payment</p>
                <p className="text-2xl font-semibold tabular-nums">{formatCurrency(savedPricing.monthlyPaymentCents / 100)}/mo</p>
              </div>}
              {deal.saleDate && <p className="text-sm">Sale completed {formatDate(deal.saleDate)}</p>}
            </CardContent>}
          </Card>
        </div>
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
