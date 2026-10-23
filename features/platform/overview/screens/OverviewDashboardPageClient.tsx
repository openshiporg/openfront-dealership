'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, RefreshCw } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'

import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { PageContainer } from '@/features/dashboard/components/PageContainer'
import { basePath } from '@/features/dashboard/lib/config'
import {
  DeskHeader,
  DeskSection,
  Meter,
  Notice,
  Panel,
  Pill,
  Readout,
  ReadoutStrip,
  TitleLine,
  Track,
  type DeskTone,
} from '@/features/platform/components/desk'
import { getOperationalReport, type OperationalReport, type PeriodMetric } from '../actions'
import { useHydrated } from '../../lib/useHydrated'

const chartConfig = {
  revenue: { label: 'Delivered revenue', color: 'var(--foreground)' },
}

const statusLabels: Record<string, string> = {
  new: 'New',
  contacted: 'Contacted',
  'test-drive-scheduled': 'Test drive',
  negotiating: 'Negotiating',
  'closed-won': 'Closed won',
  'closed-lost': 'Closed lost',
}

const dealTone: Record<string, DeskTone> = {
  pencil: 'idle',
  submitted: 'warn',
  approved: 'info',
  financed: 'info',
  delivered: 'ok',
  cancelled: 'bad',
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function comparisonLabel(metric: PeriodMetric) {
  if (metric.previous === 0) return metric.current === 0 ? 'No change' : 'No prior period'
  const prefix = Number(metric.percentChange) > 0 ? '+' : ''
  return `${prefix}${metric.percentChange}% vs prior 30d`
}

function comparisonTone(metric: PeriodMetric): DeskTone | undefined {
  if (metric.previous === 0) return undefined
  return metric.direction === 'up' ? 'ok' : metric.direction === 'down' ? 'bad' : 'idle'
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
  const hydrated = useHydrated()
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

  const exceptions = report?.exceptions.total ?? 0

  const header = (
    <DeskHeader
      title="Overview"
      tone={report ? (exceptions > 0 ? 'warn' : 'ok') : 'bad'}
      status={report ? (exceptions > 0 ? `${exceptions} open exceptions` : 'No open exceptions') : 'Unavailable'}
      meta={
        report
          ? hydrated
            ? `30 days to ${formatDate(report.metrics.period.generatedAt)} · Updated ${new Date(report.generatedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
            : '30 days'
          : 'Unavailable'
      }
      actions={
        <Track>
          <Pill onClick={loadDashboardData} disabled={loading} aria-label="Refresh">
            <RefreshCw className={loading ? 'animate-spin' : undefined} />
            Refresh
          </Pill>
          <Pill asChild variant="primary">
            <Link href={`${basePath}/platform/analytics`}>
              Analytics
              <ArrowRight />
            </Link>
          </Pill>
        </Track>
      }
    />
  )

  if (!report) {
    return (
      <PageContainer title="Overview" header={header} breadcrumbs={breadcrumbs}>
        <div className="px-4 pb-24 md:px-6">
          <Notice tone="bad">
            <p className="font-medium">Unable to load the overview</p>
            {error && <p className="mt-0.5 text-muted-foreground">{error}</p>}
          </Notice>
        </div>
      </PageContainer>
    )
  }

  const metrics = report.metrics
  const revenueChart = metrics.deliveredByMonth.map(item => ({ ...item, revenue: item.revenueCents / 100 }))
  const compactCurrency = new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode, notation: 'compact', maximumFractionDigits: 0 })
  const funnelMax = Math.max(1, ...metrics.salesFunnel.map(stage => stage.count))
  const leaderRevenue = Math.max(1, ...metrics.topSalespeople.map(person => person.revenueCents))
  const pc = metrics.periodComparison

  return (
    <PageContainer title="Overview" header={header} breadcrumbs={breadcrumbs}>
      <div className="min-w-0 max-w-full space-y-8 px-4 pb-24 md:px-6">
        {error && <Notice tone="bad">{error}</Notice>}

        <DeskSection title="Today">
          <ReadoutStrip>
            <Link href={`${basePath}/platform/test-drives`} className="transition-colors hover:bg-muted/40">
              <Readout label="Appointments" value={metrics.todayAppointments} tone={metrics.todayAppointments > 0 ? 'info' : 'idle'} />
            </Link>
            <Link href={`${basePath}/platform/deals`} className="transition-colors hover:bg-muted/40">
              <Readout label="Pending deals" value={metrics.pendingDeals} tone={metrics.pendingDeals > 0 ? 'warn' : 'idle'} />
            </Link>
            <Link href={`${basePath}/platform/accounting`} className="transition-colors hover:bg-muted/40">
              <Readout
                label="Exceptions"
                value={exceptions}
                tone={exceptions > 0 ? 'bad' : 'ok'}
                sub={`Acct ${report.exceptions.accounting} · Pay ${report.exceptions.payments} · Fund ${report.exceptions.funding}`}
              />
            </Link>
            <Link href={`${basePath}/platform/vehicles`} className="transition-colors hover:bg-muted/40">
              <Readout label="Units in stock" value={metrics.inventory.available} sub={`Avg age ${Math.round(metrics.inventory.averageAgeDays)} days`} />
            </Link>
          </ReadoutStrip>
        </DeskSection>

        <DeskSection title="Last 30 days">
          <ReadoutStrip>
            <Readout label="Delivered revenue" value={formatCurrencyCents(pc.deliveredRevenueCents.current)} sub={comparisonLabel(pc.deliveredRevenueCents)} tone={comparisonTone(pc.deliveredRevenueCents)} />
            <Readout label="Units delivered" value={pc.deliveredCount.current} sub={comparisonLabel(pc.deliveredCount)} tone={comparisonTone(pc.deliveredCount)} />
            <Readout label="Gross" value={formatCurrencyCents(pc.deliveredGrossCents.current)} sub={`Avg ${formatCurrencyCents(metrics.averageDeliveredGrossCents)}`} tone={comparisonTone(pc.deliveredGrossCents)} />
            <Readout label="New leads" value={pc.newLeads.current} sub={comparisonLabel(pc.newLeads)} tone={comparisonTone(pc.newLeads)} />
            <Readout label="Lead conversion" value={`${metrics.leadConversionPercent.toFixed(1)}%`} sub={`${metrics.totalLeads} leads`} />
            <Readout label="Service revenue" value={formatCurrencyCents(pc.settledServiceRevenueCents.current)} sub={comparisonLabel(pc.settledServiceRevenueCents)} tone={comparisonTone(pc.settledServiceRevenueCents)} />
          </ReadoutStrip>
        </DeskSection>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.4fr_1fr]">
          <DeskSection title="Delivered revenue by month">
            {revenueChart.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[240px] w-full">
                <BarChart data={revenueChart} margin={{ left: 0, right: 0, top: 8 }}>
                  <CartesianGrid vertical={false} strokeDasharray="2 4" />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                  <YAxis width={56} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} tickFormatter={value => compactCurrency.format(Number(value))} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[6, 6, 2, 2]} maxBarSize={40} />
                </BarChart>
              </ChartContainer>
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">No deliveries</p>
            )}
          </DeskSection>

          <DeskSection title="Lead pipeline" count={metrics.totalLeads} actions={<Link href={`${basePath}/platform/crm`} className="text-xs font-medium text-muted-foreground hover:text-foreground">CRM</Link>}>
            {metrics.salesFunnel.length > 0 ? (
              <ul className="space-y-2.5">
                {metrics.salesFunnel.map(stage => (
                  <li key={stage.label} className="flex items-center gap-3 text-sm">
                    <span className="w-28 shrink-0 truncate text-muted-foreground">{statusLabels[stage.label] || stage.label}</span>
                    <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
                      <span className="block h-full rounded-full bg-foreground/80" style={{ width: `${(stage.count / funnelMax) * 100}%` }} />
                    </span>
                    <span className="w-8 shrink-0 text-right font-mono text-xs tabular-nums">{stage.count}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">No leads</p>
            )}
          </DeskSection>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <DeskSection
            title="Recent deals"
            count={metrics.recentDeals.length}
            actions={<Link href={`${basePath}/platform/deals`} className="text-xs font-medium text-muted-foreground hover:text-foreground">All deals</Link>}
          >
            {metrics.recentDeals.length > 0 ? (
              <Panel className="divide-y">
                {metrics.recentDeals.map(deal => (
                  <Link
                    key={deal.id}
                    href={`${basePath}/platform/deals/${deal.id}`}
                    className="flex min-w-0 items-start justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted/40"
                  >
                    <div className="min-w-0">
                      <TitleLine as="p" tone={dealTone[deal.status] ?? 'idle'} status={deal.status} className="text-sm font-medium">
                        {deal.vehicle ? `${deal.vehicle.year} ${deal.vehicle.make} ${deal.vehicle.model}` : 'No vehicle'}
                      </TitleLine>
                      <p className="truncate pl-4 text-xs text-muted-foreground">
                        {deal.lead ? `${deal.lead.firstName} ${deal.lead.lastName}` : 'No customer'}{hydrated && ` · ${formatDate(deal.occurredAt)}`}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-medium tabular-nums">{formatCurrencyCents(deal.vehiclePriceCents)}</p>
                      <p className="text-xs capitalize text-muted-foreground">{deal.status}</p>
                    </div>
                  </Link>
                ))}
              </Panel>
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">No recent deals</p>
            )}
          </DeskSection>

          <DeskSection title="Top salespeople" count={metrics.topSalespeople.length}>
            {metrics.topSalespeople.length > 0 ? (
              <Panel className="divide-y">
                {metrics.topSalespeople.map((person, index) => (
                  <div key={person.id} className="flex min-w-0 items-center gap-3 px-4 py-3">
                    <span className="w-5 shrink-0 font-mono text-xs tabular-nums text-muted-foreground">{String(index + 1).padStart(2, '0')}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{person.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {person.deals} delivered · Gross {formatCurrencyCents(person.grossCents)}
                      </p>
                    </div>
                    <div className="hidden sm:block">
                      <Meter value={person.revenueCents / leaderRevenue} label={`${person.name} share of leader revenue`} />
                    </div>
                    <p className="w-24 shrink-0 text-right text-sm font-semibold tabular-nums">{formatCurrencyCents(person.revenueCents)}</p>
                  </div>
                ))}
              </Panel>
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">No delivered deals</p>
            )}
          </DeskSection>
        </div>

        <DeskSection title="Inventory value">
          <ReadoutStrip>
            <Readout label="Retail" value={formatCurrencyCents(metrics.inventory.retailCents)} />
            <Readout label="Cost" value={formatCurrencyCents(metrics.inventory.costCents)} />
            <Readout label="Spread" value={formatCurrencyCents(metrics.inventory.retailCents - metrics.inventory.costCents)} />
            <Readout label="Service hours" value={metrics.service.soldHours.toFixed(1)} sub={`Actual ${metrics.service.actualHours.toFixed(1)} · ELR ${formatCurrencyCents(metrics.service.effectiveLaborRateCents)}`} />
          </ReadoutStrip>
        </DeskSection>
      </div>
    </PageContainer>
  )
}
