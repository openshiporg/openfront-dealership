'use client'

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronRight, Plus, RefreshCw, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageContainer } from '@/features/dashboard/components/PageContainer'
import { basePath } from '@/features/dashboard/lib/config'
import { Code, DeskHeader, Notice, Panel, Pill, Segmented, StatusDot, TitleLine, Track } from '@/features/platform/components/desk'
import { formatPhone } from '@/features/platform/lib/format'
import {
  createWalkInTradeIn,
  getTradeInCreateOptions,
  getTradeIns,
  type TradeIn,
  type TradeInAcquisition,
  type TradeInLeadOption,
  type TradeInRooftop,
} from '../actions'
import { EMPTY_TRADE_IN_FORM, TradeInFormDialog, tradeInDetailsPayload, type TradeInFormValues } from '../components/TradeInFormDialog'
import {
  conditionLabel,
  conditionTone,
  formatMileage,
  formatWholeUsd,
  tradeInCustomer,
  tradeInQueue,
  tradeInState,
  tradeInVehicleLabel,
  type TradeInQueue,
} from '../lib/tradeInState'

type DeskData = { tradeIns: TradeIn[]; acquisitions: Record<string, TradeInAcquisition>; canSeeAcquisitions: boolean }

export function TradeInDeskPageClient({
  initialData,
  initialError,
  timeZone,
}: {
  initialData: DeskData | null
  initialError: string | null
  timeZone: string
}) {
  const router = useRouter()
  const [data, setData] = useState<DeskData>(initialData ?? { tradeIns: [], acquisitions: {}, canSeeAcquisitions: false })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(initialError)
  const [search, setSearch] = useState('')
  const [sortOrder, setSortOrder] = useState('recent')
  const [filter, setFilter] = useState<TradeInQueue>('appraise')
  const [createOpen, setCreateOpen] = useState(false)
  const [createBusy, setCreateBusy] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createOptions, setCreateOptions] = useState<{ rooftops: TradeInRooftop[]; leads: TradeInLeadOption[] } | null>(null)
  const createKeyRef = useRef<string>('')

  const { tradeIns, acquisitions } = data

  const load = async () => {
    setLoading(true)
    setError(null)
    const response = await getTradeIns()
    if (response.success) setData(response.data)
    else setError(response.error || 'Unable to load trade-ins.')
    setLoading(false)
  }

  const counts = useMemo(() => {
    const result: Record<TradeInQueue, number> = { appraise: 0, offered: 0, 'on-deal': 0, acquired: 0, all: tradeIns.length }
    for (const tradeIn of tradeIns) result[tradeInQueue(tradeIn, acquisitions[tradeIn.id])] += 1
    return result
  }, [tradeIns, acquisitions])

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    const rows = tradeIns.filter(tradeIn => {
      if (filter !== 'all' && tradeInQueue(tradeIn, acquisitions[tradeIn.id]) !== filter) return false
      if (!term) return true
      return `${tradeInVehicleLabel(tradeIn)} ${tradeIn.vin || ''} ${tradeInCustomer(tradeIn) || ''} ${tradeIn.lead?.email || ''} ${tradeIn.lead?.phone || ''}`.toLowerCase().includes(term)
    })
    return [...rows].sort((a, b) =>
      sortOrder === 'offer-desc'
        ? (b.offerAmount || 0) - (a.offerAmount || 0)
        : sortOrder === 'mileage'
          ? (a.mileage ?? Number.MAX_SAFE_INTEGER) - (b.mileage ?? Number.MAX_SAFE_INTEGER)
          : sortOrder === 'vehicle'
            ? tradeInVehicleLabel(a).localeCompare(tradeInVehicleLabel(b))
            : new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    )
  }, [tradeIns, acquisitions, filter, search, sortOrder])

  const openCreate = async () => {
    setCreateError(null)
    createKeyRef.current = `trade-in-walk-in:${crypto.randomUUID()}`
    // Options load before the dialog opens so a single rooftop can be preselected.
    if (!createOptions) {
      setCreateBusy(true)
      const response = await getTradeInCreateOptions()
      setCreateBusy(false)
      if (response.success) setCreateOptions(response.data)
      else setCreateError(response.error || 'Unable to load rooftops.')
    }
    setCreateOpen(true)
  }

  const submitCreate = async (values: TradeInFormValues) => {
    setCreateBusy(true)
    setCreateError(null)
    const details = tradeInDetailsPayload(values)
    const response = await createWalkInTradeIn({
      rooftopId: values.rooftopId,
      leadId: values.leadId || undefined,
      ...details,
      condition: details.condition || undefined,
      idempotencyKey: createKeyRef.current,
    })
    setCreateBusy(false)
    if (!response.success) {
      setCreateError(response.error)
      return
    }
    setCreateOpen(false)
    router.push(`${basePath}/platform/trade-ins/${response.data.createWalkInTradeIn.id}`)
  }

  const createInitial: TradeInFormValues = {
    ...EMPTY_TRADE_IN_FORM,
    rooftopId: createOptions?.rooftops.length === 1 ? createOptions.rooftops[0].id : '',
  }

  const isFiltered = Boolean(search.trim()) || filter !== 'all'
  const resetFilters = () => {
    setSearch('')
    setFilter('all')
  }

  const breadcrumbs = [
    { type: 'link' as const, label: 'Dashboard', href: basePath },
    { type: 'page' as const, label: 'Platform' },
    { type: 'page' as const, label: 'Trade-Ins' },
  ]

  const header = (
    <DeskHeader
      title="Trade-ins"
      tone={error ? 'bad' : counts.appraise > 0 ? 'warn' : 'ok'}
      status={error ? 'Unavailable' : `${counts.appraise} need appraisal`}
      meta={error ? 'Unavailable' : `${counts.appraise} need appraisal · ${counts.offered} offered · ${counts['on-deal']} on deals`}
      actions={
        <Track>
          <Pill onClick={load} disabled={loading} aria-label="Refresh trade-ins">
            <RefreshCw className={loading ? 'animate-spin' : undefined} />
            Refresh
          </Pill>
          <Pill variant="primary" onClick={openCreate} disabled={createBusy}>
            <Plus />
            New trade-in
          </Pill>
        </Track>
      }
    />
  )

  const filterOptions: Array<{ value: TradeInQueue; label: string; count: number; tone?: 'warn' | 'info' | 'ok' }> = [
    { value: 'appraise', label: 'Needs appraisal', count: counts.appraise, tone: 'warn' },
    { value: 'offered', label: 'Offered', count: counts.offered, tone: 'info' },
    { value: 'on-deal', label: 'On deal', count: counts['on-deal'], tone: 'ok' },
    ...(data.canSeeAcquisitions ? [{ value: 'acquired' as const, label: 'Acquired', count: counts.acquired }] : []),
    { value: 'all', label: 'All', count: counts.all },
  ]

  return (
    <PageContainer title="Trade-Ins" header={header} breadcrumbs={breadcrumbs}>
      <div className="min-w-0 max-w-full space-y-4 px-4 pb-24 md:px-6">
        <Segmented<TradeInQueue> label="Filter trade-ins" value={filter} onChange={setFilter} size="sm" options={filterOptions} className="w-full sm:w-auto" />
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 sm:max-w-sm sm:flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" value={search} onChange={event => setSearch(event.target.value)} placeholder="Vehicle, customer or VIN" aria-label="Search trade-ins" />
          </div>
          <Select value={sortOrder} onValueChange={setSortOrder}>
            <SelectTrigger className="w-full sm:w-[170px]" aria-label="Sort trade-ins"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Newest first</SelectItem>
              <SelectItem value="vehicle">Vehicle</SelectItem>
              <SelectItem value="offer-desc">Highest offer</SelectItem>
              <SelectItem value="mileage">Lowest mileage</SelectItem>
            </SelectContent>
          </Select>
          {loading && <span className="text-xs text-muted-foreground" role="status">Refreshing…</span>}
        </div>

        {error ? (
          <Notice tone="bad">
            <p className="font-medium">Trade-ins unavailable</p>
            <p className="mt-0.5 text-muted-foreground">{error}</p>
            <Track className="mt-2"><Pill size="sm" onClick={load}>Retry</Pill></Track>
          </Notice>
        ) : visible.length === 0 ? (
          <Panel className="flex flex-col items-center gap-3 px-4 py-12 text-center">
            <p className="text-sm text-muted-foreground">{tradeIns.length > 0 && isFiltered ? 'No matching trade-ins' : 'No trade-ins'}</p>
            <Track>
              {tradeIns.length > 0 && isFiltered ? <Pill size="sm" onClick={resetFilters}>Reset filters</Pill> : <Pill size="sm" variant="primary" onClick={openCreate} disabled={createBusy}><Plus />New trade-in</Pill>}
            </Track>
          </Panel>
        ) : (
          <Panel className="divide-y">
            {visible.map(tradeIn => {
              const state = tradeInState(tradeIn, acquisitions[tradeIn.id])
              const customer = tradeInCustomer(tradeIn)
              return (
                <Link
                  key={tradeIn.id}
                  href={`${basePath}/platform/trade-ins/${tradeIn.id}`}
                  className="flex min-h-[44px] min-w-0 items-start justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
                >
                  <div className="min-w-0">
                    <TitleLine as="p" tone={state.tone} status={state.label} className="text-sm font-medium text-foreground">
                      {tradeInVehicleLabel(tradeIn)}
                      {tradeIn.condition && (
                        <span className="ml-2 inline-flex items-baseline gap-1 text-xs font-normal text-muted-foreground">
                          <span className="sr-only">Condition: </span>
                          <StatusDot tone={conditionTone[tradeIn.condition] ?? 'idle'} className="size-1.5 -translate-y-px shadow-none" />
                          {conditionLabel(tradeIn.condition)}
                        </span>
                      )}
                    </TitleLine>
                    <p className="break-words pl-4 text-xs text-muted-foreground">
                      {state.label} · <span className="tabular-nums">{formatMileage(tradeIn.mileage)}</span> · VIN <Code>{tradeIn.vin || 'not entered'}</Code>
                    </p>
                    <p className="break-words pl-4 text-xs text-muted-foreground">
                      {customer || 'No customer'}
                      {tradeIn.lead ? ` · ${formatPhone(tradeIn.lead.phone) || tradeIn.lead.email || 'No contact'}` : ''}
                      {tradeIn.createdAt ? ` · ${new Date(tradeIn.createdAt).toLocaleDateString('en-US', { timeZone, month: 'short', day: 'numeric' })}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-start gap-2">
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums">{tradeIn.offerAmount != null ? formatWholeUsd(tradeIn.offerAmount) : '-'}</p>
                      <p className="text-[11px] text-muted-foreground">Offer</p>
                      {tradeIn.referenceValue != null && <p className="mt-1 text-xs tabular-nums text-muted-foreground">Ref {formatWholeUsd(tradeIn.referenceValue)}</p>}
                    </div>
                    <ChevronRight aria-hidden="true" className="mt-0.5 size-4 text-muted-foreground" />
                  </div>
                </Link>
              )
            })}
          </Panel>
        )}
      </div>

      <TradeInFormDialog
        open={createOpen}
        mode="create"
        initialValues={createInitial}
        rooftops={createOptions?.rooftops || []}
        leads={createOptions?.leads || []}
        busy={createBusy}
        error={createError}
        onSubmit={submitCreate}
        onOpenChange={open => {
          setCreateOpen(open)
          if (!open) setCreateError(null)
        }}
      />
    </PageContainer>
  )
}
