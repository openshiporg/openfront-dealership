'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Circle, RefreshCw, Search, Square, Triangle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageContainer } from '@/features/dashboard/components/PageContainer'
import { basePath } from '@/features/dashboard/lib/config'
import { type TradeIn, getTradeIns, recordTradeInAppraisal } from '../actions'

type QueueFilter = 'open' | 'all' | 'attached'

const conditionClasses: Record<string, string> = {
  excellent: 'bg-green-100 text-green-700 border-green-200',
  good: 'bg-blue-100 text-blue-700 border-blue-200',
  fair: 'bg-amber-100 text-amber-700 border-amber-200',
  poor: 'bg-red-100 text-red-700 border-red-200',
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

function EmptyStateDefault() {
  return (
    <EmptyState
      title="No trade-ins"
      description="Trade-in appraisals will appear here."
      icons={[Triangle, Square, Circle]}
    />
  )
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

  const breadcrumbs = [
    { type: 'link' as const, label: 'Dashboard', href: basePath },
    { type: 'page' as const, label: 'Platform' },
    { type: 'page' as const, label: 'Trade-Ins' },
  ]

  const header = (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">Trade-Ins</h1>
        <p className="text-muted-foreground">Appraise trade-ins and record offers.</p>
      </div>
      <Button className="self-start" variant="outline" onClick={loadTradeIns} disabled={loading}>
        <RefreshCw className="h-4 w-4 mr-2" />
        Refresh
      </Button>
    </div>
  )

  return (
    <PageContainer title="Trade-Ins" header={header} breadcrumbs={breadcrumbs}>
      <div className="space-y-6 px-4 pb-6 md:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row">
            <div className="relative w-full sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Search vehicle, customer, or VIN"
                aria-label="Search trade-ins"
              />
            </div>
            <Select value={sortOrder} onValueChange={setSortOrder}>
              <SelectTrigger className="w-full sm:w-[170px]" aria-label="Sort trade-ins">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vehicle">Vehicle</SelectItem>
                <SelectItem value="offer-desc">Highest offer</SelectItem>
                <SelectItem value="mileage">Lowest mileage</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter trade-ins">
            {([
              { value: 'open', label: 'Open' },
              { value: 'attached', label: 'Attached' },
              { value: 'all', label: 'All' },
            ] as const).map(option => (
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
        </div>

        {loading && (
          <span className="text-sm text-muted-foreground" role="status">
            Refreshing…
          </span>
        )}

        {error ? (
          <Card>
            <CardContent className="py-12 text-center">
              <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-destructive" />
              <p className="font-medium">Trade-ins are unavailable</p>
              <p className="mt-1 text-sm text-muted-foreground">{error}</p>
              <Button className="mt-4" variant="outline" onClick={loadTradeIns}>
                Retry
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Appraisal queue</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {filteredTradeIns.length === 0 ? (
                tradeIns.length > 0 && isFiltered ? (
                  <EmptyStateSearch onResetFilters={resetFilters} />
                ) : (
                  <EmptyStateDefault />
                )
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left py-3 px-4 font-medium">Vehicle</th>
                        <th className="text-left py-3 px-4 font-medium">Customer</th>
                        <th className="text-center py-3 px-4 font-medium">Condition</th>
                        <th className="text-right py-3 px-4 font-medium">Reference value</th>
                        <th className="text-right py-3 px-4 font-medium">Estimate</th>
                        <th className="text-left py-3 px-4 font-medium">Offer</th>
                        <th className="text-left py-3 px-4 font-medium">Deal</th>
                        <th className="text-right py-3 px-4 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTradeIns.map(tradeIn => {
                        const wholesale = preliminaryWholesaleEstimate(tradeIn.referenceValue || 0, tradeIn.condition, tradeIn.mileage)
                        const spread = (tradeIn.referenceValue || 0) - Number(offerDrafts[tradeIn.id] || tradeIn.offerAmount || 0)

                        return (
                          <tr key={tradeIn.id} className="border-b last:border-0 hover:bg-muted/50">
                            <td className="py-3 px-4">
                              <p className="font-medium">{vehicleLabel(tradeIn)}</p>
                              <div className="text-xs text-muted-foreground">
                                {formatMileage(tradeIn.mileage)} mi · VIN {tradeIn.vin || 'not entered'}
                              </div>
                              {tradeIn.mechanicalIssues && (
                                <div className="mt-1 inline-flex items-center gap-1 text-xs text-amber-700">
                                  <AlertTriangle className="h-3 w-3" /> Mechanical notes
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-4 max-w-[260px]">
                              {tradeIn.lead ? (
                                <Link href={`${basePath}/platform/crm/${tradeIn.lead.id}`} className="font-medium hover:underline">
                                  {[tradeIn.lead.firstName, tradeIn.lead.lastName].filter(Boolean).join(' ') || 'Customer'}
                                </Link>
                              ) : (
                                <p className="font-medium">No customer</p>
                              )}
                              <p className="text-xs text-muted-foreground line-clamp-2">
                                {tradeIn.lead?.phone || tradeIn.lead?.email || 'No contact'}
                              </p>
                              {tradeIn.interiorCondition && (
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{tradeIn.interiorCondition}</p>
                              )}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <Badge variant="outline" className={conditionClasses[tradeIn.condition || 'good'] || conditionClasses.good}>
                                {tradeIn.condition || 'unknown'}
                              </Badge>
                            </td>
                            <td className="py-3 px-4 text-right font-medium">{formatCurrency(tradeIn.referenceValue)}</td>
                            <td className="py-3 px-4 text-right">{formatCurrency(wholesale)}</td>
                            <td className="py-3 px-4 min-w-[180px]">
                              <Input
                                type="number"
                                value={offerDrafts[tradeIn.id] || ''}
                                onChange={event => setOfferDrafts(prev => ({ ...prev, [tradeIn.id]: event.target.value }))}
                                className="h-8"
                                aria-label={`Offer for ${vehicleLabel(tradeIn)}`}
                              />
                              <p className={`text-xs mt-1 ${spread < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                                Spread: {formatCurrency(spread)}
                              </p>
                            </td>
                            <td className="py-3 px-4">
                              {tradeIn.deal ? (
                                <Link href={`${basePath}/platform/deals/${tradeIn.deal.id}`} className="text-primary hover:underline">
                                  {tradeIn.deal.vehicle
                                    ? `${tradeIn.deal.vehicle.year} ${tradeIn.deal.vehicle.make} ${tradeIn.deal.vehicle.model}`
                                    : 'Deal'}
                                </Link>
                              ) : (
                                <span className="text-muted-foreground">Not attached</span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex justify-end gap-2">
                                <Button size="sm" variant="ghost" onClick={() => applyWholesaleEstimate(tradeIn)}>
                                  Use estimate
                                </Button>
                                <Button size="sm" onClick={() => updateOffer(tradeIn)} disabled={updatingId === tradeIn.id}>
                                  Save offer
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
        )}
      </div>
    </PageContainer>
  )
}
