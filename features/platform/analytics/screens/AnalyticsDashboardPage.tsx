'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  ArrowRight
} from 'lucide-react'
import { getSalesMetrics, getInventoryMetrics, type SalesMetrics, type InventoryMetrics } from '@/features/dashboard/actions/analytics'

const COLORS = ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16']

const chartConfig = {
  revenue: { label: 'Revenue', color: '#2563eb' },
  count: { label: 'Count', color: '#16a34a' },
  sales: { label: 'Sales', color: '#f59e0b' },
}

function MetricCard({ 
  title, 
  value, 
  change, 
  icon: Icon, 
  trend 
}: { 
  title: string
  value: string
  change?: string
  icon: React.ElementType
  trend?: 'up' | 'down' | 'neutral'
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {change && (
              <div className={`flex items-center gap-1 mt-1 text-sm ${
                trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-muted-foreground'
              }`}>
                {trend === 'up' && <TrendingUp className="h-4 w-4" />}
                {trend === 'down' && <TrendingDown className="h-4 w-4" />}
                <span>{change}</span>
              </div>
            )}
          </div>
          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="h-6 w-6 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function AnalyticsPage() {
  const [salesMetrics, setSalesMetrics] = useState<SalesMetrics | null>(null)
  const [inventoryMetrics, setInventoryMetrics] = useState<InventoryMetrics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      const [salesRes, invRes] = await Promise.all([
        getSalesMetrics(),
        getInventoryMetrics(),
      ])
      if (salesRes.success && salesRes.data) setSalesMetrics(salesRes.data)
      if (invRes.success && invRes.data) setInventoryMetrics(invRes.data)
      setLoading(false)
    }
    loadData()
  }, [])

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Analytics Dashboard</h1>
          <p className="text-muted-foreground">Sales performance and inventory insights</p>
        </div>
      </div>

      <Tabs defaultValue="sales" className="space-y-6">
        <TabsList>
          <TabsTrigger value="sales">Sales Performance</TabsTrigger>
          <TabsTrigger value="inventory">Inventory Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="space-y-6">
          {/* Sales KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Total Sales"
              value={salesMetrics?.totalSales.toString() || '0'}
              icon={Car}
              trend="neutral"
            />
            <MetricCard
              title="Total Revenue"
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
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
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
              <Link href="/dashboard/vehicles" className="text-sm text-primary flex items-center gap-1 hover:underline">
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
      </Tabs>
    </div>
  )
}
