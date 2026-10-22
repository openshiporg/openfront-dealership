'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { RefreshCw, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageContainer } from '@/features/dashboard/components/PageContainer'
import { basePath } from '@/features/dashboard/lib/config'
import { Code, DeskHeader, Notice, Panel, Pill, Segmented, StatusDot, TitleLine, Track, type DeskTone } from '@/features/platform/components/desk'
import { type TradeIn, getTradeIns, recordTradeInAppraisal } from '../actions'

type QueueFilter = 'open' | 'all' | 'attached'

const conditionTone: Record<string, DeskTone> = {
  excellent: 'ok',
  good: 'info',
  fair: 'warn',
  poor: 'bad',
}

function appraisalState(tradeIn: TradeIn): { tone: DeskTone; label: string } {
  if (tradeIn.deal) return { tone: 'ok', label: 'On deal' }
  if (tradeIn.offerAmount) return { tone: 'info', label: 'Offered' }
  return { tone: 'warn', label: 'Needs appraisal' }
}

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value || 0)
}

function formatMileage(value: number | null | undefined) {
  return new Intl.NumberFormat('en-US').format(value || 0)
}

function vehicleLabel(tradeIn: TradeIn) {
  return [tradeIn.year, tradeIn.make, tradeIn.model, tradeIn.trim].filter(Boolean).join(' ') || 'Unknown vehicle'
}

function preliminaryWholesaleEstimate(referenceValue: number, condition: string | null, mileage: number | null) {
  const conditionFactor =
    {
      excellent: 0.9,
      good: 0.82,
      fair: 0.72,
      poor: 0.58,
    }[condition || 'good'] || 0.78

  const mileagePenalty = Math.max(0, ((mileage || 0) - 90000) * 0.04)
  return Math.max(500, Math.round((referenceValue || 0) * conditionFactor - mileagePenalty))
}

function offerDraftsFor(tradeIns: TradeIn[]) {
  return Object.fromEntries(tradeIns.map(tradeIn => [tradeIn.id, String(tradeIn.offerAmount || '')]))
}

