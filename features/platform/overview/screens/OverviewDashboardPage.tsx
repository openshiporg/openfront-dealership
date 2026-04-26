'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
  ResponsiveContainer,
  Funnel,
  FunnelChart,
  LabelList
} from 'recharts'
import { 
  DollarSign, 
  Car, 
  Users, 
  TrendingUp,
  TrendingDown,
  Calendar,
  ArrowRight,
  Wrench
} from 'lucide-react'
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'

const COLORS = ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#8b5cf6', '#06b6d4']

const chartConfig = {
  revenue: { label: 'Revenue', color: '#2563eb' },
  count: { label: 'Count', color: '#16a34a' },
  sales: { label: 'Sales', color: '#f59e0b' },
}

interface DashboardMetrics {
  totalRevenue: number
  totalDeals: number
  totalLeads: number
  inventoryCount: number
  pendingDeals: number
  todayAppointments: number
  avgDealProfit: number
  conversionRate: number
  recentDeals: {
    id: string
    vehiclePrice: number
    status: string
    createdAt: string
    vehicle: { year: number; make: string; model: string } | null
    lead: { firstName: string; lastName: string } | null
  }[]
  salesByMonth: { month: string; revenue: number; count: number }[]
  leadsByStatus: { status: string; count: number }[]
  topReps: { name: string; deals: number; revenue: number }[]
}

