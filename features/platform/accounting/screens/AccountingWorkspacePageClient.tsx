'use client'

import { useCallback, useMemo, useState } from 'react'
import { AlertTriangle, Circle, CreditCard, FileLock2, Landmark, RefreshCw, RotateCcw, Search, Square, Triangle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageContainer } from '@/features/dashboard/components/PageContainer'
import { basePath } from '@/features/dashboard/lib/config'
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

function Summary({ title, value, detail, icon: Icon }: { title: string; value: string; detail: string; icon: React.ElementType }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-3 p-4">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-1 text-2xl font-semibold">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
        </div>
        <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
      </CardContent>
    </Card>
  )
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

  const header = (
    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">Accounting</h1>
        <p className="text-muted-foreground">Export journal batches, reconcile payments and refunds, and close periods.</p>
      </div>
      <Button className="self-start" variant="outline" onClick={load} disabled={loading}>
        <RefreshCw className="mr-2 h-4 w-4" />
        Refresh
      </Button>
    </div>
  )

  return (
    <PageContainer title="Accounting" header={header} breadcrumbs={breadcrumbs}>
      <div className="min-w-0 space-y-6 px-4 pb-6 md:px-6">
        {message && (
          <div role="status" className="rounded-md border bg-muted/40 p-3 text-sm">
            {message}
          </div>
        )}
        {error ? (
          <Card>
            <CardContent className="py-12 text-center">
              <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-destructive" />
              <p className="font-medium">Accounting is unavailable</p>
              <p className="mt-1 text-sm text-muted-foreground">{error}</p>
              <Button className="mt-4" variant="outline" onClick={load}>
                Retry
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Summary
                title="Unposted batches"
                value={String(workspace.batches.filter(batch => !['posted', 'reconciled', 'locked'].includes(batch.status)).length)}
                detail="Staged or failed"
                icon={Landmark}
              />
              <Summary
                title="Captured"
                value={money(workspace.payments.reduce((total, item) => total + item.capturedCents, 0))}
                detail="Payments captured"
                icon={CreditCard}
              />
              <Summary
                title="Refunded"
                value={money(workspace.payments.reduce((total, item) => total + item.refundedCents, 0))}
                detail="Payments refunded"
                icon={RotateCcw}
              />
              <Summary title="Exceptions" value={String(exceptions)} detail="Posting or payment issues" icon={AlertTriangle} />
            </div>

            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <div className="relative min-w-0 flex-1 md:max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
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

            <Tabs defaultValue="batches">
              <TabsList className="max-w-full justify-start overflow-x-auto">
                <TabsTrigger value="batches">Posting queue</TabsTrigger>
                <TabsTrigger value="payments">Payments</TabsTrigger>
                <TabsTrigger value="mapping">Account mapping</TabsTrigger>
                <TabsTrigger value="stage">Stage export</TabsTrigger>
              </TabsList>

              <TabsContent value="batches" className="space-y-4">
                <Select value={batchFilter} onValueChange={setBatchFilter}>
                  <SelectTrigger className="w-full sm:w-[190px]" aria-label="Filter batches">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open work</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="posted">Posted</SelectItem>
                    <SelectItem value="reconciled">Reconciled</SelectItem>
                    <SelectItem value="locked">Locked</SelectItem>
                    <SelectItem value="all">All states</SelectItem>
                  </SelectContent>
                </Select>
                {batches.length === 0 ? (
                  batchesFiltered ? (
                    <EmptyStateSearch onResetFilters={resetFilters} />
                  ) : (
                    <EmptyStateDefault title="No batches" description="Accounting batches you stage will appear here." />
                  )
                ) : (
                  <div className="grid gap-3 xl:grid-cols-2">
                    {batches.map(batch => (
                      <Card key={batch.id} className="min-w-0">
                        <CardContent className="space-y-4 p-4">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <strong className="break-words">
                                {batch.sourceType} · {batch.rooftop.name}
                              </strong>
                              <p className="break-all font-mono text-xs text-muted-foreground">Source {batch.sourceId}</p>
                            </div>
                            <Badge variant="outline">{batch.status}</Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <p className="text-muted-foreground">Debit / credit</p>
                              <p className="font-medium">
                                {money(batch.totalDebitCents)} / {money(batch.totalCreditCents)}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Attempts / updated</p>
                              <p className="font-medium">
                                {batch.attemptCount} · {dateTime(batch.updatedAt)}
                              </p>
                            </div>
                            <div className="col-span-2">
                              <p className="text-muted-foreground">External reference</p>
                              <p className="break-all font-medium">
                                {batch.externalReference || 'None'}
                                {batch.lastErrorCode ? ` · error ${batch.lastErrorCode}` : ''}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {['staged', 'failed'].includes(batch.status) && (
                              <Button
                                size="sm"
                                disabled={busy === batch.id}
                                onClick={() =>
                                  run(
                                    batch.id,
                                    () => manageAccountingBatch({ batchId: batch.id, action: 'queue-post', idempotencyKey: nonce('accounting-queue') }),
                                    'Batch queued for posting.'
                                  )
                                }
                              >
                                Queue for posting
                              </Button>
                            )}
                            {batch.status === 'posted' && (
                              <Button size="sm" variant="outline" disabled={busy === batch.id} onClick={() => reconcile(batch)}>
                                Record reconciliation
                              </Button>
                            )}
                            {batch.status === 'reconciled' && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busy === batch.id}
                                onClick={() =>
                                  run(
                                    batch.id,
                                    () => manageAccountingBatch({ batchId: batch.id, action: 'lock', idempotencyKey: nonce('accounting-lock') }),
                                    'Batch locked.'
                                  )
                                }
                              >
                                <FileLock2 className="mr-1 h-4 w-4" />
                                Lock
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="payments" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Create checkout</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    <Select value={payment.sourceType} onValueChange={sourceType => setPayment(value => ({ ...value, sourceType }))}>
                      <SelectTrigger aria-label="Payment source">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="service">Service invoice</SelectItem>
                        <SelectItem value="deal">Deal balance</SelectItem>
                      </SelectContent>
                    </Select>
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
                    <Input
                      aria-label="Payment source ID"
                      placeholder="Source ID"
                      value={payment.sourceId}
                      onChange={event => setPayment(value => ({ ...value, sourceId: event.target.value }))}
                    />
                    <Input
                      aria-label="Payment amount in cents"
                      inputMode="numeric"
                      placeholder="Amount in cents"
                      value={payment.amountCents}
                      onChange={event => setPayment(value => ({ ...value, amountCents: event.target.value }))}
                    />
                    <Button
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
                    </Button>
                  </CardContent>
                </Card>
                <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                  <SelectTrigger className="w-full sm:w-[190px]" aria-label="Filter payments">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All payment states</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="captured">Captured</SelectItem>
                    <SelectItem value="partially-refunded">Partially refunded</SelectItem>
                    <SelectItem value="refunded">Refunded</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
                {payments.length === 0 ? (
                  paymentsFiltered ? (
                    <EmptyStateSearch onResetFilters={resetFilters} />
                  ) : (
                    <EmptyStateDefault title="No payments" description="Payments you collect will appear here." />
                  )
                ) : (
                  <div className="grid gap-3 xl:grid-cols-2">
                    {payments.map(item => (
                      <Card key={item.id}>
                        <CardContent className="space-y-4 p-4">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <strong>{money(item.amountCents)}</strong>
                              <p className="text-xs text-muted-foreground">
                                {item.sourceType} · {item.rooftop.name} · {item.providerKey}
                              </p>
                            </div>
                            <Badge variant="outline">{item.status}</Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <p className="text-muted-foreground">Captured</p>
                              <p className="font-medium">{money(item.capturedCents)}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Refunded</p>
                              <p className="font-medium">{money(item.refundedCents)}</p>
                            </div>
                            <div className="col-span-2">
                              <p className="text-muted-foreground">Reconciliation</p>
                              <p className="break-all font-medium">
                                {item.reconciliationReference || 'Not reconciled'} · updated {dateTime(item.updatedAt)}
                              </p>
                            </div>
                          </div>
                          {item.checkoutUrl && item.status === 'pending' && (
                            <Button asChild size="sm">
                              <a href={item.checkoutUrl} target="_blank" rel="noreferrer">
                                Open checkout
                              </a>
                            </Button>
                          )}
                          {['captured', 'partially-refunded'].includes(item.status) && (
                            <div className="grid gap-2 sm:grid-cols-3">
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
                              <Button
                                variant="outline"
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
                              </Button>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="mapping">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Account mapping</CardTitle>
                    <p className="text-sm text-muted-foreground">Account codes used for exports.</p>
                  </CardHeader>
                  <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    <Input
                      aria-label="Rooftop ID"
                      placeholder="Rooftop ID"
                      value={mapping.rooftopId}
                      onChange={event => setMapping(value => ({ ...value, rooftopId: event.target.value }))}
                    />
                    <Select value={mapping.sourceType} onValueChange={sourceType => setMapping(value => ({ ...value, sourceType }))}>
                      <SelectTrigger aria-label="Mapping source type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {['deal', 'service', 'parts', 'payment'].map(value => (
                          <SelectItem key={value} value={value}>
                            {value}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      aria-label="Source code"
                      placeholder="Source code"
                      value={mapping.sourceCode}
                      onChange={event => setMapping(value => ({ ...value, sourceCode: event.target.value }))}
                    />
                    <Input
                      aria-label="Debit account"
                      placeholder="Debit account"
                      value={mapping.debitAccount}
                      onChange={event => setMapping(value => ({ ...value, debitAccount: event.target.value }))}
                    />
                    <Input
                      aria-label="Credit account"
                      placeholder="Credit account"
                      value={mapping.creditAccount}
                      onChange={event => setMapping(value => ({ ...value, creditAccount: event.target.value }))}
                    />
                    <Button
                      disabled={busy === 'mapping' || !mapping.rooftopId || !mapping.debitAccount || !mapping.creditAccount}
                      onClick={() =>
                        run('mapping', () => configureAccountingMapping({ ...mapping, idempotencyKey: nonce('accounting-mapping') }), 'Mapping saved.')
                      }
                    >
                      Save mapping
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="stage">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Stage export</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-3 md:grid-cols-3">
                    <Select value={stage.sourceType} onValueChange={sourceType => setStage(value => ({ ...value, sourceType }))}>
                      <SelectTrigger aria-label="Export source type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {['deal', 'service', 'parts', 'payment'].map(value => (
                          <SelectItem key={value} value={value}>
                            {value}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      aria-label="Export source ID"
                      placeholder="Source ID"
                      value={stage.sourceId}
                      onChange={event => setStage(value => ({ ...value, sourceId: event.target.value }))}
                    />
                    <Button
                      disabled={busy === 'stage' || !stage.sourceId.trim()}
                      onClick={() => run('stage', () => stageAccountingBatch({ ...stage, idempotencyKey: nonce('accounting-stage') }), 'Batch staged.')}
                    >
                      Stage batch
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </PageContainer>
  )
}