export function TradeInDeskPageClient({
  initialTradeIns,
  initialError,
}: {
  initialTradeIns: TradeIn[]
  initialError: string | null
}) {
  const [tradeIns, setTradeIns] = useState<TradeIn[]>(initialTradeIns)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(initialError)
  const [search, setSearch] = useState('')
  const [sortOrder, setSortOrder] = useState('vehicle')
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [offerDrafts, setOfferDrafts] = useState<Record<string, string>>(() => offerDraftsFor(initialTradeIns))
  const [filter, setFilter] = useState<QueueFilter>('open')

  const loadTradeIns = async () => {
    setLoading(true)
    setError(null)

    const response = await getTradeIns()

    if (response.success && response.data) {
      const loaded = response.data.tradeIns || []
      setTradeIns(loaded)
      setOfferDrafts(offerDraftsFor(loaded))
    } else {
      setError(response.error || 'Unable to load trade-ins.')
    }

    setLoading(false)
  }

  const filteredTradeIns = useMemo(() => {
    const queued =
      filter === 'attached'
        ? tradeIns.filter(tradeIn => tradeIn.deal)
        : filter === 'open'
          ? tradeIns.filter(tradeIn => !tradeIn.deal)
          : tradeIns
    const term = search.trim().toLowerCase()
    const visible = !term
      ? queued
      : queued.filter(item =>
          `${vehicleLabel(item)} ${item.vin || ''} ${item.lead?.firstName || ''} ${item.lead?.lastName || ''}`.toLowerCase().includes(term)
        )
    return [...visible].sort((a, b) =>
      sortOrder === 'offer-desc'
        ? (b.offerAmount || 0) - (a.offerAmount || 0)
        : sortOrder === 'mileage'
          ? (a.mileage || 0) - (b.mileage || 0)
          : vehicleLabel(a).localeCompare(vehicleLabel(b))
    )
  }, [tradeIns, filter, search, sortOrder])

  const updateOffer = async (tradeIn: TradeIn) => {
    const amount = Number(offerDrafts[tradeIn.id] || 0)
    if (amount <= 0) {
      alert('Enter a valid offer amount')
      return
    }

    setUpdatingId(tradeIn.id)
    const response = await recordTradeInAppraisal({
      id: tradeIn.id,
      referenceValueCents: Math.round((tradeIn.referenceValue || 0) * 100),
      offerAmountCents: Math.round(amount * 100),
      idempotencyKey: `trade-in-appraisal:${tradeIn.id}:${Math.round(amount * 100)}`,
    })

    if (!response.success) {
      alert(`Unable to update offer: ${response.error}`)
    }

    await loadTradeIns()
    setUpdatingId(null)
  }

  const applyWholesaleEstimate = (tradeIn: TradeIn) => {
    const estimate = preliminaryWholesaleEstimate(tradeIn.referenceValue || 0, tradeIn.condition, tradeIn.mileage)
    setOfferDrafts(prev => ({ ...prev, [tradeIn.id]: String(estimate) }))
  }

  const isFiltered = Boolean(search.trim()) || filter !== 'all'
  const resetFilters = () => {
    setSearch('')
    setFilter('all')
  }

  const counts = {
    open: tradeIns.filter(tradeIn => !tradeIn.deal).length,
    attached: tradeIns.filter(tradeIn => tradeIn.deal).length,
    all: tradeIns.length,
  }
  const awaiting = tradeIns.filter(tradeIn => !tradeIn.deal && !tradeIn.offerAmount).length

  const breadcrumbs = [
    { type: 'link' as const, label: 'Dashboard', href: basePath },
    { type: 'page' as const, label: 'Platform' },
    { type: 'page' as const, label: 'Trade-Ins' },
  ]

  const header = (
    <DeskHeader
      title="Trade-ins"
      tone={error ? 'bad' : awaiting > 0 ? 'warn' : 'ok'}
      status={error ? 'Unavailable' : `${awaiting} need appraisal`}
      meta={`${counts.open} open · ${awaiting} need appraisal · ${counts.attached} on deals`}
      actions={
        <Track>
          <Pill onClick={loadTradeIns} disabled={loading}>
            <RefreshCw className={loading ? 'animate-spin' : undefined} />
            Refresh
          </Pill>
        </Track>
      }
    />
  )

  return (
    <PageContainer title="Trade-Ins" header={header} breadcrumbs={breadcrumbs}>
      <div className="min-w-0 max-w-full space-y-4 px-4 pb-10 md:px-6">
        <Segmented<QueueFilter>
          label="Filter trade-ins"
          value={filter}
          onChange={setFilter}
          size="sm"
          options={[
            { value: 'open', label: 'Open', count: counts.open },
            { value: 'attached', label: 'On deal', count: counts.attached },
            { value: 'all', label: 'All', count: counts.all },
          ]}
        />
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 sm:max-w-sm sm:flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Vehicle, customer or VIN"
              aria-label="Search trade-ins"
            />
          </div>
          <Select value={sortOrder} onValueChange={setSortOrder}>
            <SelectTrigger className="w-full sm:w-[160px]" aria-label="Sort trade-ins">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="vehicle">Vehicle</SelectItem>
              <SelectItem value="offer-desc">Highest offer</SelectItem>
              <SelectItem value="mileage">Lowest mileage</SelectItem>
            </SelectContent>
          </Select>
          {loading && (
            <span className="text-xs text-muted-foreground" role="status">
              Refreshing…
            </span>
          )}
        </div>

        {error ? (
          <Notice tone="bad">
            <p className="font-medium">Trade-ins unavailable</p>
            <p className="mt-0.5 text-muted-foreground">{error}</p>
            <Track className="mt-2">
              <Pill size="sm" onClick={loadTradeIns}>Retry</Pill>
            </Track>
          </Notice>
        ) : filteredTradeIns.length === 0 ? (
          <Panel className="flex flex-col items-center gap-3 px-4 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              {tradeIns.length > 0 && isFiltered ? 'No matching trade-ins' : 'No trade-ins'}
            </p>
            {tradeIns.length > 0 && isFiltered && (
              <Track>
                <Pill size="sm" onClick={resetFilters}>Reset filters</Pill>
              </Track>
            )}
          </Panel>
        ) : (
          <Panel className="divide-y">
            {filteredTradeIns.map(tradeIn => {
              const wholesale = preliminaryWholesaleEstimate(tradeIn.referenceValue || 0, tradeIn.condition, tradeIn.mileage)
              const spread = (tradeIn.referenceValue || 0) - Number(offerDrafts[tradeIn.id] || tradeIn.offerAmount || 0)
              const state = appraisalState(tradeIn)
              const customer = tradeIn.lead
                ? [tradeIn.lead.firstName, tradeIn.lead.lastName].filter(Boolean).join(' ') || 'Customer'
                : null

              return (
                <div key={tradeIn.id} className="space-y-3 px-4 py-3">
                  <div className="flex min-w-0 items-start justify-between gap-4">
                    <div className="min-w-0">
                      <TitleLine as="p" tone={state.tone} status={state.label} className="text-sm font-medium">
                        {vehicleLabel(tradeIn)}
                        {tradeIn.condition && (
                          <span className="ml-2 inline-flex items-baseline gap-1 text-xs font-normal capitalize text-muted-foreground">
                            <span className="sr-only">Condition: </span>
                            <StatusDot tone={conditionTone[tradeIn.condition] ?? 'idle'} className="size-1.5 -translate-y-px shadow-none" />
                            {tradeIn.condition}
                          </span>
                        )}
                      </TitleLine>
                      <p className="break-words pl-4 text-xs text-muted-foreground">
                        <span className="tabular-nums">{formatMileage(tradeIn.mileage)} mi</span>
                        {' · VIN '}
                        <Code>{tradeIn.vin || 'not entered'}</Code>
                        {' · '}
                        {state.label}
                      </p>
                      <p className="break-words pl-4 text-xs text-muted-foreground">
                        {tradeIn.lead ? (
                          <Link href={`${basePath}/platform/crm/${tradeIn.lead.id}`} className="text-foreground hover:underline">
                            {customer}
                          </Link>
                        ) : (
                          'No customer'
                        )}
                        {' · '}
                        {tradeIn.lead?.phone || tradeIn.lead?.email || 'No contact'}
                        {tradeIn.appraisedBy?.name ? ` · Appraised by ${tradeIn.appraisedBy.name}` : ''}
                      </p>
                      {tradeIn.interiorCondition && (
                        <p className="break-words pl-4 text-xs text-muted-foreground">{tradeIn.interiorCondition}</p>
                      )}
                      {tradeIn.mechanicalIssues && (
                        <p className="break-words pl-4 text-xs text-amber-700 dark:text-amber-300" title={tradeIn.mechanicalIssues}>
                          Mechanical notes
                        </p>
                      )}
                      <p className="break-words pl-4 text-xs text-muted-foreground">
                        {tradeIn.deal ? (
                          <Link href={`${basePath}/platform/deals/${tradeIn.deal.id}`} className="text-foreground hover:underline">
                            Deal ·{' '}
                            {tradeIn.deal.vehicle
                              ? `${tradeIn.deal.vehicle.year} ${tradeIn.deal.vehicle.make} ${tradeIn.deal.vehicle.model}`
                              : 'Deal'}
                          </Link>
                        ) : (
                          'Not attached'
                        )}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold tabular-nums">{tradeIn.offerAmount ? formatCurrency(tradeIn.offerAmount) : '-'}</p>
                      <p className="text-[11px] text-muted-foreground">Offer</p>
                      <p className="mt-1 text-xs tabular-nums text-muted-foreground">Ref {formatCurrency(tradeIn.referenceValue)}</p>
                      <p className="text-xs tabular-nums text-muted-foreground">Est {formatCurrency(wholesale)}</p>
                    </div>
                  </div>

                  <div className="flex min-w-0 flex-col gap-2 pl-4 sm:flex-row sm:items-center sm:justify-end">
                    <div className="flex min-w-0 items-center gap-2 sm:mr-auto">
                      <Input
                        type="number"
                        value={offerDrafts[tradeIn.id] || ''}
                        onChange={event => setOfferDrafts(prev => ({ ...prev, [tradeIn.id]: event.target.value }))}
                        className="h-8 w-full min-w-0 tabular-nums sm:w-36"
                        placeholder="Offer"
                        aria-label={`Offer for ${vehicleLabel(tradeIn)}`}
                      />
                      <p className={`shrink-0 text-xs tabular-nums ${spread < 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                        Spread {formatCurrency(spread)}
                      </p>
                    </div>
                    <Track className="self-end sm:self-auto">
                      <Pill size="sm" onClick={() => applyWholesaleEstimate(tradeIn)}>
                        Use estimate
                      </Pill>
                      <Pill size="sm" variant="primary" onClick={() => updateOffer(tradeIn)} disabled={updatingId === tradeIn.id}>
                        Save offer
                      </Pill>
                    </Track>
                  </div>
                </div>
              )
            })}
          </Panel>
        )}
      </div>
    </PageContainer>
  )
}