function MetricCard({ 
  title, 
  value, 
  change, 
  icon: Icon, 
  trend,
  href
}: { 
  title: string
  value: string
  change?: string
  icon: React.ElementType
  trend?: 'up' | 'down' | 'neutral'
  href?: string
}) {
  const content = (
    <Card className="hover:shadow-md transition-shadow">
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

  if (href) {
    return <Link href={href}>{content}</Link>
  }
  return content
}

export function ExecutiveDashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    const [dealsRes, leadsRes, vehiclesRes, serviceRes] = await Promise.all([
      keystoneClient<{ deals: any[]; dealsCount: number }>(`
        query {
          deals(where: { status: { in: ["delivered", "financed", "approved", "pencil", "submitted"] } }, orderBy: { createdAt: desc }, take: 10) {
            id vehiclePrice status createdAt
            vehicle { year make model purchasePrice }
            lead { firstName lastName }
            salesperson { name }
          }
          dealsCount(where: { status: { in: ["delivered", "financed", "approved"] } })
        }
      `),
      keystoneClient<{ leads: any[]; leadsCount: number }>(`
        query {
          leads { id status source createdAt assignedTo { name } }
          leadsCount
        }
      `),
      keystoneClient<{ vehiclesCount: number }>(`
        query {
          vehiclesCount(where: { status: { equals: "available" } })
        }
      `),
      keystoneClient<{ serviceAppointmentsCount: number }>(`
        query {
          serviceAppointmentsCount(where: { scheduledDate: { gte: "${new Date().toISOString().split('T')[0]}", lte: "${new Date().toISOString().split('T')[0]}T23:59:59" } })
        }
      `),
    ])

    const deals = dealsRes.success && dealsRes.data ? dealsRes.data.deals || [] : []
    const dealsCount = dealsRes.success && dealsRes.data ? dealsRes.data.dealsCount || 0 : 0
    const leads = leadsRes.success && leadsRes.data ? leadsRes.data.leads || [] : []
    const leadsCount = leadsRes.success && leadsRes.data ? leadsRes.data.leadsCount || 0 : 0
    const inventoryCount = vehiclesRes.success && vehiclesRes.data ? vehiclesRes.data.vehiclesCount || 0 : 0
    const todayAppointments = serviceRes.success && serviceRes.data ? serviceRes.data.serviceAppointmentsCount || 0 : 0

    const completedDeals = deals.filter((d: any) => ['delivered', 'financed', 'approved'].includes(d.status))
    const totalRevenue = completedDeals.reduce((sum: number, d: any) => sum + (d.vehiclePrice || 0), 0)
    const profits = completedDeals.map((d: any) => {
      const sale = d.vehiclePrice || 0
      const cost = d.vehicle?.purchasePrice || 0
      return sale - cost
    }).filter((p: number) => p > 0)
    const avgDealProfit = profits.length > 0 ? profits.reduce((s: number, p: number) => s + p, 0) / profits.length : 0

    const convertedLeads = leads.filter((l: any) => l.status === 'converted').length
    const conversionRate = leadsCount > 0 ? (convertedLeads / leadsCount) * 100 : 0

    const pendingDeals = deals.filter((d: any) => ['pencil', 'submitted'].includes(d.status)).length

    const monthCounts: Record<string, { revenue: number; count: number }> = {}
    completedDeals.forEach((d: any) => {
      const month = new Date(d.createdAt).toISOString().slice(0, 7)
      if (!monthCounts[month]) monthCounts[month] = { revenue: 0, count: 0 }
      monthCounts[month].revenue += d.vehiclePrice || 0
      monthCounts[month].count++
    })
    const salesByMonth = Object.entries(monthCounts)
      .map(([month, data]) => ({ month, ...data }))
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-6)

    const statusCounts: Record<string, number> = {}
    leads.forEach((l: any) => {
      statusCounts[l.status] = (statusCounts[l.status] || 0) + 1
    })
    const leadsByStatus = Object.entries(statusCounts).map(([status, count]) => ({ status, count }))

    const repCounts: Record<string, { name: string; deals: number; revenue: number }> = {}
    completedDeals.forEach((d: any) => {
      if (d.salesperson) {
        const name = d.salesperson.name
        if (!repCounts[name]) repCounts[name] = { name, deals: 0, revenue: 0 }
        repCounts[name].deals++
        repCounts[name].revenue += d.vehiclePrice || 0
      }
    })
    const topReps = Object.values(repCounts).sort((a, b) => b.revenue - a.revenue).slice(0, 5)

    setMetrics({
      totalRevenue,
      totalDeals: dealsCount,
      totalLeads: leadsCount,
      inventoryCount,
      pendingDeals,
      todayAppointments,
      avgDealProfit,
      conversionRate,
      recentDeals: deals.slice(0, 5),
      salesByMonth,
      leadsByStatus,
      topReps,
    })
    setLoading(false)
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!metrics) {
    return <div className="p-6">Failed to load dashboard</div>
  }

  const statusLabels: Record<string, string> = {
    new: 'New',
    contacted: 'Contacted',
    qualified: 'Qualified',
    'test-drive-scheduled': 'Test Drive',
    negotiation: 'Negotiation',
    converted: 'Converted',
    lost: 'Lost',
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Executive Dashboard</h1>
          <p className="text-muted-foreground">Key performance indicators at a glance</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/analytics">
            <Button variant="outline">
              View Detailed Analytics
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Revenue"
          value={formatCurrency(metrics.totalRevenue)}
          icon={DollarSign}
          trend="up"
          change="+12% vs last month"
          href="/dashboard/analytics"
        />
        <MetricCard
          title="Deals Closed"
          value={metrics.totalDeals.toString()}
          icon={Car}
          trend="up"
          change="+5 this week"
          href="/dashboard/deals"
        />
        <MetricCard
          title="Active Leads"
          value={metrics.totalLeads.toString()}
          icon={Users}
          href="/dashboard/crm/leads"
        />
        <MetricCard
          title="Available Inventory"
          value={metrics.inventoryCount.toString()}
          icon={Car}
          href="/dashboard/vehicles"
        />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Pending Deals</p>
            <p className="text-2xl font-bold text-amber-600">{metrics.pendingDeals}</p>
            <p className="text-xs text-muted-foreground mt-1">Awaiting approval</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Today's Appointments</p>
            <p className="text-2xl font-bold">{metrics.todayAppointments}</p>
            <p className="text-xs text-muted-foreground mt-1">Service + Test Drives</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Avg Deal Profit</p>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(metrics.avgDealProfit)}</p>
            <p className="text-xs text-muted-foreground mt-1">Per vehicle</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Lead Conversion</p>
            <p className="text-2xl font-bold">{metrics.conversionRate.toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground mt-1">All time</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Trend */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Revenue Trend</CardTitle>
            <Link href="/dashboard/analytics" className="text-sm text-primary hover:underline">
              View more
            </Link>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[250px]">
              <BarChart data={metrics.salesByMonth}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Lead Pipeline */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Lead Pipeline</CardTitle>
            <Link href="/dashboard/crm/leads" className="text-sm text-primary hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[250px]">
              <PieChart>
                <Pie
                  data={metrics.leadsByStatus}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="count"
                  nameKey="status"
                  label={({ status, count }) => `${statusLabels[status] || status}: ${count}`}
                >
                  {metrics.leadsByStatus.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <ChartTooltip content={<ChartTooltipContent />} />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Deals */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Recent Deals</CardTitle>
            <Link href="/dashboard/deals" className="text-sm text-primary hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {metrics.recentDeals.map(deal => (
                <Link key={deal.id} href={`/dashboard/deals/${deal.id}`}>
                  <div className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors">
                    <div>
                      <p className="font-medium text-sm">
                        {deal.vehicle ? `${deal.vehicle.year} ${deal.vehicle.make} ${deal.vehicle.model}` : 'No vehicle'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {deal.lead ? `${deal.lead.firstName} ${deal.lead.lastName}` : 'No customer'} · {formatDate(deal.createdAt)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{formatCurrency(deal.vehiclePrice)}</p>
                      <p className={`text-xs ${deal.status === 'delivered' ? 'text-green-600' : deal.status === 'pencil' ? 'text-slate-500' : 'text-amber-600'}`}>
                        {deal.status}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
              {metrics.recentDeals.length === 0 && (
                <p className="text-center text-muted-foreground py-4">No recent deals</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top Sales Reps */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Top Performers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {metrics.topReps.map((rep, idx) => (
                <div key={rep.name} className="flex items-center gap-4">
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    idx === 0 ? 'bg-amber-100 text-amber-700' : 
                    idx === 1 ? 'bg-slate-100 text-slate-700' : 
                    idx === 2 ? 'bg-orange-100 text-orange-700' : 
                    'bg-muted text-muted-foreground'
                  }`}>
                    {idx + 1}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{rep.name}</p>
                    <p className="text-xs text-muted-foreground">{rep.deals} deals</p>
                  </div>
                  <p className="font-bold text-green-600">{formatCurrency(rep.revenue)}</p>
                </div>
              ))}
              {metrics.topReps.length === 0 && (
                <p className="text-center text-muted-foreground py-4">No sales data yet</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
