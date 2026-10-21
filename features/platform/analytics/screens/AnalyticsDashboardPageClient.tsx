'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  ChartContainer, 
  ChartTooltip, 
  ChartTooltipContent 
} from '@/components/ui/chart'
import { 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid,
  ResponsiveContainer 
} from 'recharts'
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Car, 
  Users, 
  Calendar,
  ArrowRight,
  Wrench,
  AlertTriangle,
  ClipboardList,
  CheckCircle2
} from 'lucide-react'
import { PageContainer } from '@/features/dashboard/components/PageContainer'
import { basePath } from '@/features/dashboard/lib/config'
import { getAnalyticsData, type AnalyticsData } from '../actions'

const COLORS = ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16']

const chartConfig = {
  revenue: { label: 'Revenue', color: '#2563eb' },
  count: { label: 'Count', color: '#16a34a' },
  sales: { label: 'Sales', color: '#f59e0b' },
}

function MetricCard({ title, value, change }: { title: string; value: string; change?: string; icon: React.ElementType; trend?: 'up' | 'down' | 'neutral' }) {
  return <dl className="flex flex-wrap items-baseline justify-between gap-2 border-b py-3 text-sm"><dt>{title}</dt><dd className="font-medium tabular-nums">{value}{change && <span className="ml-2 text-xs text-muted-foreground">{change}</span>}</dd></dl>
}

