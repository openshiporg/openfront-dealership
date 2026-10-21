'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Wrench } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from 'recharts'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { PageContainer } from '@/features/dashboard/components/PageContainer'
import { basePath } from '@/features/dashboard/lib/config'
import { getOperationalReport, type OperationalReport, type PeriodMetric } from '../actions'

const COLORS = ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#8b5cf6', '#06b6d4']
const chartConfig = {
  revenue: { label: 'Delivered revenue', color: '#2563eb' },
  count: { label: 'Count', color: '#16a34a' },
}

const statusLabels: Record<string, string> = {
  new: 'New',
  contacted: 'Contacted',
  'test-drive-scheduled': 'Test Drive',
  negotiating: 'Negotiating',
  'closed-won': 'Closed Won',
  'closed-lost': 'Closed Lost',
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function comparisonLabel(metric: PeriodMetric) {
  if (metric.previous === 0) return metric.current === 0 ? 'No change vs prior 30 days' : 'No prior-period data'
  const prefix = Number(metric.percentChange) > 0 ? '+' : ''
  return `${prefix}${metric.percentChange}% vs prior 30 days`
}

function ReportValue({ title, value, comparison, href }: { title: string; value: string; comparison?: PeriodMetric; href?: string }) {
  return (
    <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-2 border-b py-3 text-sm">
      <dt>
        {href ? (
          <Link className="underline" href={href}>
            {title}
          </Link>
        ) : (
          title
        )}
      </dt>
      <dd className="font-medium tabular-nums">
        {value}
        {comparison && <span className="ml-2 text-xs text-muted-foreground">{comparisonLabel(comparison)}</span>}
      </dd>
    </div>
  )
}

export function OverviewDashboardPageClient({
  initialReport,
  initialCurrencyCode,
  initialError,
}: {
  initialReport: OperationalReport | null
  initialCurrencyCode: string
  initialError: string | null
}) {
  const [report, setReport] = useState<OperationalReport | null>(initialReport)
  const [currencyCode, setCurrencyCode] = useState(initialCurrencyCode)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(initialError)

  const formatCurrencyCents = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode, maximumFractionDigits: 0 }).format((value || 0) / 100)

  const loadDashboardData = async () => {
    setLoading(true)
    setError(null)
    const response = await getOperationalReport()
    if (response.success && response.data.operationalReport) {
      setReport(response.data.operationalReport)
      setCurrencyCode(response.data.dealershipProfile?.currencyCode || 'USD')
    } else {
      setError(response.success ? 'Unable to load the overview.' : response.error)
    }
    setLoading(false)
  }

  const breadcrumbs = [
    { type: 'link' as const, label: 'Dashboard', href: basePath },
    { type: 'page' as const, label: 'Platform' },
    { type: 'page' as const, label: 'Overview' },
  ]

  const header = (
    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">Overview</h1>
        <p className="text-muted-foreground">
          {report
            ? `30 days ending ${formatDate(report.metrics.period.generatedAt)} · updated ${new Date(report.generatedAt).toLocaleString()}`
            : 'Daily sales, inventory, and service performance.'}
        </p>
      </div>
      <Button asChild variant="outline" className="max-w-full self-start whitespace-normal text-left">
        <Link href={`${basePath}/platform/analytics`}>
          View analytics
          <ArrowRight className="ml-2 h-4 w-4 shrink-0" />
        </Link>
      </Button>
    </div>
  )

  if (!report) {
    return (
      <PageContainer title="Overview" header={header} breadcrumbs={breadcrumbs}>
        <div className="px-4 pb-6 md:px-6">
          <Card>
            <CardContent className="py-12 text-center">
              <p className="font-medium">Unable to load the overview</p>
              <p className="mt-1 text-sm text-muted-foreground">{error}</p>
              <Button className="mt-4" variant="outline" onClick={loadDashboardData} disabled={loading}>
                Retry
              </Button>
            </CardContent>
          </Card>
        </div>
      </PageContainer>
    )
  }

  const metrics = report.metrics
  const revenueChart = metrics.deliveredByMonth.map(item => ({ ...item, revenue: item.revenueCents / 100 }))
  const compactCurrency = new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode, notation: 'compact', maximumFractionDigits: 0 })

  return (
    <PageContainer title="Overview" header={header} breadcrumbs={breadcrumbs}>
      <div className="min-w-0 max-w-full space-y-6 px-4 pb-6 md:px-6">
        {error && (
          <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <dl className="divide-y rounded-lg border px-4">
          <ReportValue
            title="Delivered revenue · 30d"
            value={formatCurrencyCents(metrics.periodComparison.deliveredRevenueCents.current)}
            comparison={metrics.periodComparison.deliveredRevenueCents}
            href={`${basePath}/platform/analytics`}
          />
          <ReportValue
            title="Delivered deals · 30d"
            value={String(metrics.periodComparison.deliveredCount.current)}
            comparison={metrics.periodComparison.deliveredCount}
            href={`${basePath}/platform/deals`}
          />
          <ReportValue
            title="New leads · 30d"
            value={String(metrics.periodComparison.newLeads.current)}
            comparison={metrics.periodComparison.newLeads}
            href={`${basePath}/platform/crm`}
          />
          <ReportValue title="Available inventory" value={String(metrics.inventory.available)} href={`${basePath}/platform/vehicles`} />
        </dl>

        <dl className="divide-y rounded-lg border px-4 text-sm">
          {[
            ['Pending deals', metrics.pendingDeals],
            ['Today’s appointments', metrics.todayAppointments],
            ['Avg delivered gross', formatCurrencyCents(metrics.averageDeliveredGrossCents)],
            ['Lead conversion', `${metrics.leadConversionPercent.toFixed(1)}%`],
            ['Open exceptions', report.exceptions.total],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4 py-3">
              <dt>{label}</dt>
              <dd className="tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Delivered revenue by month</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[250px]">
                <BarChart data={revenueChart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={value => compactCurrency.format(Number(value))} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Lead pipeline</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[250px]">
                <PieChart>
                  <Pie
                    data={metrics.salesFunnel}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="count"
                    nameKey="label"
                    label={({ label, count }) => `${statusLabels[label] || label}: ${count}`}
                  >
                    {metrics.salesFunnel.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Recent deals</CardTitle>
              <Link href={`${basePath}/platform/deals`} className="text-sm text-primary hover:underline">
                View all
              </Link>
            </CardHeader>
            <CardContent className="space-y-3">
              {metrics.recentDeals.map(deal => (
                <Link
                  key={deal.id}
                  href={`${basePath}/platform/deals/${deal.id}`}
                  className="flex items-center justify-between rounded-lg px-3 py-2 transition-colors hover:bg-muted/50"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {deal.vehicle ? `${deal.vehicle.year} ${deal.vehicle.make} ${deal.vehicle.model}` : 'No vehicle'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {deal.lead ? `${deal.lead.firstName} ${deal.lead.lastName}` : 'No customer'} · {formatDate(deal.occurredAt)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatCurrencyCents(deal.vehiclePriceCents)}</p>
                    <p className={deal.status === 'delivered' ? 'text-xs text-green-600' : 'text-xs text-amber-600'}>{deal.status}</p>
                  </div>
                </Link>
              ))}
              {metrics.recentDeals.length === 0 && <p className="py-4 text-center text-muted-foreground">No recent deals</p>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Top salespeople</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {metrics.topSalespeople.map((person, index) => (
                <div key={person.id} className="flex items-center gap-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-bold">{index + 1}</div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{person.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {person.deals} delivered · gross {formatCurrencyCents(person.grossCents)}
                    </p>
                  </div>
                  <p className="font-bold text-green-600">{formatCurrencyCents(person.revenueCents)}</p>
                </div>
              ))}
              {metrics.topSalespeople.length === 0 && <p className="py-4 text-center text-muted-foreground">No delivered deals yet</p>}
              <div className="mt-4 flex items-center gap-2 rounded-lg border p-3 text-sm text-muted-foreground">
                <Wrench className="h-4 w-4" />
                <span>Service revenue · 30d: {formatCurrencyCents(metrics.periodComparison.settledServiceRevenueCents.current)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  )
}
