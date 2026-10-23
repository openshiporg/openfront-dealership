'use client'

import { useCallback, useRef, useState } from 'react'
import Link from 'next/link'
import { Plus, RefreshCw, Search } from 'lucide-react'
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
} from '@/features/platform/components/desk'
import { getDealDeskWorkspace, type DealDeskDeal } from '../actions'
import { DEAL_STATUSES, labelForDeal, toneForDeal } from '../lib/dealStatus'
import { formatUsd } from '../lib/formatMoney'

interface Deal {
  id: string
  vehiclePrice: number
  status: string
  saleDate: string | null
  createdAt: string
  totalPrice: number
  salesperson: { id: string; name: string } | null
  lead: { id: string; firstName: string; lastName: string } | null
  vehicle: { id: string; year: number; make: string; model: string; stockNumber: string } | null
}

type StatusCounts = Partial<Record<string, number>>

function toListDeals(deals: DealDeskDeal[]): Deal[] {
  return deals.map(deal => ({
    ...deal,
    vehiclePrice: (deal.vehiclePriceCents ?? 0) / 100,
    totalPrice: (deal.totalPriceCents ?? 0) / 100,
  }))
}

function countByStatus(deals: Array<{ status: string }>): StatusCounts {
  const counts: StatusCounts = { all: deals.length }
  for (const status of DEAL_STATUSES) counts[status] = 0
  for (const deal of deals) counts[deal.status] = (counts[deal.status] ?? 0) + 1
  return counts
}

const formatCurrency = (value: number | null | undefined) => formatUsd(value, { whole: true })

