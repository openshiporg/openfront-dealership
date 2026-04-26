'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Search, Filter, DollarSign, Car, User, Calendar } from 'lucide-react'
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'

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

export function DealsPage() {
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    loadDeals()
  }, [statusFilter])

  const loadDeals = async () => {
    const query = `
      query GetDeals($where: DealWhereInput) {
        deals(where: $where, orderBy: { createdAt: desc }) {
          id
          vehiclePrice
          status
          saleDate
          createdAt
          totalPrice
          salesperson { id name }
          lead { id firstName lastName }
          vehicle { id year make model stockNumber }
        }
      }
    `

    const where: any = {}
    if (statusFilter !== 'all') {
      where.status = { equals: statusFilter }
    }

    const response = await keystoneClient<{ deals: Deal[] }>(query, { where })
    if (response.success && response.data) {
      setDeals(response.data.deals || [])
    }
    setLoading(false)
  }

  const filteredDeals = deals.filter(deal => {
    if (!searchQuery) return true
    const search = searchQuery.toLowerCase()
    const vehicleStr = deal.vehicle ? `${deal.vehicle.year} ${deal.vehicle.make} ${deal.vehicle.model}`.toLowerCase() : ''
    const customerStr = deal.lead ? `${deal.lead.firstName} ${deal.lead.lastName}`.toLowerCase() : ''
    return vehicleStr.includes(search) || customerStr.includes(search) || deal.vehicle?.stockNumber.toLowerCase().includes(search)
  })

  const formatCurrency = (value: number | null | undefined) => {
    if (value == null) return '-'
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
  }

  const formatDate = (date: string | null) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const totalRevenue = filteredDeals
    .filter(d => ['delivered', 'financed', 'approved'].includes(d.status))
    .reduce((sum, d) => sum + (d.vehiclePrice || 0), 0)
  
  const pendingCount = filteredDeals.filter(d => ['pencil', 'submitted'].includes(d.status)).length
  const deliveredCount = filteredDeals.filter(d => d.status === 'delivered').length

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Deal Management</h1>
          <p className="text-muted-foreground">Manage deals, approvals, and sales transactions</p>
        </div>
        <Link href="/dashboard/deals/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Deal
          </Button>
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-xl font-bold">{formatCurrency(totalRevenue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending Deals</p>
                <p className="text-xl font-bold">{pendingCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
                <Car className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Delivered</p>
                <p className="text-xl font-bold">{deliveredCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <User className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Deals</p>
                <p className="text-xl font-bold">{filteredDeals.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by vehicle, customer, or stock #..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
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
      </div>

      {/* Deals Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredDeals.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Car className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No deals found</p>
              <Link href="/dashboard/deals/new">
                <Button variant="outline" className="mt-4">
                  Create your first deal
                </Button>
              </Link>
            </div>
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
                  {filteredDeals.map((deal) => (
                    <tr key={deal.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="py-3 px-4">
                        {deal.vehicle ? (
                          <div>
                            <p className="font-medium">{deal.vehicle.year} {deal.vehicle.make} {deal.vehicle.model}</p>
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
                      <td className="py-3 px-4 text-right font-medium">
                        {formatCurrency(deal.vehiclePrice)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge className={statusColors[deal.status] || 'bg-gray-100 text-gray-700'}>
                          {statusLabels[deal.status] || deal.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        {formatDate(deal.saleDate || deal.createdAt)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link href={`/dashboard/deals/${deal.id}`}>
                          <Button variant="ghost" size="sm">View</Button>
                        </Link>
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
  )
}
