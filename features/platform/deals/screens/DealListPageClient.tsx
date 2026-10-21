'use client'

import { useCallback, useRef, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Calendar, Car, Circle, DollarSign, Filter, Plus, Search, Square, Triangle, User } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageContainer } from '@/features/dashboard/components/PageContainer'
import { basePath } from '@/features/dashboard/lib/config'
import { getDealDeskWorkspace, type DealDeskDeal } from '../actions'

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

const statusColors: Record<string, string> = {
  pencil: 'bg-slate-100 text-slate-700',
  submitted: 'bg-blue-100 text-blue-700',
  approved: 'bg-green-100 text-green-700',
  financed: 'bg-purple-100 text-purple-700',
  delivered: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-700',
}

const statusLabels: Record<string, string> = {
  pencil: 'Pencil (Draft)',
  submitted: 'Submitted',
  approved: 'Approved',
  financed: 'Financed',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

function toListDeals(deals: DealDeskDeal[]): Deal[] {
  return deals.map(deal => ({
    ...deal,
    vehiclePrice: (deal.vehiclePriceCents ?? 0) / 100,
    totalPrice: (deal.totalPriceCents ?? 0) / 100,
  }))
}

function EmptyStateDefault() {
  return (
    <EmptyState
      title="No deals"
      description="Deals you create will appear here."
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

const formatCurrency = (value: number | null | undefined) => {
  if (value == null) return '-'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
}

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
  const requestRef = useRef(0)

  const loadDeals = useCallback(async (status: string) => {
    const request = ++requestRef.current
    setLoading(true)
    setError(null)
    const response = await getDealDeskWorkspace(status)
    if (request !== requestRef.current) return
    if (response.success && response.data) {
      setDeals(toListDeals(response.data.dealDeskWorkspace.deals || []))
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
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">Deals</h1>
        <p className="text-muted-foreground">Work deals from quote through contracting and delivery.</p>
      </div>
      <Button asChild>
        <Link href={`${basePath}/platform/deals/create`}>
          <Plus className="h-4 w-4 mr-2" />
          New Deal
        </Link>
      </Button>
    </div>
  )

  const summaryCards = [
    { label: 'Delivered Revenue', value: formatCurrency(totalRevenue), icon: DollarSign, tone: 'bg-blue-100 text-blue-600' },
    { label: 'Pending Deals', value: String(pendingCount), icon: Calendar, tone: 'bg-amber-100 text-amber-600' },
    { label: 'Delivered', value: String(deliveredCount), icon: Car, tone: 'bg-green-100 text-green-600' },
    { label: 'Total Deals', value: String(filteredDeals.length), icon: User, tone: 'bg-purple-100 text-purple-600' },
  ]

  return (
    <PageContainer title="Deals" header={header} breadcrumbs={breadcrumbs}>
      <div className="min-w-0 space-y-6 px-4 pb-6 md:px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {summaryCards.map(({ label, value, icon: Icon, tone }) => (
            <Card key={label}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${tone}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{label}</p>
                    <p className="text-xl font-bold">{value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by vehicle, customer, or stock #..."
              aria-label="Search deals"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={changeStatus}>
            <SelectTrigger className="w-full sm:w-[180px]" aria-label="Filter by status">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pencil">Pencil (Draft)</SelectItem>
              <SelectItem value="submitted">Submitted</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="financed">Financed</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
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

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12" role="status">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" aria-hidden="true" />
                <span className="sr-only">Loading deals</span>
              </div>
            ) : error ? (
              <div className="py-12 text-center">
                <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-destructive" />
                <p className="font-medium">Unable to load deals</p>
                <p className="mt-1 text-sm text-muted-foreground">{error}</p>
                <Button variant="outline" className="mt-4" onClick={() => loadDeals(statusFilter)}>
                  Retry
                </Button>
              </div>
            ) : filteredDeals.length === 0 ? (
              isFiltered ? <EmptyStateSearch onResetFilters={resetFilters} /> : <EmptyStateDefault />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left py-3 px-4 font-medium">Vehicle</th>
                      <th className="text-left py-3 px-4 font-medium">Customer</th>
                      <th className="text-left py-3 px-4 font-medium">Sales Rep</th>
                      <th className="text-right py-3 px-4 font-medium">Price</th>
                      <th className="text-center py-3 px-4 font-medium">Status</th>
                      <th className="text-left py-3 px-4 font-medium">Date</th>
                      <th className="text-right py-3 px-4 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDeals.map(deal => (
                      <tr key={deal.id} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="py-3 px-4">
                          {deal.vehicle ? (
                            <div>
                              <p className="font-medium">
                                {deal.vehicle.year} {deal.vehicle.make} {deal.vehicle.model}
                              </p>
                              <p className="text-xs text-muted-foreground">Stock #{deal.vehicle.stockNumber}</p>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">No vehicle</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {deal.lead ? (
                            `${deal.lead.firstName} ${deal.lead.lastName}`
                          ) : (
                            <span className="text-muted-foreground">No customer</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {deal.salesperson?.name || <span className="text-muted-foreground">Unassigned</span>}
                        </td>
                        <td className="py-3 px-4 text-right font-medium">{formatCurrency(deal.vehiclePrice)}</td>
                        <td className="py-3 px-4 text-center">
                          <Badge className={statusColors[deal.status] || 'bg-gray-100 text-gray-700'}>
                            {statusLabels[deal.status] || deal.status}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">{formatDate(deal.saleDate || deal.createdAt)}</td>
                        <td className="py-3 px-4 text-right">
                          <Button asChild variant="ghost" size="sm">
                            <Link href={`${basePath}/platform/deals/${deal.id}`}>View</Link>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  )
}
