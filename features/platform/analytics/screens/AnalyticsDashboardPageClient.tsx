'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from 'recharts'
import { ArrowRight, RefreshCw } from 'lucide-react'
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
  type DeskTone,
} from '@/features/platform/components/desk'
import { getAnalyticsData, type AnalyticsData } from '../actions'

const ACCENT = '#0ea5e9'

const chartConfig = {
  revenue: { label: 'Revenue', color: 'var(--foreground)' },
  count: { label: 'Count', color: 'var(--foreground)' },
}

type Area = 'sales' | 'inventory' | 'service'
type Period = '6' | '12' | 'all'

const AREA_OPTIONS = [
  { value: 'sales', label: 'Sales' },
  { value: 'inventory', label: 'Inventory' },
  { value: 'service', label: 'Service' },
] as const

const PERIOD_OPTIONS = [
  { value: '6', label: '6M' },
  { value: '12', label: '12M' },
  { value: 'all', label: 'All' },
] as const

const statusTone: Record<string, DeskTone> = {
  available: 'ok',
  pending: 'warn',
  hold: 'info',
  service: 'idle',
  sold: 'accent',
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="py-8 text-center text-sm text-muted-foreground">{children}</p>
}

function SectionLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
      {children}
      <ArrowRight className="size-3" />
    </Link>
  )
}

/** Horizontal share bars as a row list: label, bar, figure. */
function BarRows({
  rows,
  empty,
}: {
  rows: Array<{ key: string; label: ReactNode; value: number; figure?: ReactNode; tone?: DeskTone; accent?: boolean }>
  empty: string
}) {
  if (!rows.length) return <Empty>{empty}</Empty>
  const max = Math.max(1, ...rows.map(row => row.value))
  return (
    <ul className="space-y-2.5">
      {rows.map(row => (
        <li key={row.key} className="flex min-w-0 items-center gap-3 text-sm">
          <TitleLine as="span" tone={row.tone} className="w-28 shrink-0 truncate capitalize text-muted-foreground sm:w-36">
            {row.label}
          </TitleLine>
          <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
            <span
              className="block h-full rounded-full"
              style={{ width: `${(row.value / max) * 100}%`, background: row.accent ? ACCENT : 'color-mix(in oklab, var(--foreground) 80%, transparent)' }}
            />
          </span>
          <span className="shrink-0 text-right font-mono text-xs tabular-nums">{row.figure ?? row.value}</span>
        </li>
      ))}
    </ul>
  )
}

