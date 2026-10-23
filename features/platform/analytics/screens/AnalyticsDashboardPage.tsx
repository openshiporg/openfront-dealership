import { getAnalyticsData } from '../actions'
import { AnalyticsDashboardPageClient } from './AnalyticsDashboardPageClient'
import { getDealershipTimeZone } from '../../lib/dealershipTimeZone'

export async function AnalyticsDashboardPage() {
  const [data, timeZone] = await Promise.all([getAnalyticsData(), getDealershipTimeZone()])

  return <AnalyticsDashboardPageClient initialData={data} timeZone={timeZone} />
}

export default AnalyticsDashboardPage
