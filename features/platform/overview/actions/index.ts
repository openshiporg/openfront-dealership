'use server'

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'

export type PeriodMetric = {
  current: number
  previous: number
  direction: 'up' | 'down' | 'neutral'
  percentChange: number | null
}

export type DashboardMetrics = {
  period: { generatedAt: string; currentStart: string; previousStart: string; days: number }
  periodComparison: {
    deliveredCount: PeriodMetric
    deliveredRevenueCents: PeriodMetric
    deliveredGrossCents: PeriodMetric
    newLeads: PeriodMetric
    settledServiceRevenueCents: PeriodMetric
  }
  salesFunnel: Array<{ label: string; count: number }>
  totalLeads: number
  leadConversionPercent: number
  convertedLeads?: number
  pendingDeals: number
  todayAppointments: number
  deliveredDeals: number
  deliveredRevenueCents: number
  deliveredGrossCents: number
  averageDeliveredGrossCents: number
  deliveredByMonth: Array<{ month: string; revenueCents: number; grossCents: number; count: number }>
  topSalespeople: Array<{ id: string; name: string; deals: number; revenueCents: number; grossCents: number }>
  recentDeals: Array<{
    id: string
    status: string
    vehiclePriceCents: number
    grossCents: number
    occurredAt: string
    vehicle: { year: number; make: string; model: string } | null
    lead: { firstName: string; lastName: string } | null
  }>
  inventory: { available: number; averageAgeDays: number; retailCents: number; costCents: number }
  service: { soldHours: number; actualHours: number; effectiveLaborRateCents: number; ordersByStatus: Array<{ label: string; count: number }> }
  financeProductPenetrationPercent?: number
  parts?: { lowStockCount: number; fillRatePercent: number; obsoleteCount: number }
}

export type OperationalReport = {
  generatedAt: string
  metrics: DashboardMetrics
  exceptions: { accounting: number; payments: number; funding: number; total: number }
}

export async function getOperationalReport() {
  return keystoneClient<{
    operationalReport: OperationalReport | null
    dealershipProfile: { currencyCode: string | null } | null
  }>(`
    query OverviewOperationalReport {
      operationalReport { generatedAt metrics exceptions }
      dealershipProfile { currencyCode }
    }
  `, {}, { cache: 'no-store' })
}
