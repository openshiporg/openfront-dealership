'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, RefreshCw, Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { PageContainer } from '@/features/dashboard/components/PageContainer'
import { basePath } from '@/features/dashboard/lib/config'
import { Code, DeskHeader, DeskSection, Facts, Notice, Panel, Pill, Readout, ReadoutStrip, Segmented, TitleLine, Track } from '@/features/platform/components/desk'
import { formatCentsForInput, parseDollarsToCents } from '@/features/platform/deals/lib/moneyInput'
import { cn } from '@/lib/utils'
import { getCancellationsWorkspace, recordProductCancellation } from '../actions/cancellations'
import { FinanceFormDialog, type FieldErrors, type FinanceFormField } from '../components/FinanceFormDialog'
import type { AcceptedMenu, CancellationDeal, CancellationRecord, CancellationsWorkspace } from '../lib/cancellationTypes'
import type { MenuOption } from '../lib/menuTypes'
import { formatCents, formatDateTime, formatDay, newIdempotencyKey, personName, stateTone, vehicleName } from '../lib/display'
import { calculateRefund, monthsBetween, type RefundBasis } from '../lib/refund'

type Tab = 'requested' | 'completed' | 'denied' | 'all'
type CancellationCase = {
  key: string
  deal: CancellationDeal | null
  menu: NonNullable<CancellationRecord['menu']>
  productCode: string
  option: MenuOption | null
  records: CancellationRecord[]
  latest: CancellationRecord
}
type DialogState =
  | { kind: 'new'; values: Record<string, string>; idempotencyKey: string }
  | { kind: 'complete' | 'deny'; item: CancellationCase; values: Record<string, string>; idempotencyKey: string }

const statusLabels: Record<string, string> = { requested: 'Requested', completed: 'Completed', denied: 'Denied' }

function buildCases(records: CancellationRecord[]): CancellationCase[] {
  const groups = new Map<string, CancellationRecord[]>()
  for (const record of records) {
    if (!record.menu) continue
    const key = `${record.menu.id}:${record.productCode}`
    groups.set(key, [...(groups.get(key) || []), record])
  }
  return [...groups.entries()].map(([key, items]) => {
    const sorted = [...items].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    const latest = sorted[sorted.length - 1]
    const option = (latest.menu?.optionsSnapshot || []).find(item => item.code === latest.productCode) || null
    return { key, deal: latest.deal, menu: latest.menu!, productCode: latest.productCode, option, records: sorted.reverse(), latest }
  }).sort((a, b) => new Date(b.latest.createdAt).getTime() - new Date(a.latest.createdAt).getTime())
}

function saleDateOf(item: { deal: CancellationDeal | null; menu: { decidedAt: string | null } }) {
  return item.deal?.saleDate || item.menu.decidedAt
}

