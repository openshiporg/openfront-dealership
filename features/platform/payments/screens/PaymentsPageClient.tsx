'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronRight, Pencil, Plus, Power, RefreshCw, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageContainer } from '@/features/dashboard/components/PageContainer'
import { basePath } from '@/features/dashboard/lib/config'
import { Code, DeskHeader, Notice, Panel, Pill, Readout, ReadoutStrip, Segmented, TitleLine, Track } from '@/features/platform/components/desk'
import { recordReference } from '@/features/platform/lib/format'
import { parseDollarsToCents } from '@/features/platform/deals/lib/moneyInput'
import { CommandDialog, type CommandField, type FieldErrors } from '@/features/platform/accounting/components/CommandDialog'
import { PAYMENT_STATUS_LABEL, dateTime, money, nonce, paymentTone } from '@/features/platform/accounting/lib/format'

import {
  createPaymentCheckout,
  createPaymentProvider,
  getCheckoutSources,
  getPaymentProviders,
  getPayments,
  updatePaymentProvider,
} from '../actions'
import { BUILT_IN_ADAPTERS, paymentSource, providerAdapter } from '../lib/format'
import type { CheckoutSourceOption, PaymentCounts, PaymentListItem, PaymentProviderRecord } from '../lib/types'

type View = 'transactions' | 'providers'
type ProviderForm = { provider: PaymentProviderRecord | null; values: Record<string, string> }

const STATUS_TABS = ['pending', 'captured', 'partially-refunded', 'refunded', 'failed', 'canceled'] as const
const RARE_TABS = ['creating', 'authorized'] as const