export function AnalyticsDashboardPageClient({ initialData }: { initialData: AnalyticsData }) {
  const [data, setData] = useState<AnalyticsData>(initialData)
  const [loading, setLoading] = useState(false)

  const loadData = async () => {
    setLoading(true)
    setData(await getAnalyticsData())
    setLoading(false)
  }

  const { sales: salesMetrics, inventory: inventoryMetrics, service: serviceMetrics, operations, currencyCode, error } = data

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode, maximumFractionDigits: 0 }).format(value)
  }
  const compactCurrency = new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode, notation: 'compact', maximumFractionDigits: 0 })

  const breadcrumbs = [
    { type: 'link' as const, label: 'Dashboard', href: basePath },
    { type: 'page' as const, label: 'Platform' },
    { type: 'page' as const, label: 'Analytics' },
  ]

  const header = (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">Analytics</h1>
      <p className="text-muted-foreground">Track sales, inventory, conversion, and operations metrics.</p>
    </div>
  )

  if (error) {
    return (
      <PageContainer title="Analytics" header={header} breadcrumbs={breadcrumbs}>
        <div className="px-4 pb-6 md:px-6">
          <Card>
            <CardContent className="py-12 text-center">
              <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-destructive" />
              <p className="font-medium">Unable to load analytics</p>
              <p className="mt-1 text-sm text-muted-foreground">{error}</p>
              <Button variant="outline" className="mt-4" onClick={loadData} disabled={loading}>
                Retry
              </Button>
            </CardContent>
          </Card>
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer title="Analytics" header={header} breadcrumbs={breadcrumbs}>
    <div className="min-w-0 space-y-6 overflow-x-hidden px-4 pb-6 md:px-6 [&_.grid>*]:min-w-0 [&_.recharts-responsive-container]:max-w-full">

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="F&I product penetration" value={`${operations?.metrics?.financeProductPenetrationPercent || 0}%`} icon={ClipboardList} trend="neutral" />
        <MetricCard title="Effective labor rate" value={formatCurrency((operations?.metrics?.service?.effectiveLaborRateCents || 0) / 100)} icon={Wrench} trend="neutral" />
        <MetricCard title="Parts fill rate" value={`${operations?.metrics?.parts?.fillRatePercent || 0}%`} icon={CheckCircle2} trend="neutral" />
        <MetricCard title="Open exceptions" value={String(operations?.exceptions?.total || 0)} change={`${operations?.exceptions?.accounting || 0} accounting · ${operations?.exceptions?.payments || 0} payments`} icon={AlertTriangle} trend={(operations?.exceptions?.total || 0) > 0 ? 'down' : 'neutral'} />
      </div>

      <Tabs defaultValue="sales" className="space-y-6">
        <TabsList className="max-w-full justify-start overflow-x-auto">
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="service">Service</TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="space-y-6">
          {/* Sales KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Delivered Sales"
              value={salesMetrics?.totalSales.toString() || '0'}
              icon={Car}
              trend="neutral"
            />
            <MetricCard
              title="Delivered Revenue"
              value={formatCurrency(salesMetrics?.totalRevenue || 0)}
              icon={DollarSign}
              trend="up"
            />
            <MetricCard
              title="Avg Deal Profit"
              value={formatCurrency(salesMetrics?.avgDealProfit || 0)}
              icon={TrendingUp}
              trend="up"
            />
            <MetricCard
              title="Sales Reps Active"
              value={salesMetrics?.salesByRep.length.toString() || '0'}
              icon={Users}
              trend="neutral"
            />
          </div>

          {/* Charts Row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sales Trend Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Sales Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[300px]">
                  <LineChart data={salesMetrics?.salesByMonth || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line 
                      type="monotone" 
                      dataKey="count" 
                      stroke="var(--color-count)" 
                      strokeWidth={2}
                      dot={{ fill: "var(--color-count)" }}
                    />
                  </LineChart>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Revenue by Month */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Revenue by Month</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[300px]">
                  <BarChart data={salesMetrics?.salesByMonth || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => compactCurrency.format(Number(v))} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sales by Rep */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Top Sales Reps</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[300px]">
                  <BarChart data={salesMetrics?.salesByRep.slice(0, 5) || []} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tick={{ fontSize: 12 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={100} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="count" fill="var(--color-sales)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Vehicles Sold by Make */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Sales by Make</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[300px]">
                  <PieChart>
                    <Pie
                      data={salesMetrics?.vehiclesSold.slice(0, 8) || []}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="count"
                      nameKey="make"
                      label={({ make, count }) => `${make}: ${count}`}
                    >
                      {(salesMetrics?.vehiclesSold || []).slice(0, 8).map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent />} />
                  </PieChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>

          {/* Top Vehicles Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Top Selling Vehicles</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium">Vehicle</th>
                      <th className="text-right py-3 px-4 font-medium">Units Sold</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(salesMetrics?.topVehicles || []).map((vehicle, idx) => (
                      <tr key={idx} className="border-b last:border-0">
                        <td className="py-3 px-4">{vehicle.year} {vehicle.make} {vehicle.model}</td>
                        <td className="py-3 px-4 text-right font-medium">{vehicle.count}</td>
                      </tr>
                    ))}
                    {!salesMetrics?.topVehicles?.length && (
                      <tr>
                        <td colSpan={2} className="py-8 text-center text-muted-foreground">No sales data available</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inventory" className="space-y-6">
          {/* Inventory KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Total Vehicles"
              value={inventoryMetrics?.totalVehicles.toString() || '0'}
              icon={Car}
              trend="neutral"
            />
            <MetricCard
              title="Total Inventory Value"
              value={formatCurrency(inventoryMetrics?.totalValue || 0)}
              icon={DollarSign}
              trend="neutral"
            />
            <MetricCard
              title="Avg Days in Stock"
              value={Math.round(inventoryMetrics?.avgDaysInStock || 0).toString()}
              icon={Calendar}
              trend={inventoryMetrics?.avgDaysInStock && inventoryMetrics.avgDaysInStock > 60 ? 'down' : 'up'}
            />
            <MetricCard
              title="Available Units"
              value={inventoryMetrics?.vehiclesByStatus.find(s => s.status === 'available')?.count.toString() || '0'}
              icon={Car}
              trend="neutral"
            />
          </div>

          {/* Inventory Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Status Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Inventory by Status</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[300px]">
                  <PieChart>
                    <Pie
                      data={inventoryMetrics?.vehiclesByStatus || []}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="count"
                      nameKey="status"
                      label={({ status, count }) => `${status}: ${count}`}
                    >
                      {(inventoryMetrics?.vehiclesByStatus || []).map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent />} />
                  </PieChart>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Aging Analysis */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Inventory Aging</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[300px]">
                  <BarChart data={inventoryMetrics?.agingBreakdown || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="range" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {(inventoryMetrics?.agingBreakdown || []).map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={
                            entry.range === '90+' ? '#dc2626' :
                            entry.range === '61-90' ? '#f59e0b' :
                            entry.range === '31-60' ? '#3b82f6' :
                            '#22c55e'
                          } 
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>

          {/* Slow Moving Inventory */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Slow Moving Inventory (90+ Days)</CardTitle>
              <Link href={`${basePath}/platform/vehicles`} className="text-sm text-primary flex items-center gap-1 hover:underline">
                View All <ArrowRight className="h-4 w-4" />
              </Link>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium">Stock #</th>
                      <th className="text-left py-3 px-4 font-medium">Vehicle</th>
                      <th className="text-right py-3 px-4 font-medium">Days in Stock</th>
                      <th className="text-right py-3 px-4 font-medium">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(inventoryMetrics?.slowMoving || [])
                      .filter(v => v.daysInStock > 60)
                      .map((vehicle) => (
                        <tr key={vehicle.id} className="border-b last:border-0">
                          <td className="py-3 px-4 font-mono text-xs">{vehicle.stockNumber}</td>
                          <td className="py-3 px-4">{vehicle.year} {vehicle.make} {vehicle.model}</td>
                          <td className="py-3 px-4 text-right">
                            <span className={`font-medium ${vehicle.daysInStock > 90 ? 'text-red-600' : 'text-amber-600'}`}>
                              {vehicle.daysInStock} days
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-medium">{formatCurrency(vehicle.price)}</td>
                        </tr>
                      ))}
                    {!inventoryMetrics?.slowMoving?.filter(v => v.daysInStock > 60).length && (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-muted-foreground">No slow-moving inventory</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Condition Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Inventory by Condition</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {(inventoryMetrics?.vehiclesByCondition || []).map((item, idx) => (
                  <div key={idx} className="bg-muted/50 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold">{item.count}</p>
                    <p className="text-sm text-muted-foreground capitalize">{item.condition}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="service" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Today's Appointments"
              value={serviceMetrics?.todayAppointments.toString() || '0'}
              icon={Calendar}
              trend="neutral"
            />
            <MetricCard
              title="Active Repair Orders"
              value={serviceMetrics?.activeRepairOrders.toString() || '0'}
              icon={ClipboardList}
              trend="neutral"
            />
            <MetricCard
              title="Settled RO Revenue"
              value={formatCurrency(serviceMetrics?.serviceRevenue || 0)}
              icon={DollarSign}
              trend="up"
            />
            <MetricCard
              title="Avg Settled Repair Order"
              value={formatCurrency(serviceMetrics?.avgRepairOrder || 0)}
              icon={Wrench}
              trend="neutral"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Appointments by Status</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[300px]">
                  <PieChart>
                    <Pie
                      data={serviceMetrics?.appointmentsByStatus || []}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="count"
                      nameKey="status"
                      label={({ status, count }) => `${status}: ${count}`}
                    >
                      {(serviceMetrics?.appointmentsByStatus || []).map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent />} />
                  </PieChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Repair Orders by Status</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[300px]">
                  <BarChart data={serviceMetrics?.repairOrdersByStatus || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="status" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Service Mix</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-medium">Service Type</th>
                        <th className="text-right py-3 px-4 font-medium">Appointments</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(serviceMetrics?.serviceTypeBreakdown || []).map((item) => (
                        <tr key={item.serviceType} className="border-b last:border-0">
                          <td className="py-3 px-4 capitalize">{item.serviceType}</td>
                          <td className="py-3 px-4 text-right font-medium">{item.count}</td>
                        </tr>
                      ))}
                      {!serviceMetrics?.serviceTypeBreakdown?.length && (
                        <tr>
                          <td colSpan={2} className="py-8 text-center text-muted-foreground">No service appointment data</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Low Stock Parts</CardTitle>
                <Link href={`${basePath}/platform/service`} className="text-sm text-primary flex items-center gap-1 hover:underline">
                  Service <ArrowRight className="h-4 w-4" />
                </Link>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-medium">Part</th>
                        <th className="text-right py-3 px-4 font-medium">Qty</th>
                        <th className="text-right py-3 px-4 font-medium">Min</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(serviceMetrics?.lowStockParts || []).map((part) => (
                        <tr key={part.id} className="border-b last:border-0">
                          <td className="py-3 px-4">
                            <div className="flex items-start gap-2">
                              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
                              <div>
                                <p className="font-medium">{part.description}</p>
                                <p className="text-xs text-muted-foreground">#{part.partNumber}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right font-medium text-red-600">{part.quantity}</td>
                          <td className="py-3 px-4 text-right">{part.minimumQuantity}</td>
                        </tr>
                      ))}
                      {!serviceMetrics?.lowStockParts?.length && (
                        <tr>
                          <td colSpan={3} className="py-8 text-center text-muted-foreground">No low-stock parts</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
    </PageContainer>
  )
}