export function FinanceCancellationsPageClient({
  initial,
  initialError,
  timeZone,
  focusDealId,
}: {
  initial: CancellationsWorkspace | null
  initialError: string | null
  timeZone: string
  focusDealId: string | null
}) {
  const router = useRouter()
  const [workspace, setWorkspace] = useState<CancellationsWorkspace | null>(initial)
  const [error, setError] = useState<string | null>(initialError)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<Tab>('requested')
  const [search, setSearch] = useState('')
  const [dealFilter, setDealFilter] = useState<string | null>(focusDealId)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [calc, setCalc] = useState<{ key: string; monthsUsed: string; fee: string } | null>(null)
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const reload = async () => {
    setLoading(true)
    const response = await getCancellationsWorkspace()
    if (response.success) { setWorkspace(response.data); setError(null) } else setError(response.error)
    setLoading(false)
    router.refresh()
  }

  const cases = useMemo(() => buildCases(workspace?.cancellations || []), [workspace])
  const scoped = dealFilter ? cases.filter(item => item.deal?.id === dealFilter) : cases
  const counts: Record<Tab, number> = {
    requested: scoped.filter(item => item.latest.status === 'requested').length,
    completed: scoped.filter(item => item.latest.status === 'completed').length,
    denied: scoped.filter(item => item.latest.status === 'denied').length,
    all: scoped.length,
  }
  const term = search.trim().toLowerCase()
  const visible = scoped
    .filter(item => tab === 'all' || item.latest.status === tab)
    .filter(item => !term || `${personName(item.deal?.lead)} ${vehicleName(item.deal?.vehicle)} ${item.deal?.vehicle?.stockNumber || ''} ${item.productCode} ${item.option?.name || ''}`.toLowerCase().includes(term))
  const selected = visible.find(item => item.key === selectedKey) ?? visible[0] ?? null
  const refundedTotal = cases.filter(item => item.latest.status === 'completed').reduce((sum, item) => sum + (item.latest.refundCents || 0), 0)

  // Accepted-menu products that can still be cancelled: no open or completed case.
  const cancellable = useMemo(() => {
    const blocked = new Set(cases.filter(item => item.latest.status !== 'denied').map(item => item.key))
    return (workspace?.acceptedMenus || []).flatMap((menu: AcceptedMenu) => (menu.selectedProductCodes || [])
      .filter(code => !blocked.has(`${menu.id}:${code}`))
      .map(code => ({ menu, code, option: (menu.optionsSnapshot || []).find(item => item.code === code) || null })))
  }, [cases, workspace])
  const cancellableForFilter = dealFilter ? cancellable.filter(item => item.menu.deal?.id === dealFilter) : cancellable

  const basisFor = (item: CancellationCase): RefundBasis => {
    const state = calc?.key === item.key ? calc : null
    const prior = item.latest.evidence?.refundBasis
    const monthsUsed = state ? Number(state.monthsUsed) : prior?.monthsUsed ?? monthsBetween(saleDateOf(item) || new Date().toISOString(), new Date())
    const fee = state ? parseDollarsToCents(state.fee) : prior?.cancellationFeeCents ?? 0
    const termMonths = item.option?.termMonths || 0
    return {
      method: termMonths > 0 ? 'pro-rata-months' : 'flat',
      retailPriceCents: item.option?.retailPriceCents || 0,
      termMonths,
      monthsUsed: Number.isInteger(monthsUsed) && monthsUsed >= 0 ? Math.min(monthsUsed, 240) : 0,
      cancellationFeeCents: fee ?? 0,
    }
  }

  const openNew = () => {
    setFieldErrors({}); setFormError(null)
    const first = cancellableForFilter.length === 1 ? `${cancellableForFilter[0].menu.id}|${cancellableForFilter[0].code}` : ''
    setDialog({ kind: 'new', idempotencyKey: newIdempotencyKey('finance-cancellation'), values: { product: first, reason: '', estimate: '' } })
  }
  const openDecision = (kind: 'complete' | 'deny', item: CancellationCase) => {
    setFieldErrors({}); setFormError(null)
    const refund = calculateRefund(basisFor(item)).refundCents
    setDialog({
      kind, item, idempotencyKey: newIdempotencyKey('finance-cancellation'),
      values: kind === 'complete' ? { reason: item.latest.reason, refund: formatCentsForInput(refund), reference: '' } : { reason: '' },
    })
  }

  const submit = async () => {
    if (!dialog) return
    const v = dialog.values
    const errors: FieldErrors = {}
    if (!(v.reason || '').trim()) errors.reason = dialog.kind === 'deny' ? 'Enter why the cancellation was denied.' : 'Enter the cancellation reason.'
    let payload: Parameters<typeof recordProductCancellation>[0] | null = null
    if (dialog.kind === 'new') {
      const [menuId, code] = (v.product || '').split('|')
      const target = cancellable.find(item => item.menu.id === menuId && item.code === code)
      if (!target?.menu.deal) errors.product = 'Select a sold product.'
      const estimate = (v.estimate || '').trim() ? parseDollarsToCents(v.estimate) : 0
      if (estimate == null) errors.estimate = 'Enter a dollar amount.'
      if (target?.menu.deal && estimate != null) payload = {
        dealId: target.menu.deal.id, menuId: target.menu.id, productCode: target.code, status: 'requested',
        reason: v.reason.trim(), refundCents: estimate, refundBasis: null, idempotencyKey: dialog.idempotencyKey,
      }
    } else if (dialog.kind === 'complete') {
      const refund = (v.refund || '').trim() ? parseDollarsToCents(v.refund) : null
      if (refund == null) errors.refund = 'Enter the refund amount, $0 if none.'
      if (!(v.reference || '').trim()) errors.reference = 'Enter the provider cancellation reference.'
      const basis = basisFor(dialog.item)
      if (refund != null && dialog.item.deal) payload = {
        dealId: dialog.item.deal.id, menuId: dialog.item.menu.id, productCode: dialog.item.productCode, status: 'completed',
        reason: v.reason.trim(), refundCents: refund, refundBasis: basis, evidenceReference: v.reference.trim(), idempotencyKey: dialog.idempotencyKey,
      }
    } else if (dialog.item.deal) {
      payload = {
        dealId: dialog.item.deal.id, menuId: dialog.item.menu.id, productCode: dialog.item.productCode, status: 'denied',
        reason: v.reason.trim(), refundCents: 0, refundBasis: null, idempotencyKey: dialog.idempotencyKey,
      }
    }
    setFieldErrors(errors)
    if (Object.keys(errors).length || !payload) return
    setBusy(true); setFormError(null)
    const response = await recordProductCancellation(payload)
    setBusy(false)
    if (!response.success) { setFormError(response.error); return }
    setDialog(null)
    setNotice(`${payload.productCode} cancellation ${payload.status}.`)
    if (dialog.kind === 'new') { setTab('requested'); setSelectedKey(`${payload.menuId}:${payload.productCode}`) }
    if (dialog.kind === 'complete') setTab('completed')
    if (dialog.kind === 'deny') setTab('denied')
    await reload()
  }

  const dialogFields: FinanceFormField[] = !dialog ? [] : dialog.kind === 'new' ? [
    {
      name: 'product', label: 'Sold product', type: 'select', wide: true,
      options: cancellableForFilter.map(item => ({
        value: `${item.menu.id}|${item.code}`,
        label: `${personName(item.menu.deal?.lead)} · ${item.option?.name || item.code} (${item.code}) · ${formatCents(item.option?.retailPriceCents ?? null)}`,
      })),
      placeholder: cancellableForFilter.length ? 'Select a product' : 'No sold products to cancel',
    },
    { name: 'reason', label: 'Reason', type: 'textarea', maxLength: 1000 },
    { name: 'estimate', label: 'Estimated refund (optional)', type: 'money' },
  ] : dialog.kind === 'complete' ? [
    { name: 'refund', label: 'Refund amount', type: 'money', description: `Calculated ${formatCents(calculateRefund(basisFor(dialog.item)).refundCents)}` },
    { name: 'reference', label: 'Cancellation reference', maxLength: 200 },
    { name: 'reason', label: 'Reason', type: 'textarea', maxLength: 1000 },
  ] : [
    { name: 'reason', label: 'Denial reason', type: 'textarea', maxLength: 1000 },
  ]

  const breadcrumbs = [
    { type: 'link' as const, label: 'Dashboard', href: basePath },
    { type: 'page' as const, label: 'Platform' },
    { type: 'link' as const, label: 'Finance', href: `${basePath}/platform/finance` },
    { type: 'page' as const, label: 'Cancellations' },
  ]
  const header = (
    <DeskHeader
      title="Product cancellations"
      tone={error ? 'bad' : counts.requested > 0 ? 'warn' : 'ok'}
      status={error ? 'Unavailable' : `${counts.requested} requested`}
      meta={error ? 'Unavailable' : `${counts.requested} requested · ${counts.completed} completed · ${counts.denied} denied`}
      actions={
        <Track>
          <Pill asChild variant="plain"><Link href={`${basePath}/platform/finance`}><ArrowLeft />Finance</Link></Pill>
          <Pill onClick={reload} disabled={loading} aria-label="Refresh"><RefreshCw className={loading ? 'animate-spin' : undefined} />Refresh</Pill>
          <Pill variant="primary" onClick={openNew} disabled={!cancellableForFilter.length} title={!cancellableForFilter.length ? 'No accepted menu products to cancel' : undefined}>
            <Plus />New cancellation
          </Pill>
        </Track>
      }
    />
  )

  if (error && !workspace) {
    return (
      <PageContainer title="Product cancellations" header={header} breadcrumbs={breadcrumbs}>
        <div className="space-y-3 px-4 pb-24 md:px-6">
          <Notice tone="bad"><p className="font-medium">Cancellations are unavailable</p><p className="mt-0.5 text-muted-foreground">{error}</p></Notice>
          <Track><Pill onClick={reload} disabled={loading}>Retry</Pill></Track>
        </div>
      </PageContainer>
    )
  }

  const renderDetail = (item: CancellationCase) => {
    const basis = basisFor(item)
    const result = calculateRefund(basis)
    const calcState = calc?.key === item.key ? calc : { key: item.key, monthsUsed: String(basis.monthsUsed), fee: formatCentsForInput(basis.cancellationFeeCents) }
    const feeInvalid = parseDollarsToCents(calcState.fee) == null
    const monthsInvalid = !/^\d{1,3}$/.test(calcState.monthsUsed.trim())
    const open = item.latest.status === 'requested'
    const dealRefunds = workspace?.refunds?.filter(refund => refund.transaction?.deal?.id === item.deal?.id) ?? null
    const dealPayments = workspace?.payments?.filter(payment => payment.deal?.id === item.deal?.id) ?? null
    const reference = item.latest.evidence?.evidenceReference
    return (
      <div className="min-w-0 space-y-6">
        <div className="space-y-3">
          <TitleLine as="h2" tone={stateTone(item.latest.status)} status={statusLabels[item.latest.status] || item.latest.status} className="text-lg font-semibold tracking-tight">
            {item.option?.name || item.productCode} · {personName(item.deal?.lead)}
          </TitleLine>
          <p className="flex flex-wrap gap-x-2 pl-4 text-xs text-muted-foreground">
            <Code>{item.productCode}</Code><span>·</span><span>{statusLabels[item.latest.status] || item.latest.status}</span><span>·</span>
            <span>{vehicleName(item.deal?.vehicle)}</span>
            {item.deal?.vehicle?.stockNumber && (<><span>·</span><Code>#{item.deal.vehicle.stockNumber}</Code></>)}
          </p>
          <Track aria-label="Cancellation actions">
            <Pill size="sm" variant="primary" disabled={!open || busy || !item.deal} title={!open ? `Already ${item.latest.status}` : undefined} onClick={() => openDecision('complete', item)}>Complete</Pill>
            <Pill size="sm" variant="danger" disabled={!open || busy || !item.deal} title={!open ? `Already ${item.latest.status}` : undefined} onClick={() => openDecision('deny', item)}>Deny</Pill>
            {item.deal && <Pill size="sm" asChild><Link href={`${basePath}/platform/deals/${item.deal.id}`}>Deal</Link></Pill>}
          </Track>
          {!open && <p className="pl-4 text-xs text-muted-foreground">{statusLabels[item.latest.status]} {formatDay(item.latest.completedAt || item.latest.createdAt, timeZone)}{reference ? ` · ${reference}` : ''}</p>}
        </div>

        <DeskSection title="Product">
          <Facts items={[
            { label: 'Retail price', value: formatCents(item.option?.retailPriceCents ?? null), mono: true },
            { label: 'Term', value: item.option?.termMonths ? `${item.option.termMonths} mo` : 'Not recorded' },
            { label: 'Sold', value: formatDay(saleDateOf(item), timeZone) },
            { label: 'Menu', value: `v${item.menu.version}` },
            item.deal?.rooftop ? { label: 'Rooftop', value: item.deal.rooftop.name } : null,
            { label: 'Refund recorded', value: formatCents(item.latest.refundCents ?? 0), mono: true },
          ]} />
        </DeskSection>

        <DeskSection title="Refund calculation">
          <div className="space-y-3">
            {open ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm">
                  <span className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">Months used</span>
                  <Input className="h-11" inputMode="numeric" value={calcState.monthsUsed} aria-invalid={monthsInvalid} onChange={event => setCalc({ ...calcState, monthsUsed: event.target.value })} />
                  {monthsInvalid && <span className="text-xs text-red-600 dark:text-red-400">Enter whole months.</span>}
                </label>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">Cancellation fee</span>
                  <Input className="h-11" inputMode="decimal" value={calcState.fee} aria-invalid={feeInvalid} onChange={event => setCalc({ ...calcState, fee: event.target.value })} />
                  {feeInvalid && <span className="text-xs text-red-600 dark:text-red-400">Enter a dollar amount.</span>}
                </label>
              </div>
            ) : null}
            <Facts items={[
              { label: 'Method', value: basis.method === 'pro-rata-months' ? 'Pro-rata by month' : 'Flat (no term)' },
              basis.method === 'pro-rata-months' ? { label: 'Unused months', value: `${result.unusedMonths} of ${basis.termMonths}`, mono: true } : null,
              { label: 'Unused value', value: formatCents(result.unusedCents), mono: true },
              { label: 'Fee', value: formatCents(basis.cancellationFeeCents), mono: true },
              { label: open ? 'Refund due' : 'Calculated refund', value: <span className="font-semibold">{formatCents(result.refundCents)}</span>, mono: true },
            ]} />
          </div>
        </DeskSection>

        <DeskSection title="Payment refund" count={dealRefunds?.length}>
          {dealRefunds == null ? (
            <p className="py-3 text-sm text-muted-foreground">Payments unavailable for your role</p>
          ) : dealRefunds.length > 0 ? (
            <ul className="divide-y text-sm">
              {dealRefunds.map(refund => (
                <li key={refund.id} className="flex min-w-0 items-center justify-between gap-4 py-2">
                  <div className="min-w-0">
                    <TitleLine as="p" tone={stateTone(refund.status)} status={refund.status}>{formatCents(refund.amountCents)} · {refund.status}</TitleLine>
                    <p className="truncate pl-4 text-xs text-muted-foreground">{refund.reason} · {formatDay(refund.createdAt, timeZone)}</p>
                  </div>
                  {refund.transaction && (
                    <Track className="shrink-0"><Pill size="sm" asChild><Link href={`${basePath}/platform/payments/${refund.transaction.id}`}>Open</Link></Pill></Track>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <div className="space-y-2 py-1">
              <p className="text-sm text-muted-foreground">No refund on this deal</p>
              {(dealPayments || []).filter(payment => ['captured', 'partially-refunded'].includes(payment.status)).map(payment => (
                <div key={payment.id} className="flex min-w-0 items-center justify-between gap-4 text-sm">
                  <span className="min-w-0 truncate">Payment {formatCents(payment.capturedCents ?? payment.amountCents)} · {payment.status}</span>
                  <Track className="shrink-0"><Pill size="sm" asChild><Link href={`${basePath}/platform/payments/${payment.id}`}>Payment</Link></Pill></Track>
                </div>
              ))}
            </div>
          )}
        </DeskSection>

        <DeskSection title="History" count={item.records.length}>
          <ul className="divide-y text-sm">
            {item.records.map(record => (
              <li key={record.id} className="flex min-w-0 items-start justify-between gap-4 py-2">
                <div className="min-w-0">
                  <TitleLine as="p" tone={stateTone(record.status)} status={record.status} className="font-medium">{statusLabels[record.status] || record.status}</TitleLine>
                  <p className="break-words pl-4 text-xs text-muted-foreground">{record.reason}{record.evidence?.evidenceReference ? ` · ${record.evidence.evidenceReference}` : ''}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-mono text-xs tabular-nums">{formatCents(record.refundCents ?? 0)}</p>
                  <p className="font-mono text-[11px] tabular-nums text-muted-foreground">{formatDateTime(record.createdAt, timeZone)}</p>
                </div>
              </li>
            ))}
          </ul>
        </DeskSection>
      </div>
    )
  }

  const filteredDeal = dealFilter ? cases.find(item => item.deal?.id === dealFilter)?.deal || cancellable.find(item => item.menu.deal?.id === dealFilter)?.menu.deal : null

  return (
    <PageContainer title="Product cancellations" header={header} breadcrumbs={breadcrumbs}>
      <div className="min-w-0 max-w-full space-y-6 px-4 pb-24 md:px-6">
        {notice && (
          <Notice tone="ok">
            <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-2">
              <p className="min-w-0">{notice}</p>
              <Track><Pill size="sm" variant="plain" onClick={() => setNotice(null)}>Dismiss</Pill></Track>
            </div>
          </Notice>
        )}
        {error && <Notice tone="bad">{error}</Notice>}

        <ReadoutStrip>
          <Readout label="Requested" value={counts.requested} tone={counts.requested ? 'warn' : 'idle'} />
          <Readout label="Completed" value={counts.completed} tone="ok" />
          <Readout label="Refunded" value={formatCents(refundedTotal)} sub="Completed cancellations" />
          <Readout label="Cancellable" value={cancellableForFilter.length} sub="Sold products" />
        </ReadoutStrip>

        <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
          <Segmented
            label="Cancellation status"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'requested', label: 'Requested', count: counts.requested, tone: 'warn' },
              { value: 'completed', label: 'Completed', count: counts.completed, tone: 'ok' },
              { value: 'denied', label: 'Denied', count: counts.denied, tone: 'bad' },
              { value: 'all', label: 'All', count: counts.all },
            ]}
          />
          <div className="relative min-w-0 flex-1 lg:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="h-11 rounded-full pl-9" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search customer, stock or product" aria-label="Search cancellations" />
          </div>
          {dealFilter && (
            <Track>
              <Pill size="sm" onClick={() => setDealFilter(null)} aria-label="Clear deal filter">
                {filteredDeal ? `${personName(filteredDeal.lead)} · ${vehicleName(filteredDeal.vehicle)}` : 'One deal'}
                <X />
              </Pill>
            </Track>
          )}
          {loading && <span className="text-sm text-muted-foreground" role="status">Refreshing…</span>}
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
          <DeskSection title="Cancellations" count={visible.length}>
            {visible.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center text-sm text-muted-foreground">
                <p>{scoped.length === 0 ? 'No cancellations' : 'No matching cancellations'}</p>
                <Track>
                  {scoped.length > 0 && <Pill size="sm" onClick={() => { setSearch(''); setTab('all') }}>Reset filters</Pill>}
                  {cancellableForFilter.length > 0 && <Pill size="sm" variant="primary" onClick={openNew}>New cancellation</Pill>}
                </Track>
              </div>
            ) : (
              <Panel className="divide-y overflow-hidden">
                {visible.map(item => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setSelectedKey(item.key)}
                    aria-pressed={selected?.key === item.key}
                    className={cn('flex min-h-11 w-full min-w-0 items-start justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring', selected?.key === item.key && 'bg-muted/60')}
                  >
                    <div className="min-w-0">
                      <TitleLine as="p" tone={stateTone(item.latest.status)} status={statusLabels[item.latest.status]} className="text-sm font-medium">
                        {personName(item.deal?.lead)} · {item.option?.name || item.productCode}
                      </TitleLine>
                      <p className="truncate pl-4 text-xs text-muted-foreground">
                        <Code>{item.productCode}</Code> · {statusLabels[item.latest.status] || item.latest.status} · {vehicleName(item.deal?.vehicle)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-medium tabular-nums">{formatCents(item.latest.refundCents ?? 0)}</p>
                      <p className="font-mono text-[11px] tabular-nums text-muted-foreground">{formatDay(item.latest.createdAt, timeZone)}</p>
                    </div>
                  </button>
                ))}
              </Panel>
            )}
          </DeskSection>
          <div className="min-w-0">{selected ? renderDetail(selected) : <p className="py-10 text-center text-sm text-muted-foreground">No cancellation selected</p>}</div>
        </div>

        <FinanceFormDialog
          open={Boolean(dialog)}
          title={dialog?.kind === 'new' ? 'New cancellation' : dialog?.kind === 'complete' ? `Complete ${dialog.item.productCode} cancellation` : `Deny ${dialog?.kind === 'deny' ? dialog.item.productCode : ''} cancellation`}
          fields={dialogFields}
          values={dialog?.values || {}}
          errors={fieldErrors}
          error={formError}
          busy={busy}
          submitLabel={dialog?.kind === 'new' ? 'Record request' : dialog?.kind === 'complete' ? 'Complete' : 'Deny'}
          onValuesChange={values => setDialog(current => current ? { ...current, values } as DialogState : current)}
          onSubmit={submit}
          onOpenChange={open => { if (!open && !busy) setDialog(null) }}
        />
      </div>
    </PageContainer>
  )
}