export function PaymentsPageClient({
  timeZone,
  initialTransactions,
  initialCounts,
  initialError,
  initialProviders,
  initialProviderError,
}: {
  timeZone: string
  initialTransactions: PaymentListItem[]
  initialCounts: PaymentCounts | null
  initialError: string | null
  initialProviders: PaymentProviderRecord[]
  initialProviderError: string | null
}) {
  const router = useRouter()
  const [view, setView] = useState<View>('transactions')
  const [message, setMessage] = useState<string | null>(null)

  const [transactions, setTransactions] = useState(initialTransactions)
  const [counts, setCounts] = useState<PaymentCounts>(initialCounts ?? { all: 0 })
  const [error, setError] = useState(initialError)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('all')
  const [provider, setProvider] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [search, setSearch] = useState('')
  const firstLoad = useRef(true)

  const dateError = from && to && from > to ? 'Start date is after end date' : null

  const loadTransactions = useCallback(
    async (filters: { status: string; provider: string; from: string; to: string; search: string }) => {
      setLoading(true)
      const result = await getPayments(filters, timeZone)
      if (result.success) {
        setTransactions(result.data.transactions)
        setCounts(result.data.counts)
        setError(null)
      } else {
        setError(result.error)
      }
      setLoading(false)
    },
    [timeZone],
  )

  useEffect(() => {
    if (firstLoad.current) {
      firstLoad.current = false
      return
    }
    if (dateError) return
    const timer = setTimeout(() => loadTransactions({ status, provider, from, to, search }), search ? 250 : 0)
    return () => clearTimeout(timer)
  }, [status, provider, from, to, search, dateError, loadTransactions])

  // Providers
  const [providers, setProviders] = useState(initialProviders)
  const [providerError, setProviderError] = useState(initialProviderError)
  const [providerForm, setProviderForm] = useState<ProviderForm | null>(null)
  const [providerFieldErrors, setProviderFieldErrors] = useState<FieldErrors>({})
  const [providerSubmitError, setProviderSubmitError] = useState<string | null>(null)
  const [providerBusy, setProviderBusy] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)

  const loadProviders = useCallback(async () => {
    const result = await getPaymentProviders()
    if (result.success) {
      setProviders(result.data.paymentProviders || [])
      setProviderError(null)
    } else {
      setProviderError(result.error)
    }
  }, [])

  const openProvider = (record: PaymentProviderRecord | null) => {
    const adapter = record ? providerAdapter(record) : 'manual'
    const builtIn = adapter && (BUILT_IN_ADAPTERS as readonly string[]).includes(adapter)
    setProviderForm({
      provider: record,
      values: {
        name: record?.name || '',
        code: record?.code || 'pp_',
        adapter: adapter === null ? 'mixed' : builtIn ? adapter : 'custom',
        adapterUrl: adapter && !builtIn ? adapter : '',
        isInstalled: record ? (record.isInstalled ? 'yes' : 'no') : 'yes',
      },
    })
    setProviderFieldErrors({})
    setProviderSubmitError(null)
  }

  const submitProvider = async () => {
    if (!providerForm) return
    const values = providerForm.values
    const errors: FieldErrors = {}
    const name = (values.name || '').trim()
    const code = (values.code || '').trim()
    if (!name) errors.name = 'Name is required'
    if (!providerForm.provider) {
      if (!/^pp_[a-zA-Z0-9-_]+$/.test(code)) errors.code = 'Starts with pp_ then letters, numbers, - or _'
      else if (providers.some(p => p.code === code)) errors.code = 'Code is already used'
    }
    const url = (values.adapterUrl || '').trim()
    if (values.adapter === 'custom' && !/^https:\/\/\S+$/.test(url)) errors.adapterUrl = 'Enter an https:// adapter URL'
    setProviderFieldErrors(errors)
    if (Object.keys(errors).length) return
    const adapter = values.adapter === 'custom' ? url : values.adapter === 'mixed' ? undefined : values.adapter
    setProviderBusy(true)
    setProviderSubmitError(null)
    const result = providerForm.provider
      ? await updatePaymentProvider(providerForm.provider.id, { name, isInstalled: values.isInstalled === 'yes', ...(adapter ? { adapter } : {}) })
      : await createPaymentProvider({ name, code, adapter: adapter || 'manual', isInstalled: values.isInstalled === 'yes' })
    setProviderBusy(false)
    if (!result.success) {
      setProviderSubmitError(result.error)
      return
    }
    setMessage(providerForm.provider ? 'Provider updated.' : 'Provider added.')
    setProviderForm(null)
    await loadProviders()
  }

  const toggleProvider = async (record: PaymentProviderRecord) => {
    setToggling(record.id)
    const result = await updatePaymentProvider(record.id, { isInstalled: !record.isInstalled })
    setToggling(null)
    setMessage(result.success ? (record.isInstalled ? `${record.name} disabled.` : `${record.name} enabled.`) : result.error)
    if (result.success) await loadProviders()
  }

  const providerFields: CommandField[] = providerForm
    ? [
        { name: 'name', label: 'Name', maxLength: 100 },
        { name: 'code', label: 'Code', maxLength: 100, disabled: Boolean(providerForm.provider) },
        {
          name: 'adapter',
          label: 'Adapter',
          type: 'select',
          options: [
            { value: 'manual', label: 'Manual' },
            { value: 'stripe', label: 'Stripe' },
            { value: 'custom', label: 'HTTP adapter' },
            ...(providerForm.values.adapter === 'mixed' ? [{ value: 'mixed', label: 'Per-function (unchanged)' }] : []),
          ],
        },
        { name: 'isInstalled', label: 'Status', type: 'select', options: [{ value: 'yes', label: 'Enabled' }, { value: 'no', label: 'Disabled' }] },
        ...(providerForm.values.adapter === 'custom' ? [{ name: 'adapterUrl', label: 'Adapter URL', wide: true, maxLength: 500, placeholder: 'https://' } as CommandField] : []),
      ]
    : []

  // Checkout
  const installed = providers.filter(p => p.isInstalled)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [checkoutValues, setCheckoutValues] = useState<Record<string, string>>({})
  const [checkoutOptions, setCheckoutOptions] = useState<CheckoutSourceOption[]>([])
  const [checkoutOptionsState, setCheckoutOptionsState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [checkoutFieldErrors, setCheckoutFieldErrors] = useState<FieldErrors>({})
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [checkoutBusy, setCheckoutBusy] = useState(false)

  const loadCheckoutOptions = useCallback(async (type: string) => {
    setCheckoutOptionsState('loading')
    setCheckoutOptions([])
    const result = await getCheckoutSources(type)
    if (result.success) {
      setCheckoutOptions(result.data)
      setCheckoutOptionsState('idle')
    } else {
      setCheckoutOptionsState('error')
    }
  }, [])

  const openCheckout = () => {
    setCheckoutValues({ sourceType: 'service', sourceId: '', providerKey: installed[0]?.code || '', amount: '' })
    setCheckoutFieldErrors({})
    setCheckoutError(null)
    setCheckoutOpen(true)
    loadCheckoutOptions('service')
  }

  const changeCheckout = (values: Record<string, string>) => {
    if (values.sourceType !== checkoutValues.sourceType) {
      setCheckoutValues({ ...values, sourceId: '', amount: '' })
      loadCheckoutOptions(values.sourceType)
    } else if (values.sourceId !== checkoutValues.sourceId && !values.amount) {
      const option = checkoutOptions.find(o => o.id === values.sourceId)
      setCheckoutValues({ ...values, amount: option?.totalCents ? (option.totalCents / 100).toFixed(2) : '' })
    } else {
      setCheckoutValues(values)
    }
    setCheckoutFieldErrors({})
  }

  const submitCheckout = async () => {
    const errors: FieldErrors = {}
    if (!checkoutValues.sourceId) errors.sourceId = 'Choose a source record'
    if (!checkoutValues.providerKey) errors.providerKey = 'Choose a provider'
    const cents = parseDollarsToCents(checkoutValues.amount || '')
    if (cents === null) errors.amount = 'Enter dollars and cents'
    else if (cents <= 0) errors.amount = 'Amount must be more than $0'
    setCheckoutFieldErrors(errors)
    if (Object.keys(errors).length || !cents) return
    setCheckoutBusy(true)
    setCheckoutError(null)
    const result = await createPaymentCheckout({
      sourceType: checkoutValues.sourceType,
      sourceId: checkoutValues.sourceId,
      providerKey: checkoutValues.providerKey,
      amountCents: cents,
      idempotencyKey: nonce('payment-checkout'),
    })
    setCheckoutBusy(false)
    if (!result.success) {
      setCheckoutError(result.error)
      return
    }
    setCheckoutOpen(false)
    router.push(`${basePath}/platform/payments/${result.data.createPaymentCheckout.id}`)
  }

  const checkoutFields: CommandField[] = [
    { name: 'sourceType', label: 'Source type', type: 'select', options: [{ value: 'service', label: 'Service order' }, { value: 'deal', label: 'Deal' }] },
    { name: 'providerKey', label: 'Provider', type: 'select', options: installed.map(p => ({ value: p.code, label: p.name })), placeholder: installed.length ? 'Select a provider' : 'No enabled providers' },
    {
      name: 'sourceId',
      label: 'Source record',
      type: 'select',
      wide: true,
      disabled: checkoutOptionsState === 'loading' || checkoutOptions.length === 0,
      placeholder: checkoutOptionsState === 'loading' ? 'Loading…' : checkoutOptionsState === 'error' ? 'Sources unavailable' : checkoutOptions.length === 0 ? 'No payable records' : 'Select a record',
      options: checkoutOptions.map(o => ({ value: o.id, label: [o.label, o.detail, o.totalCents ? money(o.totalCents) : ''].filter(Boolean).join(' · ') })),
    },
    { name: 'amount', label: 'Amount', type: 'money' },
  ]

  const refresh = async () => {
    await Promise.all([dateError ? Promise.resolve() : loadTransactions({ status, provider, from, to, search }), loadProviders()])
  }

  const filtered = Boolean(search.trim()) || status !== 'all' || provider !== 'all' || Boolean(from) || Boolean(to)
  const resetFilters = () => {
    setSearch('')
    setStatus('all')
    setProvider('all')
    setFrom('')
    setTo('')
  }
  const providerName = (code: string) => providers.find(p => p.code === code)?.name || code

  const statusOptions = [
    { value: 'all', label: 'All', count: counts.all || 0 },
    { value: 'unreconciled', label: 'Unreconciled', count: counts.unreconciled || 0, tone: 'warn' as const },
    ...STATUS_TABS.map(value => ({ value, label: PAYMENT_STATUS_LABEL[value], count: counts[value] || 0, tone: paymentTone(value) })),
    ...RARE_TABS.filter(value => (counts[value] || 0) > 0 || status === value).map(value => ({ value, label: PAYMENT_STATUS_LABEL[value], count: counts[value] || 0, tone: paymentTone(value) })),
  ]

  const breadcrumbs = [
    { type: 'link' as const, label: 'Dashboard', href: basePath },
    { type: 'page' as const, label: 'Platform' },
    { type: 'page' as const, label: 'Payments' },
  ]

  const header = (
    <DeskHeader
      title="Payments"
      tone={error ? 'bad' : (counts.failed || 0) > 0 ? 'bad' : (counts.unreconciled || 0) > 0 ? 'warn' : 'ok'}
      status={error ? 'Unavailable' : (counts.failed || 0) > 0 ? `${counts.failed} failed` : (counts.unreconciled || 0) > 0 ? `${counts.unreconciled} unreconciled` : 'Clear'}
      meta={`${counts.all || 0} transactions · ${installed.length} of ${providers.length} providers enabled`}
      actions={
        <Track>
          <Pill onClick={refresh} disabled={loading} aria-label="Refresh" className="h-11 sm:h-8">
            <RefreshCw className={loading ? 'animate-spin' : undefined} />
            Refresh
          </Pill>
          {view === 'transactions' ? (
            <Pill variant="primary" onClick={openCheckout} className="h-11 sm:h-8">
              <Plus />
              New checkout
            </Pill>
          ) : (
            <Pill variant="primary" onClick={() => openProvider(null)} className="h-11 sm:h-8">
              <Plus />
              Add provider
            </Pill>
          )}
        </Track>
      }
    />
  )

  return (
    <PageContainer title="Payments" header={header} breadcrumbs={breadcrumbs}>
      <div className="min-w-0 max-w-full space-y-6 px-4 pb-24 md:px-6">
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

        <Segmented<View>
          label="Payments view"
          value={view}
          onChange={setView}
          options={[
            { value: 'transactions', label: 'Transactions', count: counts.all || 0 },
            { value: 'providers', label: 'Providers', count: providers.length },
          ]}
        />

        {view === 'transactions' ? (
          <div className="space-y-4">
            <ReadoutStrip>
              <Readout label="Pending" value={(counts.pending || 0) + (counts.creating || 0) + (counts.authorized || 0)} tone={counts.pending ? 'warn' : 'idle'} />
              <Readout label="Captured" value={counts.captured || 0} tone="ok" />
              <Readout label="Unreconciled" value={counts.unreconciled || 0} tone={counts.unreconciled ? 'warn' : 'idle'} />
              <Readout label="Failed" value={counts.failed || 0} tone={counts.failed ? 'bad' : 'idle'} />
            </ReadoutStrip>

            <div className="flex min-w-0 flex-col gap-3">
              <Segmented label="Payment status" value={status} onChange={setStatus} options={statusOptions} />
              <div className="grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_12rem_10rem_10rem]">
                <div className="relative min-w-0 sm:col-span-2 lg:col-span-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Payment ID, provider ID or reference" aria-label="Search payments" className="h-11 pl-9 sm:h-9" />
                </div>
                <Select value={provider} onValueChange={setProvider}>
                  <SelectTrigger className="h-11 w-full sm:h-9" aria-label="Provider">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All providers</SelectItem>
                    {providers.map(p => (
                      <SelectItem key={p.id} value={p.code}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input type="date" value={from} max={to || undefined} onChange={event => setFrom(event.target.value)} aria-label="From date" aria-invalid={Boolean(dateError)} className="h-11 sm:h-9" />
                <Input type="date" value={to} min={from || undefined} onChange={event => setTo(event.target.value)} aria-label="To date" aria-invalid={Boolean(dateError)} className="h-11 sm:h-9" />
              </div>
              {dateError && <p className="text-xs text-red-600 dark:text-red-400">{dateError}</p>}
            </div>

            {error ? (
              <div className="space-y-3">
                <Notice tone="bad">
                  <p className="font-medium">Payments are unavailable</p>
                  <p className="mt-0.5 text-muted-foreground">{error}</p>
                </Notice>
                <Track>
                  <Pill onClick={() => loadTransactions({ status, provider, from, to, search })}>Retry</Pill>
                </Track>
              </div>
            ) : (
              <Panel className={loading ? 'opacity-60 transition-opacity' : undefined} aria-busy={loading}>
                {transactions.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 py-10 text-center text-sm text-muted-foreground">
                    <p>{loading ? 'Loading…' : filtered ? 'No payments match' : 'No payments'}</p>
                    {filtered && !loading && (
                      <Track>
                        <Pill size="sm" onClick={resetFilters}>Reset filters</Pill>
                      </Track>
                    )}
                  </div>
                ) : (
                  <ul className="divide-y">
                    {transactions.map(tx => {
                      const source = paymentSource(tx)
                      return (
                        <li key={tx.id}>
                          <Link href={`${basePath}/platform/payments/${tx.id}`} className="flex min-h-11 min-w-0 items-center gap-3 px-4 py-3 hover:bg-muted/40">
                            <div className="min-w-0 flex-1">
                              <TitleLine as="p" tone={paymentTone(tx.status)} status={PAYMENT_STATUS_LABEL[tx.status] || tx.status} className="text-sm font-medium text-foreground">
                                {source.label} <Code>{recordReference('PAY', tx.id)}</Code>
                              </TitleLine>
                              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                {[
                                  PAYMENT_STATUS_LABEL[tx.status] || tx.status,
                                  source.detail,
                                  providerName(tx.providerKey),
                                  tx.refundedCents ? `${money(tx.refundedCents, tx.currency)} refunded` : '',
                                  tx.reconciledAt ? 'Reconciled' : '',
                                  dateTime(tx.createdAt, timeZone),
                                ].filter(Boolean).join(' · ')}
                              </p>
                            </div>
                            <span className="shrink-0 font-mono text-[13px] tabular-nums">{money(tx.amountCents, tx.currency)}</span>
                            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </Panel>
            )}
          </div>
        ) : providerError ? (
          <div className="space-y-3">
            <Notice tone="bad">
              <p className="font-medium">Providers are unavailable</p>
              <p className="mt-0.5 text-muted-foreground">{providerError}</p>
            </Notice>
            <Track>
              <Pill onClick={loadProviders}>Retry</Pill>
            </Track>
          </div>
        ) : (
          <Panel>
            {providers.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">No payment providers</p>
            ) : (
              <ul className="divide-y">
                {providers.map(record => {
                  const adapter = providerAdapter(record)
                  return (
                    <li key={record.id} className="flex min-w-0 flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
                      <div className="min-w-0 flex-1">
                        <TitleLine as="p" tone={record.isInstalled ? 'ok' : 'idle'} status={record.isInstalled ? 'Enabled' : 'Disabled'} className="text-sm font-medium text-foreground">
                          {record.name} <Code>{record.code}</Code>
                        </TitleLine>
                        <p className="mt-0.5 break-words text-xs text-muted-foreground">
                          {[record.isInstalled ? 'Enabled' : 'Disabled', adapter ? `Adapter ${adapter}` : 'Per-function adapters', `${record.transactionsCount} transactions`].join(' · ')}
                        </p>
                      </div>
                      <Track className="self-start sm:self-auto">
                        <Pill size="sm" className="h-11 sm:h-7" onClick={() => openProvider(record)}>
                          <Pencil />
                          Edit
                        </Pill>
                        <Pill size="sm" className="h-11 sm:h-7" disabled={toggling === record.id} onClick={() => toggleProvider(record)}>
                          <Power />
                          {record.isInstalled ? 'Disable' : 'Enable'}
                        </Pill>
                      </Track>
                    </li>
                  )
                })}
              </ul>
            )}
          </Panel>
        )}

        <CommandDialog
          open={checkoutOpen}
          title="New checkout"
          fields={checkoutFields}
          values={checkoutValues}
          fieldErrors={checkoutFieldErrors}
          error={checkoutError}
          busy={checkoutBusy}
          submitLabel="Create checkout"
          onValuesChange={changeCheckout}
          onSubmit={submitCheckout}
          onOpenChange={setCheckoutOpen}
        />

        <CommandDialog
          open={Boolean(providerForm)}
          title={providerForm?.provider ? 'Edit provider' : 'Add provider'}
          fields={providerFields}
          values={providerForm?.values || {}}
          fieldErrors={providerFieldErrors}
          error={providerSubmitError}
          busy={providerBusy}
          submitLabel={providerForm?.provider ? 'Save' : 'Add'}
          onValuesChange={values => { setProviderForm(current => (current ? { ...current, values } : current)); setProviderFieldErrors({}) }}
          onSubmit={submitProvider}
          onOpenChange={open => { if (!open) setProviderForm(null) }}
        />
      </div>
    </PageContainer>
  )
}