const formatDate = (date: string | null) => {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function DealListPageClient({
  initialDeals,
  initialError,
}: {
  initialDeals: DealDeskDeal[] | null
  initialError: string | null
}) {
  const [deals, setDeals] = useState<Deal[]>(initialDeals ? toListDeals(initialDeals) : [])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(initialError)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sortOrder, setSortOrder] = useState<string>('recent')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusCounts, setStatusCounts] = useState<StatusCounts>(() => (initialDeals ? countByStatus(initialDeals) : {}))
  const requestRef = useRef(0)

  const loadDeals = useCallback(async (status: string) => {
    const request = ++requestRef.current
    setLoading(true)
    setError(null)
    const response = await getDealDeskWorkspace(status)
    if (request !== requestRef.current) return
    if (response.success && response.data) {
      const loaded = response.data.dealDeskWorkspace.deals || []
      setDeals(toListDeals(loaded))
      setStatusCounts(current => (status === 'all' ? countByStatus(loaded) : { ...current, [status]: loaded.length }))
    } else {
      setError(response.error || 'Unable to load deals.')
    }
    setLoading(false)
  }, [])

  const changeStatus = (status: string) => {
    setStatusFilter(status)
    void loadDeals(status)
  }

  const resetFilters = () => {
    setSearchQuery('')
    setSortOrder('recent')
    if (statusFilter !== 'all') changeStatus('all')
  }

  const filteredDeals = deals
    .filter(deal => {
      if (!searchQuery) return true
      const search = searchQuery.toLowerCase()
      const vehicleStr = deal.vehicle ? `${deal.vehicle.year} ${deal.vehicle.make} ${deal.vehicle.model}`.toLowerCase() : ''
      const customerStr = deal.lead ? `${deal.lead.firstName} ${deal.lead.lastName}`.toLowerCase() : ''
      return vehicleStr.includes(search) || customerStr.includes(search) || deal.vehicle?.stockNumber.toLowerCase().includes(search)
    })
    .sort((a, b) => {
      if (sortOrder === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      if (sortOrder === 'value-desc') return b.totalPrice - a.totalPrice
      if (sortOrder === 'value-asc') return a.totalPrice - b.totalPrice
      return new Date(b.saleDate || b.createdAt).getTime() - new Date(a.saleDate || a.createdAt).getTime()
    })

  const totalRevenue = filteredDeals
    .filter(d => d.status === 'delivered' && Boolean(d.saleDate))
    .reduce((sum, d) => sum + (d.vehiclePrice || 0), 0)

  const pendingCount = filteredDeals.filter(d => ['pencil', 'submitted'].includes(d.status)).length
  const deliveredCount = filteredDeals.filter(d => d.status === 'delivered').length
  const isFiltered = Boolean(searchQuery) || statusFilter !== 'all'

  const breadcrumbs = [
    { type: 'link' as const, label: 'Dashboard', href: basePath },
    { type: 'page' as const, label: 'Platform' },
    { type: 'page' as const, label: 'Deals' },
  ]

  const header = (
    <DeskHeader
      title="Deals"
      meta={`${filteredDeals.length} ${filteredDeals.length === 1 ? 'deal' : 'deals'}${statusFilter !== 'all' ? ` · ${labelForDeal(statusFilter)}` : ''}`}
      actions={
        <Track>
          <Pill onClick={() => loadDeals(statusFilter)} disabled={loading} aria-label="Refresh deals">
            <RefreshCw className={loading ? 'animate-spin' : undefined} />
            Refresh
          </Pill>
          <Pill asChild variant="primary">
            <Link href={`${basePath}/platform/deals/create`}>
              <Plus />
              New deal
            </Link>
          </Pill>
        </Track>
      }
    />
  )

  const boardOptions = [
    { value: 'all', label: 'All', count: statusCounts.all },
    ...DEAL_STATUSES.map(status => ({ value: status, label: labelForDeal(status), tone: toneForDeal(status), count: statusCounts[status] })),
  ]

  return (
    <PageContainer title="Deals" header={header} breadcrumbs={breadcrumbs}>
      <div className="min-w-0 max-w-full space-y-8 px-4 pb-24 md:px-6">
        <ReadoutStrip>
          <Readout label="Delivered revenue" value={formatCurrency(totalRevenue)} />
          <Readout label="Pending" value={pendingCount} tone={pendingCount > 0 ? 'warn' : 'idle'} />
          <Readout label="Delivered" value={deliveredCount} tone={deliveredCount > 0 ? 'ok' : 'idle'} />
          <Readout label="Deals" value={filteredDeals.length} />
        </ReadoutStrip>

        <DeskSection
          title="Board"
          count={filteredDeals.length}
          actions={loading ? <span role="status" className="text-xs text-muted-foreground">Loading deals</span> : undefined}
        >
          <div className="space-y-3">
            <Segmented label="Filter by status" value={statusFilter} onChange={changeStatus} options={boardOptions} size="sm" className="w-full sm:w-auto" />
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative min-w-0 flex-1 sm:max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Vehicle, customer or stock #"
                  aria-label="Search deals"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={sortOrder} onValueChange={setSortOrder}>
                <SelectTrigger className="w-full sm:w-[180px]" aria-label="Sort deals">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Recently active</SelectItem>
                  <SelectItem value="oldest">Oldest first</SelectItem>
                  <SelectItem value="value-desc">Value high to low</SelectItem>
                  <SelectItem value="value-asc">Value low to high</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {error ? (
              <Notice tone="bad">
                <p className="font-medium">Unable to load deals</p>
                <p className="mt-0.5 text-muted-foreground">{error}</p>
                <Track className="mt-2">
                  <Pill size="sm" onClick={() => loadDeals(statusFilter)}>Retry</Pill>
                </Track>
              </Notice>
            ) : loading && filteredDeals.length === 0 ? (
              <p role="status" className="py-10 text-center text-sm text-muted-foreground">Loading deals</p>
            ) : filteredDeals.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center text-sm text-muted-foreground">
                <p>{isFiltered ? 'No matching deals' : 'No deals'}</p>
                {isFiltered && (
                  <Track>
                    <Pill size="sm" onClick={resetFilters}>Reset filters</Pill>
                  </Track>
                )}
              </div>
            ) : (
              <Panel className={`divide-y ${loading ? 'opacity-60' : ''}`} aria-busy={loading}>
                <div className="hidden items-center gap-4 px-4 py-2 font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground sm:flex">
                  <span className="min-w-0 flex-1">Vehicle</span>
                  <span className="w-28 text-right">Total</span>
                  <span className="w-28 text-right">Price</span>
                </div>
                {filteredDeals.map(deal => {
                  const customer = deal.lead ? `${deal.lead.firstName} ${deal.lead.lastName}` : 'No customer'
                  return (
                    <Link
                      key={deal.id}
                      href={`${basePath}/platform/deals/${deal.id}`}
                      className="flex min-w-0 items-start gap-4 px-4 py-3 transition-colors hover:bg-muted/40"
                    >
                      <div className="min-w-0 flex-1">
                        <TitleLine as="p" tone={toneForDeal(deal.status)} status={labelForDeal(deal.status)} className="text-sm font-medium text-foreground">
                          {deal.vehicle ? `${deal.vehicle.year} ${deal.vehicle.make} ${deal.vehicle.model}` : 'No vehicle'}
                        </TitleLine>
                        <p className="truncate pl-4 text-xs text-muted-foreground">
                          {labelForDeal(deal.status)} · {customer} · {deal.salesperson?.name || 'Unassigned'}
                        </p>
                        {deal.vehicle && (
                          <p className="pl-4">
                            <Code>#{deal.vehicle.stockNumber}</Code>
                          </p>
                        )}
                      </div>
                      <p className="hidden w-28 shrink-0 text-right text-sm tabular-nums text-muted-foreground sm:block">{formatCurrency(deal.totalPrice)}</p>
                      <div className="w-24 shrink-0 text-right sm:w-28">
                        <p className="text-sm font-semibold tabular-nums">{formatCurrency(deal.vehiclePrice)}</p>
                        <p className="text-xs tabular-nums text-muted-foreground sm:hidden">{formatCurrency(deal.totalPrice)}</p>
                        <p className="text-xs tabular-nums text-muted-foreground">{formatDate(deal.saleDate || deal.createdAt)}</p>
                      </div>
                    </Link>
                  )
                })}
              </Panel>
            )}
          </div>
        </DeskSection>
      </div>
    </PageContainer>
  )
}
