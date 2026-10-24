'use server'

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import {
  getInventoryMetrics,
  getSalesMetrics,
  getServiceMetrics,
  type InventoryMetrics,
  type SalesMetrics,
  type ServiceMetrics,
} from './metrics'
import { getDealershipTimeZone } from '@/features/platform/lib/dealershipTimeZone'

export type { InventoryMetrics, SalesMetrics, ServiceMetrics }

export type AnalyticsOperations = {
  generatedAt: string
  metrics: {
    financeProductPenetrationPercent?: number
    deliveredDeals?: number
    service?: { effectiveLaborRateCents?: number; soldHours?: number }
    parts?: { fillRatePercent?: number }
  } | null
  exceptions: { accounting?: number; payments?: number; funding?: number; total?: number } | null
}

export type AnalyticsData = {
  sales: SalesMetrics | null
  inventory: InventoryMetrics | null
  service: ServiceMetrics | null
  operations: AnalyticsOperations | null
  currencyCode: string
  error: string | null
}

export async function getAnalyticsData(): Promise<AnalyticsData> {
  const timeZone = await getDealershipTimeZone()
  const [salesRes, invRes, serviceRes, operationsRes] = await Promise.all([
    getSalesMetrics(),
    getInventoryMetrics(),
    getServiceMetrics(timeZone),
    keystoneClient<{
      operationalReport: AnalyticsOperations | null
      dealershipProfile: { currencyCode: string | null } | null
    }>(`
      query AnalyticsOperationalReport {
        operationalReport { generatedAt metrics exceptions }
        dealershipProfile { currencyCode }
      }
    `, {}, { cache: 'no-store' }),
  ])

  const failure = [salesRes, invRes, serviceRes].find(response => !response.success)

  return {
    sales: salesRes.success && salesRes.data ? salesRes.data : null,
    inventory: invRes.success && invRes.data ? invRes.data : null,
    service: serviceRes.success && serviceRes.data ? serviceRes.data : null,
    operations: operationsRes.success ? operationsRes.data.operationalReport : null,
    currencyCode: (operationsRes.success && operationsRes.data.dealershipProfile?.currencyCode) || 'USD',
    error: failure ? failure.error || 'Unable to load analytics.' : null,
  }
}