export function AnalyticsDashboardPageClient({ initialData }: { initialData: AnalyticsData }) {
  const [data, setData] = useState<AnalyticsData>(initialData)
  const [loading, setLoading] = useState(false)
  const [area, setArea] = useState<Area>('sales')
  const [period, setPeriod] = useState<Period>('12')

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

  const exceptions = operations?.exceptions?.total || 0

  const header = (
    <DeskHeader
      title="Analytics"
      tone={error ? 'bad' : exceptions > 0 ? 'warn' : 'ok'}
      status={error ? 'Unavailable' : exceptions > 0 ? `${exceptions} open exceptions` : 'No open exceptions'}
      meta={operations?.generatedAt ? `Updated ${new Date(operations.generatedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` : undefined}
      actions={
        <Track>
          <Pill onClick={loadData} disabled={loading} aria-label="Refresh">
            <RefreshCw className={loading ? 'animate-spin' : undefined} />
            {error ? 'Retry' : 'Refresh'}
          </Pill>
        </Track>
      }
    />
  )

  if (error) {
    return (
      <PageContainer title="Analytics" header={header} breadcrumbs={breadcrumbs}>
        <div className="px-4 pb-6 md:px-6">
          <Notice tone="bad">
            <p className="font-medium">Unable to load analytics</p>
            <p className="mt-0.5 text-muted-foreground">{error}</p>
          </Notice>
        </div>
      </PageContainer>
    )
  }

  const allMonths = salesMetrics?.salesByMonth || []
  const months = period === 'all' ? allMonths : allMonths.slice(-Number(period))
  const latestMonth = months[months.length - 1]?.month
  const periodUnits = months.reduce((sum, month) => sum + month.count, 0)
  const periodRevenue = months.reduce((sum, month) => sum + month.revenue, 0)
  const slowMoving = (inventoryMetrics?.slowMoving || []).filter(v => v.daysInStock > 60)

  const axis = { tickLine: false, axisLine: false, tick: { fontSize: 11 } } as const

  return (
    <PageContainer title="Analytics" header={header} breadcrumbs={breadcrumbs}>
    <div className="min-w-0 max-w-full space-y-8 overflow-x-hidden px-4 pb-10 md:px-6 [&_.recharts-responsive-container]:max-w-full">

      <DeskSection title="Operations">
        <ReadoutStrip>
          <Readout label="F&I penetration" value={`${operations?.metrics?.financeProductPenetrationPercent || 0}%`} />
          <Readout label="Effective labor rate" value={formatCurrency((operations?.metrics?.service?.effectiveLaborRateCents || 0) / 100)} />
          <Readout label="Parts fill rate" value={`${operations?.metrics?.parts?.fillRatePercent || 0}%`} />
          <Readout
            label="Open exceptions"
            value={exceptions}
            tone={exceptions > 0 ? 'bad' : 'ok'}
            sub={`${operations?.exceptions?.accounting || 0} accounting · ${operations?.exceptions?.payments || 0} payments`}
          />
        </ReadoutStrip>
      </DeskSection>

      <Segmented label="Analytics area" value={area} onChange={setArea} options={AREA_OPTIONS} />

      {area === 'sales' && (
        <div className="space-y-8">
          <ReadoutStrip>
            <Readout label="Delivered sales" value={salesMetrics?.totalSales || 0} />
            <Readout label="Delivered revenue" value={formatCurrency(salesMetrics?.totalRevenue || 0)} />
            <Readout label="Avg deal profit" value={formatCurrency(salesMetrics?.avgDealProfit || 0)} />
            <Readout label="Reps active" value={salesMetrics?.salesByRep.length || 0} />
          </ReadoutStrip>

          <DeskSection
            title="By month"
            actions={<Segmented label="Period" size="sm" value={period} onChange={setPeriod} options={PERIOD_OPTIONS} />}
          >
            <div className="space-y-6">
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                <span className="text-muted-foreground">Units <span className="ml-1 font-semibold tabular-nums text-foreground">{periodUnits}</span></span>
                <span className="text-muted-foreground">Revenue <span className="ml-1 font-semibold tabular-nums text-foreground">{formatCurrency(periodRevenue)}</span></span>
              </div>
              {months.length ? (
                <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                  <div className="min-w-0">
                    <p className="mb-2 font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">Units delivered</p>
                    <ChartContainer config={chartConfig} className="h-[220px] w-full">
                      <BarChart data={months} margin={{ left: 0, right: 0, top: 8 }}>
                        <CartesianGrid vertical={false} strokeDasharray="2 4" />
                        <XAxis dataKey="month" {...axis} />
                        <YAxis width={32} allowDecimals={false} {...axis} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="count" radius={[6, 6, 2, 2]} maxBarSize={36}>
                          {months.map(month => <Cell key={month.month} fill={month.month === latestMonth ? ACCENT : 'var(--color-count)'} />)}
                        </Bar>
                      </BarChart>
                    </ChartContainer>
                  </div>
                  <div className="min-w-0">
                    <p className="mb-2 font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">Revenue</p>
                    <ChartContainer config={chartConfig} className="h-[220px] w-full">
                      <BarChart data={months} margin={{ left: 0, right: 0, top: 8 }}>
                        <CartesianGrid vertical={false} strokeDasharray="2 4" />
                        <XAxis dataKey="month" {...axis} />
                        <YAxis width={56} {...axis} tickFormatter={(v) => compactCurrency.format(Number(v))} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="revenue" radius={[6, 6, 2, 2]} maxBarSize={36}>
                          {months.map(month => <Cell key={month.month} fill={month.month === latestMonth ? ACCENT : 'var(--color-revenue)'} />)}
                        </Bar>
                      </BarChart>
                    </ChartContainer>
                  </div>
                </div>
              ) : (
                <Empty>No deliveries</Empty>
              )}
            </div>
          </DeskSection>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <DeskSection title="Top sales reps" count={Math.min(5, salesMetrics?.salesByRep.length || 0)}>
              <BarRows
                empty="No delivered deals"
                rows={(salesMetrics?.salesByRep || []).slice(0, 5).map((rep, index) => ({
                  key: `${rep.name}-${index}`,
                  label: rep.name,
                  value: rep.count,
                  accent: index === 0,
                  figure: <>{rep.count} <span className="text-muted-foreground">· {compactCurrency.format(rep.revenue)}</span></>,
                }))}
              />
            </DeskSection>

            <DeskSection title="Sales by make" count={Math.min(8, salesMetrics?.vehiclesSold.length || 0)}>
              <BarRows
                empty="No delivered deals"
                rows={(salesMetrics?.vehiclesSold || []).slice(0, 8).map((item, index) => ({ key: item.make, label: item.make, value: item.count, accent: index === 0 }))}
              />
            </DeskSection>
          </div>

          <DeskSection title="Top selling vehicles" count={salesMetrics?.topVehicles?.length || 0}>
            {salesMetrics?.topVehicles?.length ? (
              <Panel className="divide-y">
                {salesMetrics.topVehicles.map((vehicle, idx) => (
                  <div key={idx} className="flex min-w-0 items-center gap-3 px-4 py-2.5 text-sm">
                    <span className="w-5 shrink-0 font-mono text-xs tabular-nums text-muted-foreground">{String(idx + 1).padStart(2, '0')}</span>
                    <span className="min-w-0 flex-1 truncate">{vehicle.year} {vehicle.make} {vehicle.model}</span>
                    <span className="shrink-0 font-mono text-xs tabular-nums">{vehicle.count} sold</span>
                  </div>
                ))}
              </Panel>
            ) : (
              <Empty>No sales</Empty>
            )}
          </DeskSection>
        </div>
      )}

      {area === 'inventory' && (
        <div className="space-y-8">
          <ReadoutStrip>
            <Readout label="Total vehicles" value={inventoryMetrics?.totalVehicles || 0} />
            <Readout label="Inventory value" value={formatCurrency(inventoryMetrics?.totalValue || 0)} />
            <Readout
              label="Avg days in stock"
              value={Math.round(inventoryMetrics?.avgDaysInStock || 0)}
              tone={inventoryMetrics?.avgDaysInStock && inventoryMetrics.avgDaysInStock > 60 ? 'warn' : undefined}
            />
            <Readout label="Available" value={inventoryMetrics?.vehiclesByStatus.find(s => s.status === 'available')?.count || 0} tone="ok" />
          </ReadoutStrip>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <DeskSection title="By status">
              <BarRows
                empty="No vehicles"
                rows={(inventoryMetrics?.vehiclesByStatus || []).map(item => ({ key: item.status, label: item.status, value: item.count, tone: statusTone[item.status] || 'idle' }))}
              />
            </DeskSection>

            <DeskSection title="Aging">
              {inventoryMetrics?.agingBreakdown?.length ? (
                <ChartContainer config={chartConfig} className="h-[220px] w-full">
                  <BarChart data={inventoryMetrics.agingBreakdown} margin={{ left: 0, right: 0, top: 8 }}>
                    <CartesianGrid vertical={false} strokeDasharray="2 4" />
                    <XAxis dataKey="range" {...axis} />
                    <YAxis width={32} allowDecimals={false} {...axis} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="count" radius={[6, 6, 2, 2]} maxBarSize={48}>
                      {inventoryMetrics.agingBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.range === '90+' ? ACCENT : 'var(--color-count)'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              ) : (
                <Empty>No vehicles</Empty>
              )}
            </DeskSection>
          </div>

          <DeskSection title="Slow moving" count={slowMoving.length} actions={<SectionLink href={`${basePath}/platform/vehicles`}>Inventory</SectionLink>}>
            {slowMoving.length ? (
              <Panel className="divide-y">
                {slowMoving.map(vehicle => (
                  <div key={vehicle.id} className="flex min-w-0 items-start justify-between gap-4 px-4 py-3">
                    <div className="min-w-0">
                      <TitleLine as="p" tone={vehicle.daysInStock > 90 ? 'bad' : 'warn'} status={vehicle.daysInStock > 90 ? '90+ days' : '61-90 days'} className="text-sm font-medium">
                        {vehicle.year} {vehicle.make} {vehicle.model}
                      </TitleLine>
                      <p className="pl-4"><Code>{vehicle.stockNumber}</Code></p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-medium tabular-nums">{formatCurrency(vehicle.price)}</p>
                      <p className={`font-mono text-xs tabular-nums ${vehicle.daysInStock > 90 ? 'text-red-600 dark:text-red-400' : 'text-amber-700 dark:text-amber-300'}`}>{vehicle.daysInStock} days</p>
                    </div>
                  </div>
                ))}
              </Panel>
            ) : (
              <Empty>No slow-moving inventory</Empty>
            )}
          </DeskSection>

          <DeskSection title="By condition">
            {inventoryMetrics?.vehiclesByCondition?.length ? (
              <ReadoutStrip>
                {inventoryMetrics.vehiclesByCondition.map((item, idx) => (
                  <Readout key={idx} label={item.condition} value={item.count} />
                ))}
              </ReadoutStrip>
            ) : (
              <Empty>No vehicles</Empty>
            )}
          </DeskSection>
        </div>
      )}

      {area === 'service' && (
        <div className="space-y-8">
          <ReadoutStrip>
            <Readout label="Today's appointments" value={serviceMetrics?.todayAppointments || 0} tone={serviceMetrics?.todayAppointments ? 'info' : undefined} />
            <Readout label="Active ROs" value={serviceMetrics?.activeRepairOrders || 0} />
            <Readout label="Settled RO revenue" value={formatCurrency(serviceMetrics?.serviceRevenue || 0)} />
            <Readout label="Avg settled RO" value={formatCurrency(serviceMetrics?.avgRepairOrder || 0)} />
          </ReadoutStrip>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <DeskSection title="Appointments by status">
              <BarRows
                empty="No appointments"
                rows={(serviceMetrics?.appointmentsByStatus || []).map(item => ({ key: item.status, label: item.status, value: item.count }))}
              />
            </DeskSection>

            <DeskSection title="Repair orders by status">
              {serviceMetrics?.repairOrdersByStatus?.length ? (
                <ChartContainer config={chartConfig} className="h-[220px] w-full">
                  <BarChart data={serviceMetrics.repairOrdersByStatus} margin={{ left: 0, right: 0, top: 8 }}>
                    <CartesianGrid vertical={false} strokeDasharray="2 4" />
                    <XAxis dataKey="status" {...axis} />
                    <YAxis width={32} allowDecimals={false} {...axis} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="count" fill="var(--color-count)" radius={[6, 6, 2, 2]} maxBarSize={48} />
                  </BarChart>
                </ChartContainer>
              ) : (
                <Empty>No repair orders</Empty>
              )}
            </DeskSection>
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <DeskSection title="Service mix">
              <BarRows
                empty="No appointments"
                rows={(serviceMetrics?.serviceTypeBreakdown || []).map(item => ({ key: item.serviceType, label: item.serviceType, value: item.count }))}
              />
            </DeskSection>

            <DeskSection title="Low stock parts" count={serviceMetrics?.lowStockParts?.length || 0} actions={<SectionLink href={`${basePath}/platform/service`}>Service</SectionLink>}>
              {serviceMetrics?.lowStockParts?.length ? (
                <Panel className="divide-y">
                  {serviceMetrics.lowStockParts.map(part => (
                    <div key={part.id} className="flex min-w-0 items-start justify-between gap-4 px-4 py-3">
                      <div className="min-w-0">
                        <TitleLine as="p" tone="bad" status="Low stock" className="text-sm font-medium">{part.description}</TitleLine>
                        <p className="pl-4"><Code>#{part.partNumber}</Code></p>
                      </div>
                      <div className="shrink-0 text-right font-mono text-xs tabular-nums">
                        <p className="text-sm font-semibold text-red-600 dark:text-red-400">{part.quantity}</p>
                        <p className="text-muted-foreground">min {part.minimumQuantity}</p>
                      </div>
                    </div>
                  ))}
                </Panel>
              ) : (
                <Empty>No low-stock parts</Empty>
              )}
            </DeskSection>
          </div>
        </div>
      )}
    </div>
    </PageContainer>
  )
}
