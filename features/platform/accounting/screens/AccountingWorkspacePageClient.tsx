'use client'

import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { FileLock2, RefreshCw, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageContainer } from '@/features/dashboard/components/PageContainer'
import { basePath } from '@/features/dashboard/lib/config'
import {
  Code,
  DeskHeader,
  DeskSection,
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
  type AccountingBatch,
  type AccountingWorkspace,
  type InstalledPaymentProvider,
  configureAccountingMapping,
  createPaymentCheckout,
  getAccountingWorkspace,
  manageAccountingBatch,
  requestPaymentRefund,
  stageAccountingBatch,
} from '../actions'

const EMPTY_WORKSPACE: AccountingWorkspace = { mappings: [], batches: [], payments: [], refunds: [] }

const money = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((cents || 0) / 100)
const nonce = (prefix: string) => `${prefix}:${crypto.randomUUID()}`
const dateTime = (value: string) => new Date(value).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

function firstRooftopId(workspace: AccountingWorkspace) {
  return workspace.mappings[0]?.rooftop.id || workspace.payments[0]?.rooftop.id || workspace.batches[0]?.rooftop.id || ''
}

const batchFilters = [
  { value: 'open', label: 'Open work' },
  { value: 'failed', label: 'Failed' },
  { value: 'posted', label: 'Posted' },
  { value: 'reconciled', label: 'Reconciled' },
  { value: 'locked', label: 'Locked' },
  { value: 'all', label: 'All' },
]

const paymentFilters = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'captured', label: 'Captured' },
  { value: 'partially-refunded', label: 'Partially refunded' },
  { value: 'refunded', label: 'Refunded' },
  { value: 'failed', label: 'Failed' },
]

const sourceTypes = ['deal', 'service', 'parts', 'payment']

function stateTone(status: string): DeskTone {
  if (['failed', 'cancelled', 'rejected'].includes(status)) return 'bad'
  if (['posting', 'creating', 'pending', 'staged', 'requested', 'partially-refunded'].includes(status)) return 'warn'
  if (['posted', 'captured', 'completed', 'succeeded'].includes(status)) return 'info'
  if (['reconciled', 'locked', 'refunded'].includes(status)) return 'ok'
  return 'idle'
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

function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={`grid min-w-0 gap-1.5 text-sm ${className || ''}`}>
      <span className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}

const LABEL = 'font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground'
const TH = 'px-4 py-2 font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground'
const NUM = 'px-4 py-2.5 text-right font-mono text-[13px] tabular-nums whitespace-nowrap'

