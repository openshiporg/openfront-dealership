'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
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
import { 
  Plus, 
  Search, 
  Filter, 
  Car, 
  DollarSign, 
  Clock, 
  AlertTriangle 
} from 'lucide-react'
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'

interface Vehicle {
  id: string
  stockNumber: string
  vin: string
  year: number
  make: string
  model: string
  trim: string | null
  color: string | null
  mileage: number
  price: number
  purchasePrice: number | null
  status: string
  condition: string
  dateAcquired: string | null
  createdAt: string
}

const statusColors: Record<string, string> = {
  available: 'bg-green-100 text-green-700',
  sold: 'bg-blue-100 text-blue-700',
  pending: 'bg-amber-100 text-amber-700',
  hold: 'bg-purple-100 text-purple-700',
  service: 'bg-slate-100 text-slate-700',
}

const conditionLabels: Record<string, string> = {
  new: 'New',
  used: 'Used',
  certified: 'Certified Pre-Owned',
}

export function VehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    loadVehicles()
  }, [statusFilter])

  const loadVehicles = async () => {
    const query = `
      query GetVehicles($where: VehicleWhereInput) {
        vehicles(where: $where, orderBy: { createdAt: desc }) {
          id stockNumber vin year make model trim color mileage price purchasePrice status condition dateAcquired createdAt
        }
      }
    `

    const where: any = {}
    if (statusFilter !== 'all') {
      where.status = { equals: statusFilter }
    }

    const response = await keystoneClient<{ vehicles: Vehicle[] }>(query, { where })
    if (response.success && response.data) {
      setVehicles(response.data.vehicles || [])
    }
    setLoading(false)
  }

  const filteredVehicles = vehicles.filter(v => {
    if (!searchQuery) return true
    const search = searchQuery.toLowerCase()
    const str = `${v.year} ${v.make} ${v.model} ${v.vin} ${v.stockNumber}`.toLowerCase()
    return str.includes(search)
  })

  const formatCurrency = (value: number | null | undefined) => {
    if (value == null) return '-'
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
  }

  const calculateDaysInStock = (vehicle: Vehicle) => {
    const date = vehicle.dateAcquired || vehicle.createdAt
    if (!date) return 0
    return Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24))
  }

  const totalValue = filteredVehicles.filter(v => v.status === 'available').reduce((sum, v) => sum + (v.price || 0), 0)
  const avgDaysInStock = filteredVehicles.filter(v => v.status === 'available').length > 0
    ? Math.round(filteredVehicles.filter(v => v.status === 'available').reduce((sum, v) => sum + calculateDaysInStock(v), 0) / filteredVehicles.filter(v => v.status === 'available').length)
    : 0
  const agingCount = filteredVehicles.filter(v => v.status === 'available' && calculateDaysInStock(v) > 60).length

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Vehicle Inventory</h1>
          <p className="text-muted-foreground">Manage vehicle stock and pricing</p>
        </div>
        <Link href="/dashboard/Vehicle/create">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Vehicle
          </Button>
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Car className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Inventory</p>
                <p className="text-xl font-bold">{filteredVehicles.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Value</p>
                <p className="text-xl font-bold">{formatCurrency(totalValue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Days in Stock</p>
                <p className="text-xl font-bold">{avgDaysInStock}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-red-100 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Aging (60+ days)</p>
                <p className="text-xl font-bold">{agingCount}</p>
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
            placeholder="Search by VIN, stock #, make, model..."
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
            <SelectItem value="available">Available</SelectItem>
            <SelectItem value="sold">Sold</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="hold">On Hold</SelectItem>
            <SelectItem value="service">In Service</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Vehicles Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredVehicles.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Car className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No vehicles found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left py-3 px-4 font-medium">Stock #</th>
                    <th className="text-left py-3 px-4 font-medium">Vehicle</th>
                    <th className="text-left py-3 px-4 font-medium">VIN</th>
                    <th className="text-right py-3 px-4 font-medium">Mileage</th>
                    <th className="text-center py-3 px-4 font-medium">Status</th>
                    <th className="text-right py-3 px-4 font-medium">Price</th>
                    <th className="text-right py-3 px-4 font-medium">Days</th>
                    <th className="text-right py-3 px-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVehicles.map((vehicle) => {
                    const daysInStock = calculateDaysInStock(vehicle)
                    const isAging = daysInStock > 60 && vehicle.status === 'available'
                    return (
                      <tr key={vehicle.id} className={`border-b last:border-0 hover:bg-muted/50 ${isAging ? 'bg-red-50' : ''}`}>
                        <td className="py-3 px-4 font-mono text-xs">{vehicle.stockNumber}</td>
                        <td className="py-3 px-4">
                          <p className="font-medium">{vehicle.year} {vehicle.make} {vehicle.model}</p>
                          <p className="text-xs text-muted-foreground">
                            {vehicle.trim && `${vehicle.trim} · `}
                            {vehicle.color && `${vehicle.color} · `}
                            {conditionLabels[vehicle.condition] || vehicle.condition}
                          </p>
                        </td>
                        <td className="py-3 px-4 font-mono text-xs">{vehicle.vin}</td>
                        <td className="py-3 px-4 text-right">{vehicle.mileage?.toLocaleString() || '-'}</td>
                        <td className="py-3 px-4 text-center">
                          <Badge className={statusColors[vehicle.status] || 'bg-gray-100 text-gray-700'}>
                            {vehicle.status}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-right font-medium">{formatCurrency(vehicle.price)}</td>
                        <td className="py-3 px-4 text-right">
                          <span className={isAging ? 'text-red-600 font-medium' : ''}>
                            {daysInStock}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Link href={`/dashboard/Vehicle/${vehicle.id}`}>
                            <Button variant="ghost" size="sm">View</Button>
                          </Link>
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
    </div>
  )
}