export function AccountingWorkspacePageClient({
  initialWorkspace,
  initialError,
  paymentProviders,
}: {
  initialWorkspace: AccountingWorkspace | null
  initialError: string | null
  paymentProviders: InstalledPaymentProvider[]
}) {
  const [workspace, setWorkspace] = useState<AccountingWorkspace>(initialWorkspace ?? EMPTY_WORKSPACE)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(initialError)
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [batchFilter, setBatchFilter] = useState('open')
  const [paymentFilter, setPaymentFilter] = useState('all')
  const [mapping, setMapping] = useState({
    rooftopId: initialWorkspace ? firstRooftopId(initialWorkspace) : '',
    sourceType: 'payment',
    sourceCode: 'payment-capture',
    debitAccount: '',
    creditAccount: '',
    providerKey: 'operator-recorded',
  })
  const [stage, setStage] = useState({ sourceType: 'payment', sourceId: '', providerKey: 'operator-recorded' })
  const [payment, setPayment] = useState({ sourceType: 'service', sourceId: '', amountCents: '', providerKey: paymentProviders[0]?.code || '' })
  const [refund, setRefund] = useState({ transactionId: '', amountCents: '', reason: '' })
  const [view, setView] = useState<'batches' | 'payments' | 'mapping' | 'stage'>('batches')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const result = await getAccountingWorkspace()
    if (result.success && result.data) {
      setWorkspace(result.data.accountingWorkspace)
      const rooftopId = firstRooftopId(result.data.accountingWorkspace)
      if (rooftopId) setMapping(value => ({ ...value, rooftopId: value.rooftopId || rooftopId }))
    } else {
      setError(result.error || 'Unable to load accounting.')
    }
    setLoading(false)
  }, [])

  const run = async (key: string, command: () => Promise<{ success: boolean; error?: string }>, successMessage: string) => {
    setBusy(key)
    setMessage(null)
    const result = await command()
    setMessage(result.success ? successMessage : result.error || 'Command failed.')
    setBusy(null)
    if (result.success) await load()
  }

  const reconcile = async (batch: AccountingBatch) => {
    const reconciliationReference = window.prompt('Reconciliation reference')?.trim()
    if (!reconciliationReference) return
    await run(
      batch.id,
      () => manageAccountingBatch({ batchId: batch.id, action: 'reconcile', reconciliationReference, idempotencyKey: nonce('accounting-reconcile') }),
      'Batch reconciled.'
    )
  }

  const exceptions = useMemo(
    () =>
      workspace.batches.filter(batch => ['failed', 'posting'].includes(batch.status)).length +
      workspace.payments.filter(item => ['failed', 'creating'].includes(item.status)).length,
    [workspace]
  )
  const term = search.trim().toLowerCase()
  const batches = useMemo(
    () =>
      workspace.batches
        .filter(batch => {
          if (batchFilter === 'open' && ['posted', 'reconciled', 'locked'].includes(batch.status)) return false
          if (batchFilter !== 'all' && batchFilter !== 'open' && batch.status !== batchFilter) return false
          return !term || `${batch.sourceType} ${batch.sourceId} ${batch.rooftop.name} ${batch.externalReference || ''} ${batch.lastErrorCode || ''}`.toLowerCase().includes(term)
        })
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [workspace.batches, batchFilter, term]
  )
  const payments = useMemo(
    () =>
      workspace.payments
        .filter(
          item =>
            (paymentFilter === 'all' || item.status === paymentFilter) &&
            (!term || `${item.sourceType} ${item.id} ${item.rooftop.name} ${item.providerKey} ${item.reconciliationReference || ''}`.toLowerCase().includes(term))
        )
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [workspace.payments, paymentFilter, term]
  )

  const batchesFiltered = Boolean(term) || batchFilter !== 'open'
  const paymentsFiltered = Boolean(term) || paymentFilter !== 'all'
  const resetFilters = () => {
    setSearch('')
    setBatchFilter('open')
    setPaymentFilter('all')
  }

  const breadcrumbs = [
    { type: 'link' as const, label: 'Dashboard', href: basePath },
    { type: 'page' as const, label: 'Platform' },
    { type: 'page' as const, label: 'Accounting' },
  ]

  const unposted = workspace.batches.filter(batch => !['posted', 'reconciled', 'locked'].includes(batch.status)).length
  const captured = workspace.payments.reduce((total, item) => total + item.capturedCents, 0)
  const refunded = workspace.payments.reduce((total, item) => total + item.refundedCents, 0)
  const exceptionBatches = workspace.batches.filter(batch => ['failed', 'posting'].includes(batch.status))
  const exceptionPayments = workspace.payments.filter(item => ['failed', 'creating'].includes(item.status))

  const batchSearchMatches = workspace.batches.filter(
    batch => !term || `${batch.sourceType} ${batch.sourceId} ${batch.rooftop.name} ${batch.externalReference || ''} ${batch.lastErrorCode || ''}`.toLowerCase().includes(term)
  )
  const batchCounts: Record<string, number> = {
    open: batchSearchMatches.filter(batch => !['posted', 'reconciled', 'locked'].includes(batch.status)).length,
    all: batchSearchMatches.length,
  }
  for (const option of ['failed', 'posted', 'reconciled', 'locked']) batchCounts[option] = batchSearchMatches.filter(batch => batch.status === option).length

  const paymentSearchMatches = workspace.payments.filter(
    item => !term || `${item.sourceType} ${item.id} ${item.rooftop.name} ${item.providerKey} ${item.reconciliationReference || ''}`.toLowerCase().includes(term)
  )
  const paymentCounts: Record<string, number> = { all: paymentSearchMatches.length }
  for (const option of paymentFilters) if (option.value !== 'all') paymentCounts[option.value] = paymentSearchMatches.filter(item => item.status === option.value).length

  const shownDebit = batches.reduce((total, batch) => total + batch.totalDebitCents, 0)
  const shownCredit = batches.reduce((total, batch) => total + batch.totalCreditCents, 0)

  const queuePost = (batch: AccountingBatch) =>
    run(
      batch.id,
      () => manageAccountingBatch({ batchId: batch.id, action: 'queue-post', idempotencyKey: nonce('accounting-queue') }),
      'Batch queued for posting.'
    )

  const batchActions = (batch: AccountingBatch) =>
    ['staged', 'failed', 'posted', 'reconciled'].includes(batch.status) ? (
      <Track>
        {['staged', 'failed'].includes(batch.status) && (
          <Pill size="sm" variant="primary" disabled={busy === batch.id} onClick={() => queuePost(batch)}>
            Queue for posting
          </Pill>
        )}
        {batch.status === 'posted' && (
          <Pill size="sm" disabled={busy === batch.id} onClick={() => reconcile(batch)}>
            Record reconciliation
          </Pill>
        )}
        {batch.status === 'reconciled' && (
          <Pill
            size="sm"
            disabled={busy === batch.id}
            onClick={() =>
              run(
                batch.id,
                () => manageAccountingBatch({ batchId: batch.id, action: 'lock', idempotencyKey: nonce('accounting-lock') }),
                'Batch locked.'
              )
            }
          >
            <FileLock2 />
            Lock
          </Pill>
        )}
      </Track>
    ) : null

  const header = (
    <DeskHeader
      title="Accounting"
      tone={error ? 'bad' : exceptions > 0 ? 'warn' : 'ok'}
      status={error ? 'Unavailable' : exceptions > 0 ? `${exceptions} exceptions` : 'No exceptions'}
      meta={error ? 'Unavailable' : `${unposted} unposted · ${workspace.payments.length} payments · ${workspace.mappings.length} mappings`}
      actions={
        <Track>
          <Pill onClick={load} disabled={loading} aria-label="Refresh">
            <RefreshCw className={loading ? 'animate-spin' : undefined} />
            Refresh
          </Pill>
        </Track>
      }
    />
  )

  return (
    <PageContainer title="Accounting" header={header} breadcrumbs={breadcrumbs}>
      <div className="min-w-0 max-w-full space-y-8 px-4 pb-24 md:px-6">
        {message && (
          <Notice tone="info">
            <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-2">
              <p className="min-w-0">{message}</p>
              <Track>
                <Pill size="sm" variant="plain" onClick={() => setMessage(null)}>Dismiss</Pill>
              </Track>
            </div>
          </Notice>
        )}
        {error ? (
          <div className="space-y-3">
            <Notice tone="bad">
              <p className="font-medium">Accounting is unavailable</p>
              <p className="mt-0.5 text-muted-foreground">{error}</p>
            </Notice>
            <Track>
              <Pill onClick={load}>Retry</Pill>
            </Track>
          </div>
        ) : (
          <>
            <ReadoutStrip>
              <Readout
                label="Exceptions"
                value={exceptions}
                tone={exceptions > 0 ? 'bad' : 'ok'}
                sub={`${exceptionBatches.length} posting · ${exceptionPayments.length} payment`}
              />
              <Readout label="Unposted batches" value={unposted} tone={unposted > 0 ? 'warn' : 'idle'} sub="Staged or failed" />
              <Readout label="Captured" value={money(captured)} />
              <Readout label="Refunded" value={money(refunded)} sub={`${workspace.refunds.length} refunds`} />
            </ReadoutStrip>

            <DeskSection title="Exceptions" count={exceptions}>
              {exceptions === 0 ? (
                <p className="py-3 text-sm text-muted-foreground">No exceptions</p>
              ) : (
                <Panel className="divide-y">
                  {exceptionBatches.map(batch => (
                    <div key={batch.id} className="flex min-w-0 flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <TitleLine as="p" tone={stateTone(batch.status)} status={batch.status} className="text-sm font-medium">
                          Batch · {batch.sourceType} · {batch.rooftop.name}
                        </TitleLine>
                        <p className="break-all pl-4 text-xs text-muted-foreground">
                          {batch.status} · <Code>{batch.sourceId}</Code> · {batch.attemptCount} attempts
                          {batch.lastErrorCode ? ` · error ${batch.lastErrorCode}` : ''} · {dateTime(batch.updatedAt)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3 pl-4 sm:pl-0">
                        <span className="font-mono text-[13px] tabular-nums">{money(batch.totalDebitCents)}</span>
                        {batchActions(batch)}
                      </div>
                    </div>
                  ))}
                  {exceptionPayments.map(item => (
                    <div key={item.id} className="flex min-w-0 items-start justify-between gap-4 px-4 py-3">
                      <div className="min-w-0">
                        <TitleLine as="p" tone={stateTone(item.status)} status={item.status} className="text-sm font-medium">
                          Payment · {item.sourceType} · {item.rooftop.name}
                        </TitleLine>
                        <p className="break-all pl-4 text-xs text-muted-foreground">
                          {item.status} · {item.providerKey} · <Code>{item.id}</Code> · {dateTime(item.updatedAt)}
                        </p>
                      </div>
                      <span className="shrink-0 font-mono text-[13px] tabular-nums">{money(item.amountCents)}</span>
                    </div>
                  ))}
                </Panel>
              )}
            </DeskSection>

            <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-center">
              <Segmented
                label="Accounting view"
                value={view}
                onChange={setView}
                options={[
                  { value: 'batches', label: 'Posting queue', count: workspace.batches.length },
                  { value: 'payments', label: 'Payments', count: workspace.payments.length },
                  { value: 'mapping', label: 'Account mapping', count: workspace.mappings.length },
                  { value: 'stage', label: 'Stage export' },
                ]}
              />
              <div className="relative min-w-0 flex-1 md:max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="rounded-full pl-9"
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                  placeholder="Search source, rooftop, provider, or reference"
                  aria-label="Search accounting"
                />
              </div>
              {loading && (
                <span className="text-sm text-muted-foreground" role="status">
                  Refreshing…
                </span>
              )}
            </div>

            {view === 'batches' && (
              <DeskSection
                title="Posting queue"
                count={batches.length}
                actions={
                  <Segmented
                    label="Filter batches"
                    size="sm"
                    value={batchFilter}
                    onChange={setBatchFilter}
                    options={batchFilters.map(option => ({ ...option, count: batchCounts[option.value] }))}
                  />
                }
              >
                {batches.length === 0 ? (
                  batchesFiltered ? <Empty label="No matching batches" onReset={resetFilters} /> : <Empty label="No batches" />
                ) : (
                  <Panel className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-sm">
                      <thead className="border-b">
                        <tr className="text-left">
                          <th className={TH}>Source</th>
                          <th className={TH}>Reference</th>
                          <th className={`${TH} text-right`}>Attempts</th>
                          <th className={`${TH} text-right`}>Debit</th>
                          <th className={`${TH} text-right`}>Credit</th>
                          <th className={`${TH} text-right`}>
                            <span className="sr-only">Actions</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {batches.map(batch => (
                          <tr key={batch.id} className="align-top hover:bg-muted/30">
                            <td className="max-w-[18rem] px-4 py-2.5">
                              <TitleLine as="p" tone={stateTone(batch.status)} status={batch.status} className="font-medium">
                                {batch.sourceType} · {batch.rooftop.name}
                              </TitleLine>
                              <p className="break-all pl-4 text-xs text-muted-foreground">
                                {batch.status} · <Code>{batch.sourceId}</Code>
                              </p>
                            </td>
                            <td className="px-4 py-2.5 text-xs">
                              <p className="break-all">{batch.externalReference || 'None'}</p>
                              {batch.lastErrorCode && <p className="text-red-600 dark:text-red-400">error {batch.lastErrorCode}</p>}
                              <p className="text-muted-foreground">{dateTime(batch.updatedAt)}</p>
                            </td>
                            <td className={NUM}>{batch.attemptCount}</td>
                            <td className={NUM}>{money(batch.totalDebitCents)}</td>
                            <td className={NUM}>{money(batch.totalCreditCents)}</td>
                            <td className="px-4 py-2 text-right">{batchActions(batch)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="border-t border-foreground/20">
                        <tr>
                          <td className="px-4 py-2.5 font-semibold" colSpan={3}>
                            Total
                          </td>
                          <td className={`${NUM} font-semibold`}>{money(shownDebit)}</td>
                          <td className={`${NUM} font-semibold`}>{money(shownCredit)}</td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </Panel>
                )}
              </DeskSection>
            )}

            {view === 'payments' && (
              <div className="space-y-8">
                <DeskSection title="Create checkout">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[repeat(4,minmax(0,1fr))_auto] xl:items-end">
                    <Field label="Source">
                      <Select value={payment.sourceType} onValueChange={sourceType => setPayment(value => ({ ...value, sourceType }))}>
                        <SelectTrigger aria-label="Payment source">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="service">Service invoice</SelectItem>
                          <SelectItem value="deal">Deal balance</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Provider">
                      <Select value={payment.providerKey} onValueChange={providerKey => setPayment(value => ({ ...value, providerKey }))}>
                        <SelectTrigger aria-label="Payment provider">
                          <SelectValue placeholder="No payment providers installed" />
                        </SelectTrigger>
                        <SelectContent>
                          {paymentProviders.map(provider => (
                            <SelectItem key={provider.code} value={provider.code}>
                              {provider.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Source ID">
                      <Input
                        aria-label="Payment source ID"
                        placeholder="Source ID"
                        value={payment.sourceId}
                        onChange={event => setPayment(value => ({ ...value, sourceId: event.target.value }))}
                      />
                    </Field>
                    <Field label="Amount (cents)">
                      <Input
                        aria-label="Payment amount in cents"
                        inputMode="numeric"
                        placeholder="Amount in cents"
                        value={payment.amountCents}
                        onChange={event => setPayment(value => ({ ...value, amountCents: event.target.value }))}
                      />
                    </Field>
                    <Track className="self-end">
                      <Pill
                        variant="primary"
                        disabled={busy === 'checkout' || !payment.providerKey || !payment.sourceId.trim() || !Number.isInteger(Number(payment.amountCents)) || Number(payment.amountCents) <= 0}
                        onClick={() =>
                          run(
                            'checkout',
                            () => createPaymentCheckout({ ...payment, amountCents: Number(payment.amountCents), idempotencyKey: nonce('payment-checkout') }),
                            'Checkout created.'
                          )
                        }
                      >
                        Create checkout
                      </Pill>
                    </Track>
                  </div>
                </DeskSection>

                <DeskSection
                  title="Payments"
                  count={payments.length}
                  actions={
                    <Segmented
                      label="Filter payments"
                      size="sm"
                      value={paymentFilter}
                      onChange={setPaymentFilter}
                      options={paymentFilters.map(option => ({ ...option, count: paymentCounts[option.value] }))}
                    />
                  }
                >
                  {payments.length === 0 ? (
                    paymentsFiltered ? <Empty label="No matching payments" onReset={resetFilters} /> : <Empty label="No payments" />
                  ) : (
                    <Panel className="divide-y">
                      <div className="hidden grid-cols-[minmax(0,1fr)_7rem_7rem_7rem] gap-4 px-4 py-2 sm:grid">
                        <span className={LABEL}>Payment</span>
                        <span className={`${LABEL} text-right`}>Amount</span>
                        <span className={`${LABEL} text-right`}>Captured</span>
                        <span className={`${LABEL} text-right`}>Refunded</span>
                      </div>
                      {payments.map(item => (
                        <div key={item.id} className="min-w-0 space-y-2.5 px-4 py-3">
                          <div className="grid min-w-0 grid-cols-3 gap-x-4 gap-y-1 sm:grid-cols-[minmax(0,1fr)_7rem_7rem_7rem]">
                            <div className="col-span-3 min-w-0 sm:col-span-1">
                              <TitleLine as="p" tone={stateTone(item.status)} status={item.status} className="text-sm font-medium">
                                {item.sourceType} · {item.rooftop.name}
                              </TitleLine>
                              <p className="break-all pl-4 text-xs text-muted-foreground">
                                {item.status} · {item.providerKey}
                                {item.serviceOrder?.invoiceNumber ? ` · Invoice ${item.serviceOrder.invoiceNumber}` : ''}
                              </p>
                              <p className="break-all pl-4 text-xs text-muted-foreground">
                                {item.reconciliationReference || 'Not reconciled'} · updated {dateTime(item.updatedAt)}
                              </p>
                            </div>
                            {[
                              ['Amount', item.amountCents],
                              ['Captured', item.capturedCents],
                              ['Refunded', item.refundedCents],
                            ].map(([label, cents]) => (
                              <div key={label as string} className="text-right">
                                <p className="text-[11px] text-muted-foreground sm:hidden">{label}</p>
                                <p className="font-mono text-[13px] tabular-nums">{money(cents as number)}</p>
                              </div>
                            ))}
                          </div>
                          {item.checkoutUrl && item.status === 'pending' && (
                            <Track className="ml-4">
                              <Pill size="sm" variant="primary" asChild>
                                <a href={item.checkoutUrl} target="_blank" rel="noreferrer">
                                  Open checkout
                                </a>
                              </Pill>
                            </Track>
                          )}
                          {['captured', 'partially-refunded'].includes(item.status) && (
                            <div className="grid gap-2 pl-4 sm:grid-cols-[8rem_minmax(0,1fr)_auto]">
                              <Input
                                aria-label={`Refund amount in cents for ${item.id}`}
                                placeholder="Refund cents"
                                value={refund.transactionId === item.id ? refund.amountCents : ''}
                                onChange={event => setRefund(value => ({ ...value, transactionId: item.id, amountCents: event.target.value }))}
                              />
                              <Input
                                aria-label={`Refund reason for ${item.id}`}
                                placeholder="Refund reason"
                                value={refund.transactionId === item.id ? refund.reason : ''}
                                onChange={event => setRefund(value => ({ ...value, transactionId: item.id, reason: event.target.value }))}
                              />
                              <Track className="self-start">
                                <Pill
                                  size="sm"
                                  disabled={busy === `refund-${item.id}` || refund.transactionId !== item.id || !refund.reason.trim() || Number(refund.amountCents) <= 0}
                                  onClick={() =>
                                    run(
                                      `refund-${item.id}`,
                                      () =>
                                        requestPaymentRefund({
                                          ...refund,
                                          transactionId: item.id,
                                          amountCents: Number(refund.amountCents),
                                          idempotencyKey: nonce('payment-refund'),
                                        }),
                                      'Refund requested.'
                                    )
                                  }
                                >
                                  Request refund
                                </Pill>
                              </Track>
                            </div>
                          )}
                        </div>
                      ))}
                    </Panel>
                  )}
                </DeskSection>

                <DeskSection title="Refunds" count={workspace.refunds.length}>
                  {workspace.refunds.length === 0 ? (
                    <p className="py-3 text-sm text-muted-foreground">No refunds</p>
                  ) : (
                    <Panel className="divide-y">
                      {workspace.refunds.map(item => (
                        <div key={item.id} className="flex min-w-0 items-start justify-between gap-4 px-4 py-3">
                          <div className="min-w-0">
                            <TitleLine as="p" tone={stateTone(item.status)} status={item.status} className="text-sm font-medium">
                              {item.reason}
                            </TitleLine>
                            <p className="break-all pl-4 text-xs text-muted-foreground">
                              {item.status} · <Code>{item.transaction.id}</Code>
                              {item.providerRefundId ? ` · ${item.providerRefundId}` : ''} · {dateTime(item.updatedAt)}
                            </p>
                          </div>
                          <span className="shrink-0 font-mono text-[13px] tabular-nums">{money(item.amountCents)}</span>
                        </div>
                      ))}
                    </Panel>
                  )}
                </DeskSection>
              </div>
            )}

            {view === 'mapping' && (
              <div className="space-y-8">
                <DeskSection title="Account mapping">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    <Field label="Rooftop ID">
                      <Input
                        aria-label="Rooftop ID"
                        placeholder="Rooftop ID"
                        value={mapping.rooftopId}
                        onChange={event => setMapping(value => ({ ...value, rooftopId: event.target.value }))}
                      />
                    </Field>
                    <Field label="Source type">
                      <Select value={mapping.sourceType} onValueChange={sourceType => setMapping(value => ({ ...value, sourceType }))}>
                        <SelectTrigger aria-label="Mapping source type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {sourceTypes.map(value => (
                            <SelectItem key={value} value={value}>
                              {value}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Source code">
                      <Input
                        aria-label="Source code"
                        placeholder="Source code"
                        value={mapping.sourceCode}
                        onChange={event => setMapping(value => ({ ...value, sourceCode: event.target.value }))}
                      />
                    </Field>
                    <Field label="Debit account">
                      <Input
                        aria-label="Debit account"
                        placeholder="Debit account"
                        value={mapping.debitAccount}
                        onChange={event => setMapping(value => ({ ...value, debitAccount: event.target.value }))}
                      />
                    </Field>
                    <Field label="Credit account">
                      <Input
                        aria-label="Credit account"
                        placeholder="Credit account"
                        value={mapping.creditAccount}
                        onChange={event => setMapping(value => ({ ...value, creditAccount: event.target.value }))}
                      />
                    </Field>
                    <Track className="self-end">
                      <Pill
                        variant="primary"
                        disabled={busy === 'mapping' || !mapping.rooftopId || !mapping.debitAccount || !mapping.creditAccount}
                        onClick={() =>
                          run('mapping', () => configureAccountingMapping({ ...mapping, idempotencyKey: nonce('accounting-mapping') }), 'Mapping saved.')
                        }
                      >
                        Save mapping
                      </Pill>
                    </Track>
                  </div>
                </DeskSection>

                <DeskSection title="Mappings" count={workspace.mappings.length}>
                  {workspace.mappings.length === 0 ? (
                    <p className="py-3 text-sm text-muted-foreground">No mappings</p>
                  ) : (
                    <Panel className="overflow-x-auto">
                      <table className="w-full min-w-[600px] text-sm">
                        <thead className="border-b">
                          <tr className="text-left">
                            <th className={TH}>Source</th>
                            <th className={TH}>Rooftop</th>
                            <th className={`${TH} text-right`}>Debit</th>
                            <th className={`${TH} text-right`}>Credit</th>
                            <th className={TH}>Provider</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {workspace.mappings.map(item => (
                            <tr key={item.id} className="hover:bg-muted/30">
                              <td className="px-4 py-2.5">
                                <p className="font-medium">{item.sourceType}</p>
                                <Code>{item.sourceCode}</Code>
                              </td>
                              <td className="px-4 py-2.5 text-muted-foreground">{item.rooftop.name}</td>
                              <td className={NUM}>{item.debitAccount}</td>
                              <td className={NUM}>{item.creditAccount}</td>
                              <td className="px-4 py-2.5 text-xs text-muted-foreground">{item.providerKey}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </Panel>
                  )}
                </DeskSection>
              </div>
            )}

            {view === 'stage' && (
              <DeskSection title="Stage export">
                <div className="grid gap-3 sm:grid-cols-[12rem_minmax(0,1fr)_auto] sm:items-end">
                  <Field label="Source type">
                    <Select value={stage.sourceType} onValueChange={sourceType => setStage(value => ({ ...value, sourceType }))}>
                      <SelectTrigger aria-label="Export source type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {sourceTypes.map(value => (
                          <SelectItem key={value} value={value}>
                            {value}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Source ID">
                    <Input
                      aria-label="Export source ID"
                      placeholder="Source ID"
                      value={stage.sourceId}
                      onChange={event => setStage(value => ({ ...value, sourceId: event.target.value }))}
                    />
                  </Field>
                  <Track className="self-end">
                    <Pill
                      variant="primary"
                      disabled={busy === 'stage' || !stage.sourceId.trim()}
                      onClick={() => run('stage', () => stageAccountingBatch({ ...stage, idempotencyKey: nonce('accounting-stage') }), 'Batch staged.')}
                    >
                      Stage batch
                    </Pill>
                  </Track>
                </div>
              </DeskSection>
            )}
          </>
        )}
      </div>
    </PageContainer>
  )
}
